import React, { useState } from 'react';
import './account.css';

const kitchen = () => window.KitchenStore;
const approvedRecipes = () => kitchen().recipes().filter(recipe => recipe.status === 'approved');
const photo = recipe => window.SupperclubPhotos?.[recipe.image] || './images/' + encodeURIComponent(recipe.image);
const countLabel = (count, noun) => count + ' ' + noun + (count === 1 ? '' : 's');
const statusNames = { pending: 'In review', approved: 'Published', rejected: 'Declined' };

function PageHeading({ title, children, action }) {
  return <div className="ac-heading">
    <div><h1>{title}</h1>{children && <p>{children}</p>}</div>{action}
  </div>;
}

function ErrorMessage({ message }) {
  return message ? <p className="ac-error" role="alert">{message}</p> : null;
}

function Gate({ admin = false, user, go }) {
  return <section className="ac-page"><div className="ac-empty">
    <h1>{admin && user ? 'Admin access required' : 'Sign in to your kitchen'}</h1>
    <button className="ac-button" onClick={() => go(user ? 'discover' : 'login')}>
      {user ? 'Explore recipes' : 'Sign in'}
    </button>
  </div></section>;
}

export function AuthPage({ mode, go, notify, refresh, returnTo }) {
  const signup = mode === 'signup';
  const [receipt] = useState(() => signup ? null : kitchen().recentSignup());
  const [name,setName] = useState('');
  const [email,setEmail] = useState(receipt?.email || '');
  const [password,setPassword] = useState('');
  const [confirmation,setConfirmation] = useState('');
  const [visible,setVisible] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const feature = approvedRecipes().find(recipe => recipe.id === 'tomato-pasta') || approvedRecipes()[0];
  function switchMode() {
    setError('');
    setPassword('');
    setConfirmation('');
    setVisible(false);
    go(signup ? 'login' : 'signup');
  }
  async function authenticate(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (signup) {
        if (password !== confirmation) throw new Error('Your passwords do not match. Enter the same password in both fields.');
        await kitchen().signup(name.trim(), email.trim(), password);
        setPassword('');
        setConfirmation('');
        go('login');
        return;
      }
      const user = await kitchen().login(email.trim(), password);
      refresh();
      notify('Signed in as ' + user.name + '.');
      go(user.role === 'admin' ? 'admin' : (returnTo || 'discover').replace(/^#\/?/, ''));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return <section className="ac-page ac-auth-page">
    <div className="ac-auth-shell">
      <div className="ac-auth-form">
        <h1>{signup ? 'Make yourself at home.' : 'Welcome back.'}</h1>
        {receipt
          ? <p className="ac-auth-success" role="status"><strong>Congratulations, {receipt.name}!</strong> Your account is ready. Sign in with the email and password you just registered.</p>
          : <p className="ac-intro">{signup ? 'Create an account to build your cookbook and share what you cook.' : 'Sign in to open your cookbook and pick up where you left off.'}</p>}
        <form className="ac-form" onSubmit={authenticate}>
          {signup && <label>Your name<input autoComplete="name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>}
          <label>Email address<input name="email" type="email" autoComplete="username" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Password
            <span className="ac-password"><input name="password" aria-label="Password" type={visible ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? kitchen().passwordMinLength : 1} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button></span>
            {signup && <small>Use at least {kitchen().passwordMinLength} characters. Several words make a memorable passphrase.</small>}
          </label>
          {signup && <label>Confirm password<input name="confirmation" autoComplete="new-password" type={visible ? 'text' : 'password'} required maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)}/></label>}
          <ErrorMessage message={error}/>
          <button className="ac-button" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</button>
        </form>
        <p className="ac-switch">{signup ? 'Already have an account? ' : 'New to Supperclub? '}<button className="ac-link" onClick={switchMode}>{signup ? 'Sign in' : 'Create an account'}</button></p>
      </div>
      {feature?.image && <figure className="ac-auth-photo"><img src={photo(feature)} alt={feature.title}/><figcaption>{feature.title}</figcaption></figure>}
    </div>
  </section>;
}

function Thumbnail({recipe}) {
  return recipe.image
    ? <img className="ac-thumb" src={photo(recipe)} alt="" loading="lazy"/>
    : <span className="ac-thumb ac-thumb-text" aria-hidden="true">{recipe.title.slice(0,1)}</span>;
}

export function CollectionsPage({user, go, notify, refresh, openRecipe}) {
  const [selected,setSelected] = useState('saved');
  const [name,setName] = useState('');
  const [newCollection,setNewCollection] = useState(false);
  const [editing,setEditing] = useState(false);
  const [search,setSearch] = useState('');
  const [error,setError] = useState('');
  if (!user) return <Gate go={go}/>;
  const collections = kitchen().collections();
  const active = collections.find(c => c.id === selected) || collections[0];
  const allRecipes = approvedRecipes();
  const included = allRecipes.filter(recipe => active?.recipeIds.includes(recipe.id));
  const listed = editing ? allRecipes.filter(r => r.title.toLowerCase().includes(search.toLowerCase().trim())) : included;

  function create(event) {
    event.preventDefault();
    try {
      const saved = kitchen().createCollection(name.trim());
      setName('');
      setNewCollection(false);
      setSelected(saved.id);
      setEditing(true);
      setSearch('');
      setError('');
      refresh();
      notify('Collection created.');
    } catch (failure) { setError(failure.message); }
  }
  function toggle(recipe) {
    try {
      const isIncluded = active.recipeIds.includes(recipe.id);
      kitchen().setCollection(active.id,recipe.id,!isIncluded);
      refresh();
      setError('');
      notify(isIncluded ? 'Recipe removed from this collection.' : 'Recipe added to this collection.');
    } catch (failure) { setError(failure.message); }
  }
  function selectCollection(id) {
    setSelected(id);
    setSearch('');
    setEditing(false);
    setError('');
  }
  return <section className="ac-page">
    <PageHeading title="My collections" action={<button className="ac-button" onClick={() => {setNewCollection(!newCollection);setError('');}}>{newCollection ? 'Cancel' : 'New collection'}</button>}>
      Keep your go-to dishes together for the next time you cook.
    </PageHeading>
    {newCollection && <form onSubmit={create} className="ac-inline-form"><label>Collection name<input autoFocus required maxLength={60} placeholder="e.g. Sunday lunches" value={name} onChange={e => setName(e.target.value)}/></label><button className="ac-button">Create collection</button></form>}
    <ErrorMessage message={error}/>
    <div className="ac-cookbook">
      <nav className="ac-collection-nav" aria-label="Recipe collections">
        {collections.map(c => <button key={c.id} className={active?.id === c.id ? 'selected' : ''} aria-current={active?.id === c.id ? 'true' : undefined} onClick={() => selectCollection(c.id)}><span>{c.name}</span><span>{c.recipeIds.length}</span></button>)}
      </nav>
      {active && <div className="ac-collection-body">
        <div className="ac-subheading"><div><h2>{active.name}</h2><p>{countLabel(included.length,'recipe')}</p></div>
          <button className="ac-button ac-outline" onClick={() => {setEditing(!editing);setSearch('');}}>{editing ? 'Done editing' : 'Manage recipes'}</button>
        </div>
        {editing && <label className="ac-search-label">Find recipes to add or remove<input type="search" placeholder="Search by recipe name" value={search} onChange={e => setSearch(e.target.value)}/></label>}
        <ul className="ac-recipe-list">
          {listed.map(recipe => {
            const inList = active.recipeIds.includes(recipe.id);
            return <li key={recipe.id} className="ac-recipe-row">
              <button className="ac-row-open" onClick={() => openRecipe(recipe.id)}>
                <Thumbnail recipe={recipe}/><span><strong>{recipe.title}</strong><small>{recipe.cuisine} · {recipe.time} min</small></span>
              </button>
              <button className={'ac-chip-action ' + (inList ? '' : 'ac-add')} aria-label={(inList ? 'Remove ' : 'Add ') + recipe.title} onClick={() => toggle(recipe)}>{inList ? 'Remove' : 'Add'}</button>
            </li>;
          })}
        </ul>
        {!listed.length && <div className="ac-empty"><h3>{editing ? 'No matching recipes' : 'A fresh page for your recipes.'}</h3><p>{editing ? 'Try a shorter recipe name.' : 'Add a few dishes to start filling this collection.'}</p>
          {!editing && <button className="ac-button ac-outline" onClick={() => setEditing(true)}>Choose recipes</button>}
        </div>}
      </div>}
    </div>
  </section>;
}

const lines = text => text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const diets = ['Vegetarian','Vegan','Gluten-free','Dairy-free'];
export function SubmitPage({user, go, notify, refresh}) {
  const [diet,setDiet] = useState([]);
  const [error,setError] = useState('');
  if (!user) return <Gate go={go}/>;
  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      kitchen().submitRecipe({
        title: form.get('title').trim(), description: form.get('description').trim(), cuisine: form.get('cuisine').trim(),
        diet, time: Number(form.get('time')), servings: Number(form.get('servings')),
        ingredients: lines(form.get('ingredients')), steps: lines(form.get('steps'))
      });
      refresh();
      notify('Recipe submitted for review.');
      go('submissions');
    } catch (failure) { setError(failure.message); }
  }
  return <section className="ac-page ac-writing">
    <PageHeading title="Share a recipe" action={<button className="ac-button ac-outline" onClick={() => go('submissions')}>My submissions</button>}>
      Write down how you make it. An admin will review your recipe before it appears in Discover.
    </PageHeading>
    <form className="ac-form ac-recipe-form" onSubmit={submit}>
      <fieldset><legend>Recipe details</legend>
        <label>Recipe name<input name="title" required maxLength={100} placeholder="e.g. Sunday tomato rasam"/></label>
        <label>Description <small>(optional)</small><textarea name="description" maxLength={600} rows={2} placeholder="What makes this dish special?"/></label>
        <div className="ac-field-grid">
          <label>Cuisine<input name="cuisine" required maxLength={60} placeholder="e.g. South Indian" list="ac-cuisines"/></label>
          <datalist id="ac-cuisines">{[...new Set(approvedRecipes().map(r => r.cuisine))].map(cuisine => <option key={cuisine} value={cuisine}/>)}</datalist>
          <label>Total time (minutes)<input name="time" required type="number" min="1" max="1440" placeholder="35"/></label>
          <label>Servings<input name="servings" required type="number" min="1" max="50" placeholder="4"/></label>
        </div>
        <div className="ac-diets"><p>Dietary preferences <small>(optional)</small></p><div>{diets.map(item => <label key={item}><input type="checkbox" checked={diet.includes(item)} onChange={e => setDiet(e.target.checked ? [...diet,item] : diet.filter(d => d !== item))}/>{item}</label>)}</div></div>
      </fieldset>
      <fieldset><legend>Ingredients & method</legend>
        <label>Ingredients<small>List one ingredient per line, including its quantity.</small><textarea name="ingredients" required rows={5} placeholder={'2 tbsp olive oil\n1 small onion, finely chopped'}/></label>
        <label>Preparation steps<small>Write one step per line, in cooking order.</small><textarea name="steps" required rows={6} placeholder="Heat the oil in a pan over medium heat."/></label>
      </fieldset>
      <ErrorMessage message={error}/>
      <div className="ac-form-footer"><button className="ac-button">Submit for review</button></div>
    </form>
  </section>;
}

