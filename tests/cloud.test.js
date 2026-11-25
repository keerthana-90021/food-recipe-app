import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const bridge = readFileSync(new URL('../public/shared/cloud.js',import.meta.url),'utf8');
const seed = {id:'book',title:'Editorial recipe'};
const admin = {id:'owner',name:'Kitchen Owner',email:'owner@example.test',role:'admin'};
const member = {id:'cook',name:'Alex',email:'alex@example.test',role:'user'};
const snapshot = (user,extra = {}) => ({user,recipes:[seed],users:user?.role==='admin'?[admin,member]:[],
  collections:[],ratings:{book:{count:0,average:0,mine:0}},revision:1,...extra});
const ok = (state,result = null,tag = '') => Response.json({state,result},{headers:{ETag:tag}});
const issue = (status,error,code) => Response.json({error,code},{status});
function memory() {
  const items = new Map();
  return {get length(){return items.size;},key:i=>Array.from(items.keys())[i],getItem:k=>items.get(k) || null,
    setItem:(k,v)=>items.set(k,v),removeItem:k=>items.delete(k),items};
}
function fixture() {
  const calls = [], local = memory(), session = memory(), replies = [];
  const window = new EventTarget();
  window.KitchenSeeds = [seed];
  window.KitchenStore = {currentUser:()=>admin};
  vm.runInNewContext(bridge,{window,Event,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,
    document:new EventTarget(),navigator:{onLine:true},localStorage:local,sessionStorage:session,
    fetch(_url,options) {
      calls.push({body:options.body && JSON.parse(options.body),headers:options.headers});
      assert.ok(replies.length,'A request should have been expected');
      return Promise.resolve(replies.shift());
    }});
  const open = options => window.SupperclubCloud.createStore(options);
  return {open,store:open(),queue:reply=>replies.push(reply),calls,local,session,window};
}

test('only a fresh server snapshot grants access and an outage removes all private rows',async () => {
  const f=fixture(), {store}=f;
  f.local.setItem('supperclub.v1/session',JSON.stringify({email:admin.email}));
  assert.equal(store.currentUser(),null);
  assert.throws(()=>store.users(),/Administrator/);
  f.queue(ok(snapshot(admin,{recipes:[seed,{id:'pending',status:'pending'}]}),null,'"admin-r1"'));
  await store.refresh();
  assert.equal(store.currentUser().id,admin.id);
  f.queue(new Response(null,{status:304}));
  const events=[];
  f.window.addEventListener('supperclub:cloud',()=>events.push(store.service().phase));
  await store.refresh({background:true});
  assert.equal(f.calls.at(-1).headers['If-None-Match'],'"admin-r1"');
  assert.deepEqual(events,[]);
  f.queue(issue(503,'Shared store unavailable'));
  await assert.rejects(store.refresh(),/unavailable/);
  assert.equal(store.service().phase,'unavailable');
  assert.equal(store.currentUser(),null);
  assert.equal(store.recipes().some(r=>r.id==='pending'),false);
  assert.equal(store.rating('book').count,null);
  await assert.rejects(store.editRecipe('x',{},0),/Reconnect/);
  f.queue(ok(snapshot(null)));
  await store.refresh();
  assert.equal(f.calls.at(-1).headers['If-None-Match'],undefined);
  assert.equal(store.currentUser(),null);
});

test('old reads cannot resurrect an account after logout',async () => {
  const f=fixture(), {store}=f;
  f.queue(ok(snapshot(admin)));
  await store.refresh();
  let release;
  f.queue(new Promise(resolve=>{release=resolve;}));
  const stale=store.refresh();
  f.queue(ok(snapshot(null)));
  await store.logout();
  assert.equal(f.calls.at(-1).body.actorId,admin.id);
  release(ok(snapshot(admin)));
  await stale;
  assert.equal(store.currentUser(),null);
});

test('sign-in errors preserve the form and a signup hint survives only in its tab',async () => {
  const f=fixture(), {store}=f;
  f.queue(ok(snapshot(null)));
  await store.refresh();
  const password='sample passphrase for a test';
  f.queue(ok(snapshot(null),member));
  await store.signup(member.name, member.email,password);
  assert.equal(f.open().recentSignup().email,member.email);
  assert.equal([...f.local.items.values(),...f.session.items.values()].some(value=>value.includes(password)),false);
  f.queue(issue(401,'The email or password is incorrect.'));
  await assert.rejects(store.login(member.email,'wrong'),/incorrect/);
  assert.equal(store.service().phase,'ready');
  f.queue(ok(snapshot(member),member));
  await store.login(member.email,password);
  assert.equal(f.open().recentSignup(),null);
});

test('explicit import reads only recipe records, sends editable fields once, and honors tombstones',async () => {
  const f=fixture(), {store}=f;
  const sourceId='dish-'+'a'.repeat(32);
  f.local.setItem('supperclub.v1/accounts/old@example.test','private password record');
  f.local.setItem('supperclub.v1/recipes/'+sourceId,JSON.stringify({id:sourceId,title:'Tomato Rasam',author:'Original cook',
    diet:['Vegetarian'],time:22,servings:2,ingredients:['tomatoes'],steps:['Simmer.'],cuisine:'Indian',
    status:'approved',photo:'data:image/jpeg;base64,abcd',authorId:'private-id',email:'old@example.test'}));
  const actualGet=f.local.getItem;
  f.local.getItem = key => {assert.ok(!key.includes('/accounts/'));return actualGet(key);};
  assert.throws(()=>store.legacyCandidates(),/Administrator/);
  f.queue(ok(snapshot(admin)));
  await store.refresh();
  assert.equal(store.legacyCandidates()[0].originalAuthor,'Original cook');
  assert.equal(f.calls.length,1);
  f.queue(ok(snapshot(admin,{importedSourceIds:[sourceId]}),{id:'new-id'}));
  await store.importRecipe(sourceId);
  const sent=f.calls.at(-1).body;
  assert.equal(sent.action,'importRecipe');
  assert.equal(sent.input.title,'Tomato Rasam');
  assert.equal(sent.input.photo,'data:image/jpeg;base64,abcd');
  assert.equal(sent.sourceId,sourceId);
  for(const key of ['authorId','email','status','author']) assert.equal(Object.hasOwn(sent.input,key),false);
  assert.equal(store.legacyCandidates().length,0);
  await assert.rejects(store.importRecipe(sourceId),/already been imported/);
  assert.equal(f.calls.length,2);
});

test('the classroom edition keeps its local identity and sends no network calls',() => {
  const f=fixture();
  const classroom=f.open({offline:true});
  assert.equal(classroom.currentUser().id,admin.id);
  assert.equal(classroom.service().phase,'offline');
  assert.equal(classroom.start,undefined);
  assert.equal(f.calls.length,0);
});
