import React, {useEffect, useRef, useState} from 'react';
import {Icon} from './Icons.jsx';
import {FoodImage} from './Discover.jsx';
import PhotoInput from './PhotoInput.jsx';
import './admin.css';

const tabs = [['queue','Queue','chef'], ['catalog','Catalog','book'], ['users','Users','users']];
const labels = {pending:'In review', approved:'Published', rejected:'Declined'};
const standardDiets = ['Vegetarian','Vegan','Non-vegetarian','Contains egg','Gluten-free','Dairy-free'];
const normalize = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim();
const toLines = value => String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const isSeed = recipe => (window.KitchenSeeds || []).some(seed => seed.id === recipe.id);
const getMessage = error => error?.message || 'The service could not complete that request. Try again.';

function WorkspaceDialog({title, busy, close, children}) {
  const element = useRef(null);
  useEffect(() => {
    const dialog = element.current;
    dialog.showModal();
    return () => { dialog.close(); };
  }, []);
  return <dialog className="ad-dialog" ref={element} aria-labelledby="ad-dialog-title"
    onCancel={event => {event.preventDefault(); if (!busy) close();}}>
    <div className="ad-dialog-header"><h2 id="ad-dialog-title">{title}</h2>
      <button className="ad-close" type="button" autoFocus disabled={busy} aria-label="Close dialog" onClick={close}><Icon name="close"/></button>
    </div>
    {children}
  </dialog>;
}