function RecipePreview({recipe}) {
  return <div className="ac-recipe-preview">
    {recipe.description && <p>{recipe.description}</p>}
    <p className="ac-meta">{recipe.cuisine} · {recipe.time} min · {countLabel(recipe.servings,'serving')}{recipe.diet?.length ? ' · ' + recipe.diet.join(', ') : ''}</p>
    <div className="ac-method"><div><h4>Ingredients</h4><ul>{recipe.ingredients.map((value,index) => <li key={index}>{value}</li>)}</ul></div>
    <div><h4>Method</h4><ol>{recipe.steps.map((value,index) => <li key={index}>{value}</li>)}</ol></div></div>
  </div>;
}

function Status({status}) {
  return <span className={'ac-status ac-status-' + status}>{statusNames[status] || status}</span>;
}

export function SubmissionsPage({user,go,openRecipe}) {
  if (!user) return <Gate go={go}/>;
  const mine = kitchen().recipes().filter(r => r.authorId === user.id).reverse();
  return <section className="ac-page">
    <PageHeading title="My submissions" action={<button className="ac-button" onClick={() => go('submit')}>Share a recipe</button>}>Follow your recipes from the review queue to the cookbook.</PageHeading>
    {!mine.length ? <div className="ac-empty"><h2>Your first recipe starts here.</h2><p>Submit a dish you love and track its review here.</p><button className="ac-button ac-outline" onClick={() => go('submit')}>Write a recipe</button></div>
      : <div className="ac-review-list">{mine.map(r => <details className="ac-review" key={r.id}>
        <summary><span><strong>{r.title}</strong><small>{r.cuisine} · {r.time} min</small></span><Status status={r.status}/></summary>
        <RecipePreview recipe={r}/>{r.status === 'approved' && <button className="ac-button ac-outline" onClick={() => openRecipe(r.id)}>Open published recipe</button>}
      </details>)}</div>}
  </section>;
}

