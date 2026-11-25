import { createHash,randomBytes,randomUUID } from 'node:crypto';
import { seeds,seedById } from './catalog.js';
import { fail,text,integer,fields,imageUrl,setPhoto } from './validation.js';

export const digest = value => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const own = (map,k) => typeof k === 'string' && Object.hasOwn(map,k) ? map[k] : null;
export function emptyData() {
  return {accounts:{},sessions:{},recipes:{},collections:{},ratings:{},imports:{}};
}
function accountView(account) {
  const {id,name,email,role,createdAt} = account;
  return {id,name,email,role,createdAt};
}
export function principal(db,token,admin) {
  if (!token) return null;
  const session=own(db.sessions,digest(token));
  if (!session || session.until<=Date.now()) return null;
  if (session.id===admin.id) return session.stamp===admin.stamp ? admin : null;
  return own(db.accounts,session.id);
}
export function findRecipe(db,id) {
  const row = own(db.recipes,id);
  if (row) return row.deleted ? null : row;
  return seedById.get(id) || null;
}
export function visible(row,person) {
  return row && (row.status==='approved' || person?.role==='admin' || person?.id===row.authorId);
}
function rows(db) {
  const editorial = seeds.map(seed => findRecipe(db,seed.id)).filter(Boolean);
  return editorial.concat(Object.values(db.recipes).filter(row => !row.deleted && !seedById.has(row.id)));
}
function publicDish(row) {
  const {photoKey,...recipe} = row;
  recipe.image=imageUrl(row);
  return recipe;
}
function groups(db,person) {
  return own(db.collections,person.id) || [{id:'saved',name:'Saved recipes',recipeIds:[]}];
}
function score(db,row,person) {
  const votes=own(db.ratings,row.id) || {};
  const scores=Object.values(votes);
  const baseCount=Number(row.baseCount)||0;
  const count=baseCount+scores.length;
  const sum=scores.reduce((a,b)=>a+b,baseCount*(Number(row.baseRating)||0));
  return {average:count ? Math.round(sum/count*10)/10 : 0,count,mine:person ? own(votes,person.id)||0 : 0};
}
export function snapshot(db,revision,person,admin) {
  const visibleRows=rows(db).filter(row => visible(row,person));
  const published=new Set(visibleRows.filter(row=>row.status==='approved').map(row=>row.id));
  return {revision,user:person ? accountView(person) : null,
    users:person?.role==='admin' ? [admin,...Object.values(db.accounts)].map(accountView) : [],
    importedSourceIds:person?.role==='admin' ? Object.values(db.imports).map(entry=>entry.sourceId) : [],
    recipes:visibleRows.map(publicDish),
    collections:person ? groups(db,person).map(group=>({...group,recipeIds:group.recipeIds.filter(id=>published.has(id))})) : [],
    ratings:Object.fromEntries(visibleRows.map(row=>[row.id,score(db,row,person)]))
  };
}
function requireUser(person) { if (!person) fail(401,'Sign in to continue.'); }
function requireAdmin(person) { requireUser(person); if (person.role!=='admin') fail(403,'Administrator access is required.'); }
function currentRevision(row,revision) {
  if (!row) fail(404,'This recipe is unavailable.');
  if (revision!==row.revision) fail(409,'This recipe changed. Refresh it before trying again.');
}
function published(db,id) {
  const row=findRecipe(db,id);
  if (!row || row.status!=='approved') fail(404,'This recipe is unavailable.');
  return row;
}
function eraseDish(db,row,photos) {
  if (row.photoKey) photos.remove.push(row.photoKey);
  if (seedById.has(row.id)) db.recipes[row.id]={id:row.id,deleted:true};
  else delete db.recipes[row.id];
  delete db.ratings[row.id];
  for (const list of Object.values(db.collections)) {
    for (const item of list) item.recipeIds=item.recipeIds.filter(id=>id!==row.id);
  }
}
const freshId = stem => stem+randomUUID().replaceAll('-','');
export function applyAction(db,body,ctx) {
  const {person,admin,prepared,token} = ctx;
  const photos={remove:[]};
  const result=(value,session) => ({value,photos,session});
  const {action,input,id,revision}=body;
  if (action==='signup') {
    if (prepared.email===admin.email || prepared.email==='admin@supperclub.test' || Object.values(db.accounts).some(user=>user.email===prepared.email)) {
      fail(409,'An account with this email already exists. Sign in instead.');
    }
    const user={id:freshId('user-'),name:prepared.name,email:prepared.email,role:'user',createdAt:now(),password:prepared.password};
    db.accounts[user.id]=user;
    return result(accountView(user));
  }
  if (action==='login') {
    const account=prepared.accountId===admin.id ? admin : own(db.accounts,prepared.accountId);
    if (!account || (account!==admin && account.password!==prepared.verifier)) fail(401,'The email or password is incorrect.');
    for (const [key,session] of Object.entries(db.sessions)) if (session.until<=Date.now()) delete db.sessions[key];
    if (token) delete db.sessions[digest(token)];
    const sessionToken=randomBytes(32).toString('hex');
    db.sessions[digest(sessionToken)]={id:account.id,until:Date.now()+8*60*60*1000,...(account===admin?{stamp:admin.stamp}:{})};
    return result(accountView(account),sessionToken);
  }
  if (action==='logout') { if(token) delete db.sessions[digest(token)]; return result(null,''); }
  requireUser(person);
  if (action==='submitRecipe' || action==='importRecipe') {
    let source;
    if (action==='importRecipe') {
      requireAdmin(person);
      if (typeof body.sourceId!=='string' || !/^[a-z\d_-]{1,100}$/i.test(body.sourceId)) fail(400,'Choose one local submission to import.');
      source=digest(body.sourceId);
      if (db.imports[source]) {
        const existing=findRecipe(db,db.imports[source].id);
        if (!existing) fail(409,'This previously imported submission was deleted.');
        return result(publicDish(existing));
      }
    }
    const details=fields(input);
    const row={...details,id:freshId('dish-'),author:person.name,authorId:person.id,status:'pending',image:'',createdAt:now(),revision:0};
    setPhoto(row,input,photos);
    db.recipes[row.id]=row;
    if(source) db.imports[source]={id:row.id,sourceId:body.sourceId};
    return result(publicDish(row));
  }
  if (['editRecipe','resubmitRecipe','moderate','deleteRecipe'].includes(action)) {
    if(action!=='resubmitRecipe') requireAdmin(person);
    const old=findRecipe(db,id);
    if(action==='resubmitRecipe' && (old?.authorId!==person.id || old?.status!=='rejected')) fail(403,'Only the author can revise a declined recipe.');
    currentRevision(old,revision);
    if (action==='deleteRecipe') { eraseDish(db,old,photos); return result(true); }
    const row={...old,revision:old.revision+1,updatedAt:now()};
    if (action==='moderate') {
      if (old.authorId==='kitchen' || !['approved','rejected'].includes(body.status)) fail(400,'Choose a community submission to approve or decline.');
      if (old.status===body.status) fail(409,'This submission already has that review decision.');
      row.reviewNote=body.status==='rejected' ? text(body.note,'feedback for the cook',400) : '';
      row.status=body.status;
      row.reviewedAt=now();
    } else {
      Object.assign(row,fields(input));
      // The old served URL is also an unchanged preview.
      if (!(input.photo===undefined && input.image===imageUrl(old))) setPhoto(row,input,photos);
      if (action==='resubmitRecipe') row.status='pending';
    }
    db.recipes[id]=row;
    return result(publicDish(row));
  }
  if (action==='deleteUser') {
    requireAdmin(person);
    if(id===admin.id) fail(403,'The workspace administrator must remain active.');
    if(!own(db.accounts,id)) fail(404,'This account no longer exists.');
    delete db.accounts[id]; delete db.collections[id];
    for (const [key,value] of Object.entries(db.sessions)) if (value.id===id) delete db.sessions[key];
    for (const votes of Object.values(db.ratings)) delete votes[id];
    for (const row of Object.values(db.recipes)) if (row.authorId===id) eraseDish(db,row,photos);
    return result(true);
  }
  if (action==='createCollection') {
    const name=text(body.name,'a collection name',60), list=groups(db,person);
    if (list.some(item=>item.name.toLowerCase()===name.toLowerCase())) fail(409,'You already have a collection with that name.');
    const item={id:freshId('list-'),name,recipeIds:[]};
    db.collections[person.id]=[...list,item];
    return result(item);
  }
  if(action==='setCollection') {
    const list=groups(db,person), item=list.find(group=>group.id===body.collectionId);
    if(!item) fail(404,'Collection not found.');
    if(typeof body.included!=='boolean') fail(400,'Choose whether to include this recipe.');
    const ids=new Set(item.recipeIds);
    if(body.included) {published(db,body.recipeId);ids.add(body.recipeId);} else ids.delete(body.recipeId);
    item.recipeIds=[...ids];
    db.collections[person.id]=list;
    return result(body.included);
  }
  if(action==='rate') {
    const row=published(db,body.recipeId),stars=integer(body.stars,'the star rating',5);
    const votes=own(db.ratings,row.id) || {};
    votes[person.id]=stars;
    db.ratings[row.id]=votes;
    return result(score(db,row,person));
  }
  fail(400,'Unknown kitchen action.');
}
