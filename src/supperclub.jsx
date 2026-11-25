import React, {useEffect, useReducer, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import Discover from './Discover.jsx';
import RecipeDetail from './RecipeDetail.jsx';
import {AuthPage, CollectionsPage, SubmitPage, AdminPage, SubmissionsPage} from './AccountPages.jsx';
import {Icon} from './Icons.jsx';
import './supperclub.css';

const store=window.KitchenStore;
const getRoute=()=>location.hash.slice(1).replace(/^\//,'') || 'discover';
const safeDecode=value=>{try{return decodeURIComponent(value);}catch{return '';}};
const defaultSearch={query:'',quick:'All recipes',cuisine:'',diet:'',sort:'featured',filtersOpen:false};
const privatePages=['collections','submit','submissions','admin'];
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
  const items=[['discover','Discover'],['collections','My cookbook'],['submit','Submit a recipe']];
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
function App() {
  const [route,setRoute]=useState(getRoute);
  const [notice,setNotice]=useState('');
  const [returnTo,setReturnTo]=useState(null);
  const [discoverState,setDiscoverState]=useState(defaultSearch);
  const [,refresh]=useReducer(n=>n+1,0);
  const timer=useRef();
  const notify=message=>{clearTimeout(timer.current);setNotice(message);timer.current=setTimeout(()=>setNotice(''),3400);};
  const [path,query='']=route.split('?');
  const [page,idPart='']=path.split('/');
  const user=store.currentUser();
  const recipes=store.recipes();
  const denied=!user && privatePages.includes(page);
  const unauthorised=page==='admin' && user && user.role!=='admin';
  const go=target=>{const next=String(target||'discover').replace(/^#\/?/,'');location.hash=next;};
  const openRecipe=id=>go('recipe/'+encodeURIComponent(id));
  const requireLogin=()=>{setReturnTo(route);go('login');};
  const toggleSave=id=>{
    if(!user){setReturnTo('recipe/'+encodeURIComponent(id));go('login');return;}
    try{const added=store.save(id);refresh();notify(added?'Saved to your cookbook.':'Removed from saved recipes.');}catch(error){notify(error.message);}
  };
  useEffect(()=>{
    const onRoute=()=>{setRoute(getRoute());window.scrollTo(0,0);};
    const onStorage=()=>refresh();
    window.addEventListener('hashchange',onRoute);window.addEventListener('storage',onStorage);
    return ()=>{window.removeEventListener('hashchange',onRoute);window.removeEventListener('storage',onStorage);clearTimeout(timer.current);};
  },[]);
  useEffect(()=>{
    if(denied){setReturnTo(route);location.replace('#login');}
    else if(unauthorised){notify('Administrator access is required.');location.replace('#discover');}
    else if(user && ['login','signup'].includes(page)){location.replace('#'+(user.role==='admin'?'admin':returnTo||'discover'));}
    else if(user && returnTo && !['login','signup'].includes(page)){setReturnTo(null);}
  },[denied,unauthorised,page,user?.id,returnTo,route]);
  const props={mode:page,go,notify,user,refresh,openRecipe,returnTo};
  let content, title='Discover recipes';
  if(denied || unauthorised){content=<main className="page-width waiting-page">Opening your kitchen…</main>;}
  else if(page==='discover'){content=<Discover {...{recipes,openRecipe,toggleSave,discoverState,setDiscoverState}}/>;}
  else if(page==='recipe'){
    const recipeId=safeDecode(idPart), token=new URLSearchParams(query).get('shared');
    let recipe=recipes.find(r=>r.id===recipeId && r.status==='approved');
    if(!recipe && token){try{const snapshot=store.readShare(token);if(snapshot.id===recipeId)recipe=snapshot;}catch{/* Incomplete shares use the unavailable view. */}}
    title=recipe?.title||'Recipe unavailable';
    content=recipe?<RecipeDetail key={recipe.id} {...{recipe,token,go,toggleSave,notify,user,requireLogin,refresh}}/>:<NotFound go={go} message="This recipe is unavailable."/>;
  }
  else if(['login','signup'].includes(page)){title=page==='login'?'Sign in':'Join Supperclub';content=<AuthPage key={page} {...props}/>;}
  else if(page==='collections'){title='My cookbook';content=<CollectionsPage {...props}/>;}
  else if(page==='submit'){title='Submit a recipe';content=<SubmitPage {...props}/>;}
  else if(page==='submissions'){title='My submissions';content=<SubmissionsPage {...props}/>;}
  else if(page==='admin'){title='Admin dashboard';content=<AdminPage {...props}/>;}
  else {title='Page unavailable';content=<NotFound go={go}/>;}
  useEffect(()=>{document.title=title+' · Supperclub';},[title]);
  return <><a className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();document.getElementById('main-content')?.focus();}}>Skip to content</a>
    <Header {...{user,go,route:page}} onLogout={()=>{try{store.logout();setReturnTo(null);go('discover');refresh();notify('You have signed out.');}catch(error){notify(error.message);}}}/>
    <div className="main-content" id="main-content" tabIndex="-1">{content}</div>
    <footer className="site-footer"><div className="page-width"><Brand/><a href="#discover">Explore recipes</a><a href="#collections">My cookbook</a></div></footer>
    <div className={'toast'+(notice?' shown':'')} role="status" aria-live="polite">{notice}</div>
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