export function AdminPage({user,go,notify,refresh,openRecipe}) {
  const [tab,setTab] = useState('pending');
  const [error,setError] = useState('');
  if (user?.role !== 'admin') return <Gate admin user={user} go={go}/>;
  const submissions = kitchen().recipes().filter(r => r.authorId && r.authorId !== 'editorial' && !window.KitchenSeeds?.some(seed => seed.id === r.id));
  const statuses = ['pending','approved','rejected'];
  const rows = submissions.filter(r => r.status === tab).reverse();
  function review(id,status) {
    try {
      kitchen().moderate(id,status);
      refresh(); setError('');
      notify(status === 'approved' ? 'Recipe published to Discover.' : 'Recipe declined.');
    } catch (failure) {setError(failure.message);}
  }
  return <section className="ac-page">
    <PageHeading title="Recipe review" action={<span className="ac-role">Admin workspace</span>}>Read community submissions and decide which recipes join the cookbook.</PageHeading>
    <div className="ac-tabs" aria-label="Filter by review status">{statuses.map(status => <button className={tab === status ? 'selected' : ''} key={status} aria-pressed={tab === status} onClick={() => {setTab(status);setError('');}}>{statusNames[status]} <span>{submissions.filter(r => r.status === status).length}</span></button>)}</div>
    <ErrorMessage message={error}/>
    {rows.length === 0 ? <div className="ac-empty"><h2>{tab === 'pending' ? 'The review queue is clear.' : 'No ' + statusNames[tab].toLowerCase() + ' recipes yet.'}</h2><p>{tab === 'pending' ? 'Recipes submitted by cooks on this browser will appear here.' : 'Recipes you have reviewed will appear here.'}</p></div>
       : <div className="ac-review-list">{rows.map(r => <details className="ac-review" key={r.id}>
         <summary><span><strong>{r.title}</strong><small>Submitted by {r.author}</small></span><Status status={r.status}/></summary>
         <RecipePreview recipe={r}/>
         {tab === 'pending' && <div className="ac-actions"><button className="ac-button" onClick={() => review(r.id,'approved')}>Approve & publish</button><button className="ac-button ac-outline" onClick={() => review(r.id,'rejected')}>Decline recipe</button></div>}
         {tab === 'approved' && <button className="ac-button ac-outline" onClick={() => openRecipe(r.id)}>Open published recipe</button>}
       </details>)}</div>}
  </section>;
}
