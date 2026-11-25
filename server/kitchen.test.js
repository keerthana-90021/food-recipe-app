import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { createKitchenHandler } from './kitchen.js';
import { MemoryRepository } from './memory.js';

const adminEmail='manager@workspace.test',adminPassword='private test administrator passphrase';
const password='signed in through the kitchen';
const form={title:'Ginger rice',description:'Ginger with warm rice.',cuisine:'Indian',diet:['Vegan'],time:22,servings:2,
  ingredients:['1 cup rice','1 tsp fresh ginger'],steps:['Cook the rice.','Stir in the ginger.']};

async function fixture(t) {
  const repository=new MemoryRepository();
  const handler=createKitchenHandler({repository,adminEmail,adminPassword,secureCookie:false});
  const origin='http://kitchen.test';
  const client=()=>{
    let cookie='';
    return async function request(body,path='/api/kitchen',headers={}) {
      const req=Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
      Object.assign(req,{method:body?'POST':'GET',url:path,headers:{origin,host:'kitchen.test','content-type':'application/json',cookie,...headers}});
      const response={headers:new Headers(),setHeader(name,value){this.headers.set(name,value);},end(value){this.body=value;}};
      await handler(req,response);
      const setCookie=response.headers.get('set-cookie');
      if(setCookie) cookie=setCookie.split(';')[0];
      const payload=response.headers.get('content-type')?.startsWith('application/json') ? JSON.parse(response.body) : null;
      return {status:response.statusCode,headers:response.headers,...payload};
    };
  };
  return {client,repository};
}
test('shared kitchen isolates pending submissions, feedback and photos, then revokes deleted accounts across browsers',async t=>{
  const {client,repository}=await fixture(t);
  const guest=client(),owner=client(),secondDevice=client(),admin=client();
  const first=await guest();
  assert.equal(first.status,200);assert.ok(first.state.recipes.length>30);assert.deepEqual(first.state.users,[]);
  assert.equal((await guest(null,'/api/kitchen',{'if-none-match':first.headers.get('etag')})).status,304);
  const email='cook@workspace.test';
  const signup=await owner({action:'signup',name:'Test Cook',email,password});
  assert.equal(signup.status,200);assert.equal(signup.state.user,null);
  assert.equal((await secondDevice({action:'login',email,password})).status,200);
  const signedIn=await owner({action:'login',email,password});
  const user=signedIn.state.user;
  assert.equal(user.role,'user');assert.ok(!JSON.stringify(signedIn.state).includes(password));
  assert.match(signedIn.headers.get('set-cookie'),/HttpOnly/);
  const buffer=await readFile(new URL('../public/images/smashed-cucumber-salad.webp',import.meta.url));
  const photo='data:image/webp;base64,'+buffer.toString('base64');
  const submit=await owner({action:'submitRecipe',input:{...form,photo}});
  assert.equal(submit.status,200);const {id,image,revision}=submit.result;
  assert.ok(submit.result.image.startsWith('/api/kitchen?'));assert.equal(revision,0);
  assert.equal((await guest()).state.recipes.some(row=>row.id===id),false);
  assert.equal((await guest(null,image)).status,404);assert.equal((await secondDevice(null,image)).status,200);
  assert.equal((await owner({action:'moderate',id,revision,status:'approved'})).status,403);
  await admin({action:'login',email:adminEmail,password:adminPassword});
  assert.equal((await admin()).state.users.length,2);
  assert.equal((await admin({action:'moderate',id,revision,status:'rejected'})).status,400);
  const reject=await admin({action:'moderate',id,revision,status:'rejected',note:'Add the ginger quantity.'});
  assert.equal(reject.result.reviewNote,'Add the ginger quantity.');
  const revised=await secondDevice({action:'resubmitRecipe',id,revision:reject.result.revision,input:form});
  assert.equal(revised.result.status,'pending');
  const [a,b]=await Promise.all([admin({action:'moderate',id,status:'approved',revision:revised.result.revision}),
    admin({action:'moderate',id,status:'approved',revision:revised.result.revision})]);
  assert.deepEqual([a.status,b.status].sort(),[200,409]);
  const publicDish=(await guest()).state.recipes.find(row=>row.id===id);
  assert.equal(publicDish.status,'approved');assert.equal((await guest(null,publicDish.image)).status,200);
  assert.equal((await guest(null,image)).status,404);
  await owner({action:'rate',recipeId:id,stars:5});await secondDevice({action:'rate',recipeId:id,stars:4});
  assert.deepEqual((await guest()).state.ratings[id],{average:4,count:1,mine:0});
  await owner({action:'setCollection',collectionId:'saved',recipeId:id,included:true});
  assert.ok((await secondDevice()).state.collections[0].recipeIds.includes(id));
  const remove=await admin({action:'deleteUser',id:user.id});
  assert.equal(remove.status,200);assert.ok(!remove.state.recipes.some(row=>row.id===id));
  assert.equal((await secondDevice()).state.user,null);assert.equal((await owner()).state.user,null);
  assert.equal((await guest(null,publicDish.image)).status,404);assert.equal(repository.photos.size,0);
  assert.equal((await owner({action:'login',email,password})).status,401);
});
test('editorial corrections persist and imports remain pending, distinct and idempotent',async t=>{
  const {client}=await fixture(t);const admin=client(),guest=client();
  await admin({action:'login',email:adminEmail,password:adminPassword});
  const sourceId='dish-test-local-item';
  const edited=await admin({action:'editRecipe',id:'tomato-pasta',revision:0,input:form});
  assert.equal(edited.result.authorId,'kitchen');assert.equal(edited.result.title,form.title);
  const imported=await admin({action:'importRecipe',sourceId,input:{...form,id:'tomato-pasta',status:'approved',author:'Old private author'}});
  assert.equal(imported.result.status,'pending');assert.equal(imported.result.author,'Kitchen Admin');
  assert.notEqual(imported.result.id,'tomato-pasta');assert.equal(imported.state.importedSourceIds[0],sourceId);
  const again=await admin({action:'importRecipe',sourceId,input:form});assert.equal(again.result.id,imported.result.id);
  const discover=await guest();assert.deepEqual(discover.state.importedSourceIds,[]);
  assert.equal(discover.state.recipes.find(row=>row.id==='tomato-pasta').title,form.title);
  const removed=await admin({action:'deleteRecipe',id:'tomato-pasta',revision:edited.result.revision});
  assert.equal(removed.state.recipes.some(row=>row.id==='tomato-pasta'),false);
  const deleteImport=await admin({action:'deleteRecipe',id:imported.result.id,revision:0});
  assert.deepEqual(deleteImport.state.importedSourceIds,[sourceId]);
  assert.equal((await admin({action:'importRecipe',sourceId,input:form})).status,409);
});
test('expired sessions change the snapshot tag and stale tabs must recheck their account',async t=>{
  const {client,repository}=await fixture(t);
  const admin=client();
  await admin({action:'login',email:adminEmail,password:adminPassword});
  const original=await admin();
  const originalTag=original.headers.get('etag');
  assert.equal((await admin(null,'/api/kitchen',{'if-none-match':originalTag})).status,304);
  for(const session of Object.values(repository.data.sessions)) session.until=Date.now()-1;
  const expired=await admin(null,'/api/kitchen',{'if-none-match':originalTag});
  assert.equal(expired.status,200);assert.equal(expired.state.user,null);
  assert.notEqual(expired.headers.get('etag'),originalTag);assert.deepEqual(expired.state.users,[]);
  const changed=await admin({action:'logout',actorId:original.state.user.id});
  assert.equal(changed.status,409);assert.equal(changed.code,'session_changed');
});
