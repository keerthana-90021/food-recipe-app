import React, {useEffect, useReducer, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import Discover, {MotionPreference} from './Discover.jsx';
import RecipeDetail from './RecipeDetail.jsx';
import MealPlanner from './MealPlanner.jsx';
import {AuthPage, CollectionsPage, SubmitPage, AdminPage, SubmissionsPage} from './AccountPages.jsx';
import {Icon} from './Icons.jsx';
import {loginIntent, rememberIntent} from './loginIntent.js';
import {trackRecipeNavigation} from './routeNavigation.js';
import './supperclub.css';
import './service.css';

const localHost = ['localhost','127.0.0.1','[::1]'].includes(location.hostname) || location.hostname.endsWith('.test');
const classroom = new URLSearchParams(location.search).get('edition') === 'classroom';
const offline = classroom || location.protocol === 'file:' || (localHost && (
  new URLSearchParams(location.search).get('demo') === '1' ||
  (import.meta.env.DEV && import.meta.env.VITE_KITCHEN_MODE === 'offline')
));
const store = window.SupperclubCloud.createStore({offline});
window.KitchenStore = store;
const getRoute=()=>location.hash.slice(1).replace(/^\//,'') || 'discover';
const safeDecode=value=>{try{return decodeURIComponent(value);}catch{return '';}};
const defaultSearch={query:'',quick:'All recipes',cuisine:'',diet:'',sort:'featured',filtersOpen:false};
const privatePages=['collections','planner','submit','submissions','admin'];
function Brand() {
  return <a href="#discover" className="brand" aria-label="Supperclub home"><span className="brand-mark"><Icon name="bowl" size={26}/></span><span>Supperclub<span className="brand-period">.</span></span></a>;
}
function Header({user,go,route,onLogout}) {
  const [open,setOpen]=useState(false);
  const menuRef=useRef(null);
  const toggleRef=useRef(null);
  useEffect(()=>setOpen(false),[route,user?.id]);
  useEffect(()=>{
    if(!open)return;
    const outside=e=>{if(!menuRef.current?.contains(e.target))setOpen(false);};
    const escape=e=>{if(e.key==='Escape'){setOpen(false);toggleRef.current?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  const items=[['discover','Discover'],['collections','My cookbook'],['planner','Meal planner'],['submit','Submit a recipe']];
  const navLink=([key,label])=><a key={key} href={'#'+key} className={route===key?'current':''} aria-current={route===key?'page':undefined} onClick={e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey){e.preventDefault();setOpen(false);go(key);}}}>{label}</a>;
  return <header className="site-header"><div className="header-inner page-width">
    <Brand/><nav className="desktop-nav" aria-label="Main navigation">{items.map(navLink)}</nav>
    <div className="header-actions">
      {!user && <><button className="sign-in" onClick={()=>go('login')}>Sign in</button><button className="button join-button" aria-label="Join Supperclub" onClick={()=>go('signup')}>Join<span className="join-extra"> Supperclub</span></button></>}
      <div className={'account-menu'+(!user?' guest-menu':'')} ref={menuRef}>
        <button ref={toggleRef} className={user?'user-toggle':'mobile-toggle'} aria-expanded={open} aria-controls="account-nav" aria-label={user?'Open account menu':'Open navigation'} onClick={()=>setOpen(!open)}>{user?<><span className="avatar">{user.name[0].toUpperCase()}</span><span className="account-name">{user.name.split(' ')[0]}</span></>:<Icon name={open?'close':'menu'} size={22}/>}</button>
        {open && <nav className="menu-popup" id="account-nav" aria-label="Account navigation">{items.map(navLink)}
        {user ? <>{navLink(['submissions','My submissions'])}{user.role==='admin' && navLink(['admin','Admin dashboard'])}<button onClick={()=>{setOpen(false);onLogout();}}>Sign out</button></> : <>{navLink(['login','Sign in'])}{navLink(['signup','Join Supperclub'])}</>}</nav>}
      </div>
    </div>
  </div></header>;
}
function NotFound({go,message='This page could not be found.'}) {
  return <main className="page-width lost-page"><Icon name="book" size={40}/><h1>{message}</h1><button className="button green-button" onClick={()=>go('discover')}>Explore recipes</button></main>;
}
function ServiceGate({status,go}) {
  const waiting = status.phase === 'loading';
  return <main className="page-width service-gate" aria-busy={waiting}>
    <Icon name="bowl" size={40}/>
    <h1>{waiting ? 'Opening the shared kitchen…' : 'The shared kitchen is unavailable'}</h1>
    <p>{waiting ? 'Checking your session and loading the latest recipes.' : 'Accounts, submissions and reviews need a connection to the shared kitchen. You can still cook from the included recipe book.'}</p>
    {!waiting && status.error && <p role="status">{status.error}</p>}
    {!waiting && <div><button className="green-button button" onClick={()=>store.refresh().catch(()=>{})}>Try again</button><button className="outline-button button" onClick={()=>go('discover')}>Browse included recipes</button><a className="outline-button button" href="/review-1/">Open the local demo</a></div>}
  </main>;
}
function App() {
  const [route,setRoute]=useState(getRoute);
  const [notice,setNotice]=useState('');
  const [discoverState,setDiscoverState]=useState(defaultSearch);
  const [,refresh]=useReducer(n=>n+1,0);
  const timer=useRef();
  const notify=message=>{clearTimeout(timer.current);setNotice(message);timer.current=setTimeout(()=>setNotice(''),3400);};
  const [path,query='']=route.split('?');
  const [page,idPart='']=path.split('/');
  const status=store.service();
  const serviceReady=['ready','refreshing','offline'].includes(status.phase);
  const restricted=privatePages.includes(page) || page==='login' || page==='signup';
  const user=store.currentUser();
  const recipes=store.recipes();
  const denied=serviceReady && !user && privatePages.includes(page);
  const unauthorised=page==='admin' && user && user.role!=='admin';
  const go=target=>{const next=String(target||'discover').replace(/^#\/?/,'');location.hash=next;};
  const openRecipe=id=>go('recipe/'+encodeURIComponent(id));
  const requireLogin=()=>{rememberIntent(path);go('login');};
  const toggleSave=async id=>{
    if(!user){rememberIntent('recipe/'+encodeURIComponent(id),id);go('login');return;}
    try{const added=await store.save(id);refresh();notify(added?'Saved to your cookbook.':'Removed from saved recipes.');}catch(error){notify(error.message);}
  };
  const completeLogin = async person => {
    const intent = loginIntent();
    let message = 'Signed in as ' + person.name + '.';
    const destination = person.role === 'admin' ? 'admin'
      : intent?.page === 'admin' ? 'discover' : intent?.page || 'discover';
    rememberIntent(null);
    go(destination);
    if (intent?.saveId) {
      try {
        await store.setCollection('saved', intent.saveId, true);
        message = 'Recipe saved to your cookbook.';
      } catch (error) { message = error.message; }
    }
    refresh();
    notify(message);
  };
  useEffect(()=>{
    const stopNavigation=trackRecipeNavigation(setRoute,getRoute);
    const onStorage=()=>refresh();
    window.addEventListener('supperclub:cloud',onStorage);
    window.addEventListener('storage',onStorage);
    window.addEventListener('supperclub:session-expired',onStorage);
    const stopSync=store.start?.();
    return ()=>{stopNavigation();stopSync?.();window.removeEventListener('supperclub:cloud',onStorage);window.removeEventListener('storage',onStorage);window.removeEventListener('supperclub:session-expired',onStorage);clearTimeout(timer.current);};
  },[]);
  useEffect(()=>{
    if(!serviceReady)return;
    if(denied){rememberIntent(path);location.replace('#login');}
    else if(unauthorised){notify('Administrator access is required.');location.replace('#discover');}
    else if(user && ['login','signup'].includes(page) && ['login','signup'].includes(getRoute())){location.replace('#'+(user.role==='admin'?'admin':'discover'));}
    else if(!['login','signup'].includes(page)){rememberIntent(null);}
  },[serviceReady,denied,unauthorised,page,user?.id,route,path]);
  const props={mode:page,go,notify,user,refresh,openRecipe,completeLogin};
  let content, title='Discover recipes';
  if(restricted && !serviceReady){title='Shared kitchen';content=<ServiceGate {...{status,go}}/>;}
  else if(denied || unauthorised){content=<main className="page-width waiting-page">Opening your kitchen…</main>;}
  else if(page==='discover'){content=<Discover {...{recipes,openRecipe,toggleSave,discoverState,setDiscoverState}}/>;}
  else if(page==='recipe'){
    const recipeId=safeDecode(idPart), token=new URLSearchParams(query).get('shared');
    let recipe=recipes.find(r=>r.id===recipeId && r.status==='approved');
    if(!recipe && token){try{const snapshot=store.readShare(token);if(snapshot.id===recipeId)recipe=snapshot;}catch{/* Incomplete shares use the unavailable view. */}}
    title=recipe?.title||'Recipe unavailable';
    content=recipe?<RecipeDetail key={(user?.id || 'guest') + '/' + recipe.id + '/' + (recipe.revision || 0)} {...{recipe,token,go,toggleSave,notify,user,requireLogin,refresh}}/>:!serviceReady?<ServiceGate {...{status,go}}/>:<NotFound go={go} message="This recipe is unavailable."/>;
  }
  else if(['login','signup'].includes(page)){title=page==='login'?'Sign in':'Join Supperclub';content=<AuthPage key={page} {...props}/>;}
  else if(page==='collections'){title='My cookbook';content=<CollectionsPage key={user.id} {...props}/>;}
  else if(page==='planner'){title='Meal planner';content=<MealPlanner key={user.id} {...props}/>;}
  else if(page==='submit'){title=idPart?'Revise recipe':'Submit a recipe';content=<SubmitPage key={user.id+'/'+idPart} editId={safeDecode(idPart)} {...props}/>;}
  else if(page==='submissions'){title='My submissions';content=<SubmissionsPage key={user.id} {...props}/>;}
  else if(page==='admin'){title='Admin dashboard';content=<AdminPage key={user.id} {...props}/>;}
  else {title='Page unavailable';content=<NotFound go={go}/>;}
  useEffect(()=>{document.title=title+' · Supperclub';},[title]);
  return <><a className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();document.getElementById('main-content')?.focus();}}>Skip to content</a>
    <Header {...{user,go,route:page}} onLogout={async()=>{try{await store.logout();rememberIntent(null);go('discover');refresh();notify('You have signed out.');}catch(error){notify(error.message);}}}/>
    <div className="main-content" id="main-content" tabIndex="-1">
      {status.phase==='offline' && <aside className="kitchen-service-note"><strong>Browser-local classroom demo</strong> Accounts and recipes stay in this browser.{location.protocol !== 'file:' && <a href={location.pathname}>Open shared kitchen</a>}</aside>}
      {!restricted && !serviceReady && <aside className="kitchen-service-note" role="status">
        {status.phase==='loading' ? 'Connecting to the shared kitchen…' : 'Showing included recipes. The shared kitchen is temporarily unavailable.'}
        {status.phase==='unavailable' && <><button onClick={()=>store.refresh().catch(()=>{})}>Try again</button><a href="/review-1/">Open local demo</a></>}
      </aside>}
      <div className="route-surface" key={path}>{content}</div>
    </div>
    <footer className="site-footer"><div className="page-width"><Brand/><a href="#discover">Explore recipes</a><a href="#collections">My cookbook</a><MotionPreference/></div></footer>
    <div className={'toast'+(notice?' shown':'')} role="status" aria-live="polite">{notice}</div>
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