function EditRecipe({recipe, run, busy, close}) {
  const [photoMode, setPhotoMode] = useState('keep');
  const [uploaded, setUploaded] = useState('');
  const [processing, setProcessing] = useState(false);
  const [validation, setValidation] = useState('');
  const seeds = (window.KitchenSeeds || []).filter(seed => seed.image).slice().sort((a,b) => a.title.localeCompare(b.title));
  const [catalogImage, setCatalogImage] = useState(() => seeds.some(seed => seed.image === recipe.image) ? recipe.image : '');
  const preview = photoMode === 'keep' ? recipe : photoMode === 'catalog' ? seeds.find(seed => seed.image === catalogImage) : null;
  async function submit(event) {
    event.preventDefault();
    if (processing || busy) return;
    const form = new FormData(event.currentTarget);
    if (photoMode === 'upload' && !uploaded) {setValidation('Choose an image to upload before saving.'); return;}
    const input = {
      title:form.get('title'), description:form.get('description'), cuisine:form.get('cuisine'),
      category:form.get('category'), protein:form.get('protein'), time:Number(form.get('time')), servings:Number(form.get('servings')),
      diet:form.getAll('diet'), ingredients:toLines(form.get('ingredients')), steps:toLines(form.get('steps'))
    };
    if (photoMode === 'catalog') input.image = form.get('image');
    if (photoMode === 'upload') input.photo = uploaded;
    if (photoMode === 'remove') input.photo = '';
    setValidation('');
    await run(() => window.KitchenStore.editRecipe(recipe.id, input, recipe.revision || 0), 'Recipe updated.', close);
  }
  return <form className="ac-form ad-edit-form" onSubmit={submit}>
    <fieldset disabled={busy} className="ad-form-fields">
      <label>Recipe name<input name="title" required maxLength="100" defaultValue={recipe.title}/></label>
      <label>Description<textarea name="description" maxLength="600" rows={2} defaultValue={recipe.description}/></label>
      <div className="ad-fields-pair">
        <label>Cuisine<input name="cuisine" required maxLength="60" defaultValue={recipe.cuisine}/></label>
        <label>Meal category<input name="category" maxLength="60" defaultValue={recipe.category}/></label>
        <label>Total time (minutes)<input name="time" type="number" min="1" max="1440" required defaultValue={recipe.time}/></label>
        <label>Servings<input name="servings" type="number" min="1" max="50" required defaultValue={recipe.servings}/></label>
      </div>
      <label>Primary protein <small>(optional)</small><input name="protein" maxLength="60" defaultValue={recipe.protein} placeholder="e.g. Chicken or tofu"/></label>
      <fieldset className="ad-diet-options"><legend>Dietary preferences</legend>
        {[...new Set([...standardDiets, ...(recipe.diet || [])])].map(label => <label key={label}>
          <input type="checkbox" name="diet" value={label} defaultChecked={recipe.diet?.includes(label)}/>{label}
        </label>)}
      </fieldset>
      <label>Ingredients<small>One ingredient and quantity per line.</small><textarea name="ingredients" required rows={4} defaultValue={recipe.ingredients.join('\n')}/></label>
      <label>Preparation steps<small>One step per line, in cooking order.</small><textarea name="steps" required rows={5} defaultValue={recipe.steps.join('\n')}/></label>
      <label>Photo action<select aria-label="Photo action" value={photoMode} onChange={event => {setPhotoMode(event.target.value); setProcessing(false); setValidation('');}}>
        <option value="keep">Keep current photo</option><option value="catalog">Use a catalog photo</option>
        <option value="upload">Upload a photo</option>{(recipe.image || recipe.photo) && <option value="remove">Remove photo</option>}
      </select></label>
      {photoMode === 'catalog' && <label>Catalog photo<select name="image" aria-label="Catalog photo" required value={catalogImage} onChange={event => setCatalogImage(event.target.value)}>
        <option value="" disabled>Choose a dish photo</option>{seeds.map(seed => <option key={seed.id} value={seed.image}>{seed.title}</option>)}
      </select></label>}
      {preview && (preview.image || preview.photo) && <figure className="ad-photo-preview"><FoodImage recipe={preview} eager/>
        <figcaption>{photoMode === 'keep' ? 'Current photo' : 'Selected photo'}</figcaption></figure>}
      {photoMode === 'upload' && <PhotoInput value={uploaded} onChange={setUploaded} onBusyChange={setProcessing}/>}
    </fieldset>
    {validation && <p className="ac-error" role="alert">{validation}</p>}
    <div className="ad-dialog-actions"><button type="button" className="ac-button ac-outline" onClick={close} disabled={busy}>Cancel</button>
      <button className="ac-button" disabled={processing || busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
  </form>;
}

function ConfirmDelete({target, run, close, busy}) {
  const [answer, setAnswer] = useState('');
  const deletingUser = target.type === 'deleteUser';
  const entry = target.entry;
  const exact = deletingUser ? entry.email : entry.title;
  const name = deletingUser ? 'user' : 'recipe';
  const submit = event => {
    event.preventDefault();
    if (answer !== exact) return;
    run(() => deletingUser ? window.KitchenStore.deleteUser(entry.id)
      : window.KitchenStore.deleteRecipe(entry.id, entry.revision || 0), deletingUser ? 'User deleted.' : 'Recipe deleted.', close);
  };
  return <form className="ac-form" onSubmit={submit}>
    <p>{deletingUser ? 'Deleting this account removes its recipes, ratings and collections and signs it out on all devices.' : 'This removes the recipe from the catalog and cookbook collections.'}</p>
    <label>{deletingUser ? 'Email to confirm' : 'Recipe title'}<small>Type <strong>{exact}</strong> to confirm.</small>
      <input required value={answer} aria-label={deletingUser ? 'Email to confirm' : 'Recipe title'} autoComplete="off" onChange={e => setAnswer(e.target.value)} disabled={busy}/></label>
    <div className="ad-dialog-actions"><button className="ac-button ac-outline" type="button" disabled={busy} onClick={close}>Cancel</button>
      <button className="ac-button ad-danger" disabled={busy || answer !== exact}>Delete {name}</button></div>
  </form>;
}

function RecipeRow({recipe, queue, online, busy, run, selectAction, openRecipe, RecipePreview, Status}) {
  const store = window.KitchenStore;
  const editorial = isSeed(recipe);
  const moderate = (status, note = '') => run(
    () => store.moderate(recipe.id, status, note, recipe.revision || 0),
    status === 'approved' ? 'Recipe published to Discover.' : 'Feedback sent to the cook.'
  );
  return <details className="ac-review ad-recipe">
    <summary>
      <span className="ad-recipe-intro"><span className="ad-thumb" aria-hidden="true">{recipe.image || recipe.photo
        ? <FoodImage recipe={recipe}/> : <Icon name="chef"/>}</span>
        <span><strong>{recipe.title}</strong><small>{queue ? 'Submitted by ' + (recipe.author || 'Community cook') : recipe.cuisine + ' · ' + (editorial ? 'Editorial' : 'Community')}</small></span>
      </span><Status status={recipe.status}/>
    </summary>
    <div className="ad-open-row"><RecipePreview recipe={recipe}/>
      {recipe.reviewNote && <p className="ac-review-note"><strong>Reviewer feedback</strong>{recipe.reviewNote}</p>}
      <div className="ad-row-actions">
        {queue && recipe.status !== 'approved' && <button className="ac-button" disabled={busy} onClick={() => moderate('approved')}>
          {recipe.status === 'pending' ? 'Approve & publish' : 'Approve on reconsideration'}</button>}
        {recipe.status === 'approved' && <button className="ac-button ac-outline" onClick={() => openRecipe(recipe.id)}>Open published recipe</button>}
        {online && <><button className="ac-button ac-outline" disabled={busy} onClick={() => selectAction({type:'edit',entry:recipe})}>Edit recipe</button>
          <button className="ad-delete-link" disabled={busy} onClick={() => selectAction({type:'deleteRecipe',entry:recipe})}>Delete recipe</button></>}
      </div>
      {queue && recipe.status !== 'rejected' && <form className="ac-form ac-feedback-form" onSubmit={event => {
        event.preventDefault(); moderate('rejected', new FormData(event.currentTarget).get('note'));
      }}>
        <label>Feedback for the cook<textarea name="note" required maxLength="400" rows={2} placeholder="What should the cook change?"/></label>
        <button className="ac-button ac-outline" disabled={busy}>{recipe.status === 'approved' ? 'Unpublish and request changes' : 'Decline recipe'}</button>
      </form>}
    </div>
  </details>;
}

export default function AdminWorkspace({user, openRecipe, notify, refresh, RecipePreview, Status}) {
  const store = window.KitchenStore;
  const [tab, setTab] = useState('queue');
  const [status, setStatus] = useState('pending');
  const [source, setSource] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(16);
  const [action, setAction] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const latch = useRef(false);
  const service = store.service?.() || {phase:'offline'};
  const waiting = service.phase === 'loading' || service.phase === 'unavailable' || (service.phase === 'refreshing' && !service.lastSuccessAt);
  const online = !waiting && service.phase !== 'offline' && Boolean(store.editRecipe);
  const recipes = waiting ? [] : store.recipes();
  const members = waiting ? [] : store.users();
  const submissions = recipes.filter(recipe => !isSeed(recipe));
  const busy = pending || service.phase === 'loading';
  const selectAction = value => {setAction(value); setError('');};
  const close = () => selectAction(null);
  async function run(task, message, finish) {
    if (latch.current) return;
    latch.current = true; setPending(true); setError('');
    try {
      await task();
      finish?.();
      if (message) notify(message);
    } catch (failure) {
      setError(getMessage(failure));
      if (online) {try {await store.refresh();} catch { /* Keep the action's original error visible. */ }}
    } finally {
      refresh(); latch.current = false; setPending(false);
    }
  }
  const switchTab = key => {setTab(key); setQuery(''); setLimit(16); setError('');};
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const matching = (...values) => {
    const text = normalize(values.join(' '));
    return words.every(word => text.includes(word));
  };
  const rows = tab === 'users' ? members.filter(person => matching(person.name, person.email, person.role))
    : (tab === 'queue' ? submissions.filter(recipe => recipe.status === status).slice().reverse() : recipes)
      .filter(recipe => matching(recipe.title,recipe.cuisine,recipe.author) && (tab !== 'catalog' || !source || (isSeed(recipe) ? 'editorial' : 'community') === source));
  const counts = {queue:submissions.filter(recipe => recipe.status === 'pending').length,catalog:recipes.length,users:members.length};
  const queue = tab === 'queue';
  const emptyTitle = query || (tab === 'catalog' && source) ? 'No matches found.' : queue && status === 'pending' ? 'The review queue is clear.'
    : queue ? 'No ' + labels[status].toLowerCase() + ' community recipes yet.' : tab === 'users' ? 'No users to display.' : 'The catalog is empty.';
  const dialogTitles = {edit:'Edit recipe',deleteRecipe:'Delete recipe',deleteUser:'Delete user'};
  const recipeAction = action?.type === 'edit' || action?.type === 'deleteRecipe';
  const currentRecipe = recipeAction ? recipes.find(recipe => recipe.id === action.entry.id) : null;
  const stale = recipeAction && !waiting && (!currentRecipe || (action.entry.revision || 0) !== (currentRecipe.revision || 0));
  const common = {busy,run,selectAction,openRecipe,RecipePreview,Status,online,queue};

  return <main className="ac-page ad-workspace">
    <header className="ad-masthead"><div className="ad-masthead-copy"><p><Icon name="chef" size={18}/>Admin workspace</p><h1>Recipe review</h1>
      <span>Review submissions, maintain the catalog and manage community accounts.</span></div>
      {store.refresh && <button className="ad-refresh" disabled={busy || service.phase === 'refreshing'} onClick={() => run(() => store.refresh(), 'Workspace refreshed.')}>
        <span aria-hidden="true">↻</span>{busy || service.phase === 'refreshing' ? 'Updating…' : 'Refresh'}</button>}
    </header>
    <nav className="ad-tabs" aria-label="Admin sections">{tabs.map(([key,name,icon]) => <button key={key} aria-label={name} aria-current={tab === key ? 'page' : undefined}
      onClick={() => switchTab(key)}><Icon name={icon}/><span>{name}</span>{!waiting && <small>{counts[key]}</small>}</button>)}</nav>
    {service.phase === 'offline' && <p className="ad-notice">Local demo. Reviews apply to this browser. Sign in on the deployed site to manage the shared catalog and accounts.</p>}
    {error && !action && <p className="ac-error" role="alert">{error}</p>}
    {waiting ? <div className="ac-empty" role="status"><h2>{service.phase === 'unavailable' ? 'Workspace unavailable' : 'Loading workspace…'}</h2>
      <p>{service.error || 'Connecting to the shared recipe service.'}</p></div> : <>
      <section className="ad-panel" aria-labelledby="ad-section-title" key={tab}>
        <div className="ad-toolbar"><div><h2 id="ad-section-title">{queue ? 'Review queue' : tab === 'catalog' ? 'Recipe catalog' : 'Community users'}</h2>
          <p>{queue ? 'Review a cook’s recipe and send feedback.' : tab === 'catalog' ? 'Edit editorial and community recipes, photos and instructions.' : 'Find accounts by name or email.'}</p></div>
          <label className="ad-search"><Icon name="search" size={17}/><input type="search" aria-label={tab === 'users' ? 'Search users' : 'Search recipes'}
            placeholder={tab === 'users' ? 'Search users' : 'Search recipes'} value={query} onChange={event => {setQuery(event.target.value); setLimit(16);}}/></label>
        </div>
        {queue && <div className="ad-filters">
          <div className="ac-tabs" aria-label="Filter by review status">{Object.entries(labels).map(([key,name]) => <button key={key}
            aria-pressed={status === key} className={status === key ? 'selected' : ''} onClick={() => {setStatus(key); setLimit(16); setError('');}}>
            {name} <span>{submissions.filter(recipe => recipe.status === key).length}</span></button>)}</div>
        </div>}
        {tab === 'catalog' && <div className="ad-filters"><label className="ad-filter-select">Recipe source<select value={source} onChange={event => {setSource(event.target.value); setLimit(16);}}>
          <option value="">All sources</option><option value="editorial">Editorial</option><option value="community">Community</option></select></label></div>}
        {rows.length === 0 ? <div className="ac-empty"><Icon name={queue ? 'check' : 'search'} size={25}/><h3>{emptyTitle}</h3>
          <p>{query ? 'Try a different search.' : queue && status === 'pending' ? 'New community submissions will appear here for review.' : ''}</p></div>
          : tab === 'users' ? <ul className="ad-users">{rows.slice(0,limit).map(person => {
            const protectedUser = person.id === user.id || person.role === 'admin';
            return <li key={person.id}><span className="ad-person"><span aria-hidden="true" className="ad-initial">{person.name?.slice(0,1) || '?'}</span>
              <span><strong>{person.name}</strong><small>{person.email}</small></span></span><span className="ad-user-role">{person.role === 'admin' ? 'Admin' : 'Cook'}</span>
              {protectedUser ? <span className="ad-protected">{person.id === user.id ? 'Your account' : 'Protected account'}</span>
                : online && <button className="ad-delete-link" disabled={busy} onClick={() => selectAction({type:'deleteUser',entry:person})}>Delete user</button>}</li>;
          })}</ul> : <div className="ac-review-list">{rows.slice(0,limit).map(recipe =>
            <RecipeRow key={recipe.id} recipe={recipe} {...common}/>)}</div>}
        {rows.length > limit && <button className="ac-button ac-outline ad-more" onClick={() => setLimit(limit + 16)}>Show more {tab === 'users' ? 'users' : 'recipes'} ({rows.length - limit} remaining)</button>}
      </section>
    </>}
    {action && <WorkspaceDialog title={dialogTitles[action.type]} busy={pending} close={close}>
      {error && <p className="ac-error" role="alert">{error}</p>}
      {stale ? <div><p role="alert">{currentRecipe ? 'Another editor changed this recipe. Load the latest version before making changes.' : 'This recipe was removed from the catalog.'}</p>
        {currentRecipe && <button className="ac-button ac-outline" onClick={() => selectAction({...action,entry:currentRecipe})}>Load latest version</button>}</div> : <>
        {action.type === 'edit' && <EditRecipe recipe={action.entry} run={run} busy={pending} close={close}/>}
        {['deleteUser','deleteRecipe'].includes(action.type) && <ConfirmDelete target={action} run={run} close={close} busy={pending}/>}
      </>}
    </WorkspaceDialog>}
  </main>;
}
