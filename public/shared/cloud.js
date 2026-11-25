/* The final-review app reads identity and published content from the same-origin API.
   The independent HTML review edition continues to load its local store directly. */
(() => {
  'use strict';

  const endpoint = '/api/kitchen';
  const signalKey = 'supperclub.cloud/change';
  const recipePrefix = 'supperclub.v1/recipes/';
  const inputKeys = ['title','description','cuisine','category','protein','diet','time','servings','ingredients','steps'];
  const offlineStatus = Object.freeze({phase:'offline',error:'',updatedAt:0,lastSuccessAt:0});

  function createStore({offline = false} = {}) {
    if (offline) return Object.freeze({...window.KitchenStore,mode:'offline',service:()=>offlineStatus});
    let state = null;
    let etag = '';
    let health = {phase:'loading',error:'',updatedAt:0,lastSuccessAt:0};
    let readRequest = null;
    let writing = false;
    let generation = 0;
    let refreshAfterWrite = false;
    let signupReceipt = null;
    const receiptKey = 'supperclub.cloud/signup-receipt';
    try {
      const receipt = JSON.parse(sessionStorage.getItem(receiptKey));
      if (typeof receipt?.name === 'string' && typeof receipt.email === 'string') signupReceipt = receipt;
    } catch { /* A signup hint is optional. */ }
    function rememberSignup(receipt) {
      signupReceipt = receipt;
      try {
        if (receipt) sessionStorage.setItem(receiptKey,JSON.stringify(receipt));
        else sessionStorage.removeItem(receiptKey);
      } catch { /* Keep the confirmed receipt in memory in restricted browsers. */ }
    }
    const seeds = (window.KitchenSeeds || []).map(recipe => ({...recipe,authorId:'kitchen',status:'approved'}));

    function update(phase,error = '',silent = false) {
      const now = Date.now();
      health = {phase,error,updatedAt:now,lastSuccessAt:phase === 'ready' ? now : health.lastSuccessAt};
      if (!silent) window.dispatchEvent(new Event('supperclub:cloud'));
    }
    const currentUser = () => state?.user || null;
    const service = () => health;

    async function request(body,tag) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(),18000);
      try {
        const response = await fetch(endpoint,{
          method:body ? 'POST' : 'GET',credentials:'same-origin',cache:'no-store',
          headers:body ? {'Content-Type':'application/json',Accept:'application/json'} :
            {Accept:'application/json',...(tag ? {'If-None-Match':tag} : {})},
          body:body ? JSON.stringify(body) : undefined,signal:controller.signal
        });
        if (!body && tag && response.status === 304) return {unchanged:true};
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.state) {
          const err = new Error(typeof data?.error === 'string' ? data.error : 'The shared kitchen could not be reached.');
          err.status = response.ok ? 502 : response.status;
          err.code = data?.code;
          throw err;
        }
        const next = data.state;
        if (!Array.isArray(next.recipes) || !Array.isArray(next.collections) || !Array.isArray(next.users) ||
            !next.ratings || typeof next.ratings !== 'object' || !Object.hasOwn(next,'user') ||
            (next.user !== null && (!next.user?.id || !next.user?.name || !['user','admin'].includes(next.user.role)))) {
          throw new Error('The shared kitchen returned an incomplete response.');
        }
        return {...data,etag:response.headers.get('ETag') || ''};
      } catch (error) {
        if (error.status || error.message === 'The shared kitchen returned an incomplete response.') throw error;
        throw new Error('The shared kitchen could not be reached. Check your connection and try again.');
      } finally {clearTimeout(timer);}
    }

    function forget() {
      state = null;
      etag = '';
      readRequest = null;
      generation++;
    }
    function unavailable(error) {
      forget();
      update('unavailable',error.message);
    }
    function refresh({verifySession = false,background = false} = {}) {
      if (verifySession) {forget();update('loading');}
      if (writing) {refreshAfterWrite = true;return Promise.resolve();}
      if (readRequest) return readRequest;
      const own = ++generation;
      if (!background || !state) update(state ? 'refreshing' : 'loading');
      readRequest = request(undefined,state ? etag : '').then(data => {
        if (own !== generation) return;
        if (!data.unchanged) {state = data.state;etag = data.etag;}
        update('ready','',background && data.unchanged && health.phase === 'ready');
      }).catch(error => {
        if (own !== generation) return;
        unavailable(error);
        throw error;
      }).finally(() => {if (own === generation) readRequest = null;});
      return readRequest;
    }
    function announce(action) {
      try {
        const identity = ['login','logout','deleteUser'].includes(action);
        localStorage.setItem(signalKey,JSON.stringify({identity,stamp:Date.now(),nonce:Math.random()}));
      } catch { /* Focus and polling also recheck the server. */ }
    }
    function start() {
      const check = options => refresh(options).catch(() => {});
      function active() {if (!document.hidden) check({background:true});}
      function visibility() {
        if (!document.hidden) check({background:true,verifySession:!!state?.user && Date.now() - health.lastSuccessAt > 25000});
      }
      function disconnected() {unavailable(new Error('Your browser is offline.'));}
      function restored(event) {if (event.persisted) check({verifySession:true});}
      function changed(event) {
        if (event.key !== signalKey) return;
        try {check({verifySession:JSON.parse(event.newValue)?.identity === true});} catch {check();}
      }
      const tick = setInterval(() => {
        const delay = state?.user?.role === 'admin' ? 6000 : state?.user || !state ? 15000 : 45000;
        if (navigator.onLine !== false && Date.now() - health.updatedAt >= delay) active();
      },1000);
      window.addEventListener('focus',active);
      window.addEventListener('online',active);
      window.addEventListener('offline',disconnected);
      window.addEventListener('pageshow',restored);
      window.addEventListener('storage',changed);
      document.addEventListener('visibilitychange',visibility);
      check();
      return () => {
        clearInterval(tick);
        window.removeEventListener('focus',active);
        window.removeEventListener('online',active);
        window.removeEventListener('offline',disconnected);
        window.removeEventListener('pageshow',restored);
        window.removeEventListener('storage',changed);
        document.removeEventListener('visibilitychange',visibility);
      };
    }
    async function mutate(action,fields = {}) {
      if (!state) throw new Error('Reconnect to the shared kitchen before making changes.');
      if (writing) throw new Error('Please wait for your current change to finish.');
      writing = true;
      readRequest = null;
      const own = ++generation;
      try {
        const data = await request({action,...fields,actorId:currentUser()?.id || null});
        if (own !== generation) {
          refreshAfterWrite = true;
          throw Object.assign(new Error('Your session changed in another tab. Check the latest kitchen before continuing.'),{status:409});
        }
        state = data.state;
        etag = data.etag;
        update('ready');
        announce(action);
        return data.result;
      } catch (error) {
        const status = error.status || 0;
        if (!status || status >= 500) unavailable(error);
        else if (error.code === 'session_changed' || ([401,403].includes(status) && (state?.user || action !== 'login'))) {
          forget();update('loading');refreshAfterWrite = true;
        }
        else if ([404,409].includes(status)) refreshAfterWrite = true;
        else if (state && health.phase === 'refreshing') update('ready');
        throw error;
      } finally {
        writing = false;
        if (refreshAfterWrite) {refreshAfterWrite = false;refresh().catch(() => {});}
      }
    }
    function requireAdmin() {
      if (currentUser()?.role !== 'admin') throw new Error('Administrator access is required.');
    }
    // Never enumerate account records or send historical credentials to the API.
    function legacyCandidates() {
      requireAdmin();
      const found = [];
      const migrated = new Set(state.importedSourceIds || []);
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.startsWith(recipePrefix)) continue;
          const sourceId = key.slice(recipePrefix.length);
          if (!/^dish-[a-f0-9]{32}$/.test(sourceId) || migrated.has(sourceId)) continue;
          let item;
          try {item = JSON.parse(localStorage.getItem(key));} catch {continue;}
          if (item?.id !== sourceId || typeof item.title !== 'string' || !item.title.trim() ||
              !Array.isArray(item.steps) || !Array.isArray(item.ingredients)) continue;
          const recipe = Object.fromEntries(inputKeys.filter(prop => Object.hasOwn(item,prop)).map(prop => [prop,item[prop]]));
          const photo = [item.photo,item.image].find(value => typeof value === 'string' && /^data:image\/(?:jpeg|png|webp);base64,/.test(value));
          if (photo) recipe.photo = photo;
          found.push({sourceId,recipe,originalAuthor:typeof item.author === 'string' ? item.author.trim().slice(0,80) : ''});
        }
      } catch { /* Local storage access is optional. */ }
      return found.sort((a,b) => a.recipe.title.localeCompare(b.recipe.title));
    }
    async function importRecipe(sourceId) {
      const candidate = legacyCandidates().find(item => item.sourceId === sourceId);
      if (!candidate) throw new Error('This local recipe is unavailable or has already been imported.');
      return mutate('importRecipe',{sourceId,input:candidate.recipe});
    }
    const collections = () => state?.collections || [];
    const isSaved = id => collections().some(list => list.id === 'saved' && list.recipeIds.includes(id));
    const setCollection = (collectionId,recipeId,included) => mutate('setCollection',{collectionId,recipeId,included});
    return Object.freeze({
      mode:'cloud',service,start,refresh,currentUser,passwordMinLength:15,
      users() {requireAdmin();return state.users;},
      recipes:() => state?.recipes || seeds,
      recentSignup:() => signupReceipt,
      async signup(name,email,password) {
        const person = await mutate('signup',{name,email,password});
        rememberSignup({name:name.trim(),email:email.trim().toLowerCase()});
        return person;
      },
      async login(email,password) {
        await mutate('login',{email,password});
        rememberSignup(null);
        if (!currentUser()) throw new Error('The server could not confirm this sign-in.');
        return currentUser();
      },
      async logout() {await mutate('logout');rememberSignup(null);},
      submitRecipe:input => mutate('submitRecipe',{input}),
      resubmitRecipe:(id,input,revision) => mutate('resubmitRecipe',{id,input,revision}),
      moderate:(id,status,note,revision) => mutate('moderate',{id,status,note,revision}),
      editRecipe:(id,input,revision) => mutate('editRecipe',{id,input,revision}),
      deleteRecipe:(id,revision) => mutate('deleteRecipe',{id,revision}),
      deleteUser:id => mutate('deleteUser',{id}),
      legacyCandidates,importRecipe,collections,isSaved,setCollection,
      createCollection:name => mutate('createCollection',{name}),
      async save(recipeId) {const included = !isSaved(recipeId);await setCollection('saved',recipeId,included);return included;},
      rating:id => state?.ratings[id] || {average:null,count:null,mine:null},
      rate:(recipeId,stars) => mutate('rate',{recipeId,stars}),
      shareToken:() => '',
      readShare() {throw new Error('Open a published recipe link to view the current shared edition.');}
    });
  }
  window.SupperclubCloud = Object.freeze({createStore});
})();
