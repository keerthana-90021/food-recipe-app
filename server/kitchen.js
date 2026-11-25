import { randomBytes,scrypt as scryptCallback,timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { emptyData,applyAction,digest,findRecipe,principal,snapshot,visible } from './actions.js';
import { KitchenError,emailAddress,fail,passphrase,text } from './validation.js';

const scrypt = promisify(scryptCallback);
const scryptOptions={N:32768,r:8,p:3,maxmem:64*1024*1024};
const requestLimit=480*1024;
async function verifier(value,salt=randomBytes(16).toString('hex')) {
  const hash=await scrypt(value,salt,32,scryptOptions);
  return salt+':'+hash.toString('hex');
}
async function matches(value,stored) {
  const [salt]=stored.split(':');
  const actual=await verifier(value,salt);
  return actual.length===stored.length && timingSafeEqual(Buffer.from(actual),Buffer.from(stored));
}
function json(res,status,payload) {
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}
function checkOrigin(req,secure) {
  if(req.headers['sec-fetch-site']==='cross-site') fail(403,'Open the kitchen on this site to continue.');
  const origin=req.headers.origin;
  if (origin) {
    if (origin!==(secure?'https://':'http://')+req.headers.host) fail(403,'Open the kitchen on this site to continue.');
  }
  // A cross-origin HTML form cannot send JSON. No cross-origin preflight is granted.
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) fail(415,'Send the request as JSON.');
}
async function bodyOf(req) {
  if (Number(req.headers['content-length'])>requestLimit) fail(413,'Choose a smaller recipe photo.');
  let value=req.body;
  if(value===undefined) {
    const chunks=[]; let length=0;
    for await(const chunk of req) {
      length+=Buffer.byteLength(chunk);
      if(length>requestLimit) fail(413,'Choose a smaller recipe photo.');
      chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
    }
    value=Buffer.concat(chunks).toString('utf8');
  }
  if(Buffer.isBuffer(value)) value=value.toString('utf8');
  if(Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value))>requestLimit) fail(413,'Choose a smaller recipe photo.');
  if(typeof value==='string') {
    try {value=JSON.parse(value);} catch {fail(400,'Enter a valid request.');}
  }
  if(!value || typeof value!=='object' || typeof value.action!=='string' || Array.isArray(value)) fail(400,'Choose a kitchen action.');
  return value;
}
function cookieValue(raw,name) {
  const part=String(raw || '').split(';').map(item=>item.trim()).find(item=>item.startsWith(name+'='));
  const value=part?.slice(name.length+1);
  return /^[0-9a-f]{64}$/.test(value || '') ? value : '';
}
export function createKitchenHandler({repository,adminEmail,adminPassword,secureCookie=true}) {
  const privateEmail=emailAddress(adminEmail);
  passphrase(adminPassword,true);
  if(digest(adminPassword)==='f2609326f04e1c46f56149ba3904d35352c8b92f5dc305f82f3e4dc0b7e6e28d') {
    throw new Error('Choose a private administrator passphrase.');
  }
  const admin={id:'workspace-admin',role:'admin',name:'Kitchen Admin',email:privateEmail,stamp:digest(privateEmail+'\n'+adminPassword)};
  const cookieName=secureCookie?'__Host-supperclub_sid':'supperclub_dev_sid';
  const cookie=(value)=>cookieName+'='+value+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+(value?28800:0)+(secureCookie?'; Secure':'');
  let adminVerifier;
  async function prepare(body,req,db) {
    const {action}=body;
    if(action!=='login' && action!=='signup') return null;
    const email=emailAddress(body.email);
    const ip=(secureCookie && req.headers['x-vercel-forwarded-for']) || req.socket?.remoteAddress || 'local';
    const scope=digest(String(ip).split(',')[0].trim());
    const [ipAllowed,emailAllowed]=await Promise.all([
      repository.limit(action+'-ip-'+scope,action==='signup'?16:60,600),
      repository.limit(action+'-email-'+digest(email),action==='signup'?6:15,600)
    ]);
    if (!ipAllowed || !emailAllowed) fail(429,'Too many attempts. Try again in ten minutes.');
    const password=passphrase(body.password,action==='signup');
    if(action==='signup') return {email,name:text(body.name,'your name',80),password:await verifier(password)};
    if(!adminVerifier) adminVerifier=verifier(adminPassword);
    const account=email===admin.email?admin:Object.values(db.accounts).find(item=>item.email===email);
    const stored=account?.password || await adminVerifier;
    const valid=await matches(password,stored);
    if(!valid || !account) fail(401,'The email or password is incorrect.');
    return {accountId:account.id,verifier:stored};
  }
  return async function kitchen(req,res) {
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('Vary','Cookie');
    res.setHeader('X-Content-Type-Options','nosniff');
    try {
      const token=cookieValue(req.headers.cookie,cookieName);
      if(!['GET','POST'].includes(req.method)) {res.setHeader('Allow','GET, POST');fail(405,'Use GET or POST.');}
      let body;
      if(req.method==='POST') {checkOrigin(req,secureCookie);body=await bodyOf(req);}
      let {data,revision}=await repository.read();
      data=data || emptyData();
      if(req.method==='GET') {
        const person=principal(data,token,admin);
        const url=new URL(req.url,'http://kitchen.local');
        if(url.searchParams.has('image')) {
          const row=findRecipe(data,url.searchParams.get('image'));
          if(!visible(row,person) || !row.photoKey || String(row.revision)!==url.searchParams.get('v')) fail(404,'This photo is unavailable.');
          const stored=await repository.photo(row.photoKey);
          if(!stored) fail(404,'This photo is unavailable.');
          const split=stored.indexOf(',');
          res.statusCode=200;
          res.setHeader('Content-Type',stored.slice(5,stored.indexOf(';')));
          res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
          return res.end(Buffer.from(stored.slice(split+1),'base64'));
        }
        const etag='"'+digest(revision+'|'+(person?.id || 'guest')+'|'+(person===admin ? admin.stamp : ''))+'"';
        res.setHeader('ETag',etag);
        if(req.headers['if-none-match']===etag) {res.statusCode=304;return res.end();}
        return json(res,200,{state:snapshot(data,revision,person,admin)});
      }
      const before=principal(data,token,admin);
      if(body.action==='logout' && !before && !body.actorId) {
        res.setHeader('Set-Cookie',cookie(''));
        return json(res,200,{result:null,state:snapshot(data,revision,null,admin)});
      }
      const prepared=await prepare(body,req,data);
      if (before && ['submitRecipe','resubmitRecipe'].includes(body.action) &&
        !(await repository.limit('submissions-'+before.id,30,3600))) fail(429,'Too many recipe submissions. Try again in an hour.');
      for(let retry=0;retry<7;retry++) {
        const person=principal(data,token,admin);
        if ('actorId' in body && body.action!=='signup' && body.action!=='login' && body.actorId!==(person?.id || null)) {
          fail(409,'The active account changed. Refresh and try again.','session_changed');
        }
        const changed=applyAction(data,body,{person,admin,prepared,token});
        if(Buffer.byteLength(JSON.stringify(data))>2800000) fail(507,'The workspace has reached its storage allowance.');
        if(await repository.commit(revision,data,changed.photos)) {
          const next=changed.session===undefined ? token : changed.session;
          if(changed.session!==undefined) res.setHeader('Set-Cookie',cookie(next));
          return json(res,200,{result:changed.value,state:snapshot(data,revision+1,principal(data,next,admin),admin)});
        }
        const latest=await repository.read();
        data=latest.data || emptyData(); revision=latest.revision;
      }
      fail(409,'The kitchen is busy. Refresh and try again.');
    } catch(error) {
      if(error instanceof KitchenError) return json(res,error.status,{error:error.message,code:error.code});
      return json(res,503,{error:'The shared kitchen is temporarily unavailable. Please try again.'});
    }
  };
}
