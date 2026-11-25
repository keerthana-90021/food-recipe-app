import React, {useEffect, useRef, useState} from 'react';
import {Icon} from './Icons.jsx';

export function FoodImage({recipe, eager=false}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [recipe.image]);
  return recipe.image && !failed
    ? <img src={window.SupperclubPhotos?.[recipe.image] || './images/' + encodeURIComponent(recipe.image)} alt={recipe.title} loading={eager?'eager':'lazy'} onError={() => setFailed(true)} />
    : <div className="food-placeholder"><Icon name="bowl" size={44}/><span>{recipe.cuisine || 'Community kitchen'}</span></div>;
}

function Featured({recipe,openRecipe}) {
  const words = recipe.title.trim().split(/\s+/);
  const lastWord = words.pop();
  return <section className="featured" aria-label="Featured recipe">
    <div className="feature-copy">
      <div className="eyebrow feature-label"><span/>Featured recipe</div>
      <h1>{words.join(' ')} <em>{lastWord}</em></h1>
      <p className="feature-description">{recipe.description}</p>
      <div className="feature-meta"><span><Icon name="clock"/>{recipe.time} min</span><i/><span><Icon name="users"/>{recipe.servings} servings</span></div>
      <button className="button green-button feature-button" onClick={() => openRecipe(recipe.id)}><Icon name="book"/>View recipe</button>
    </div>
    <div className="feature-image"><FoodImage recipe={recipe} eager/></div>
  </section>;
}

export function RecipeCard({recipe,openRecipe,toggleSave}) {
  const store=window.KitchenStore, saved=store.isSaved(recipe.id), rating=store.rating(recipe.id);
  return <article className="recipe-card">
    <div className="card-photo">
      <a href={'#recipe/'+encodeURIComponent(recipe.id)} aria-label={'View '+recipe.title} onClick={e=>{if(!e.ctrlKey && !e.metaKey && !e.shiftKey){e.preventDefault(); openRecipe(recipe.id);}}}><FoodImage recipe={recipe}/></a>
      <button className={'save-icon'+(saved?' saved':'')} aria-label={(saved?'Unsave ':'Save ')+recipe.title} aria-pressed={saved} onClick={() => toggleSave(recipe.id)}><Icon name="bookmark" size={18} fill={saved}/></button>
    </div>
    <div className="card-kicker"><span>{recipe.cuisine}</span><span className="card-rating"><Icon name="star" size={14} fill/>{rating.count ? rating.average.toFixed(1) : 'New'}</span></div>
    <h3><a href={'#recipe/'+encodeURIComponent(recipe.id)}>{recipe.title}</a></h3>
    <div className="card-meta"><span><Icon name="clock" size={15}/>{recipe.time} min</span><i/> {recipe.diet?.[0] || recipe.category || 'Community recipe'}</div>
  </article>;
}

const quickFilters = ['All recipes','30 min or less','Vegetarian','Vegan','Gluten-free'];
const normalize = value => String(value||'').toLowerCase().replace(/[-_]/g,' ').trim();
function matchesDiet(recipe, diet) {
  const diets = (recipe.diet || []).map(normalize);
  return diets.includes(normalize(diet)) || (normalize(diet)==='vegetarian' && diets.includes('vegan'));
}

export default function Discover({recipes,openRecipe,toggleSave,discoverState,setDiscoverState}) {
  const {query,quick,cuisine,diet,sort,filtersOpen}=discoverState;
  const update = patch => setDiscoverState(prev=>({...prev,...patch}));
  const reset = () => update({query:'',quick:'All recipes',cuisine:'',diet:'',sort:'featured'});
  const section = useRef(null);
  const approved=recipes.filter(r=>r.status==='approved');
  const feature = approved.find(r=>r.id==='tomato-pasta') || approved[0];
  const ordered = [...approved.filter(r=>r.id!==feature?.id),...approved.filter(r=>r.id===feature?.id)];
  const terms = normalize(query).split(/[\s,]+/).filter(Boolean);
  const filtered=ordered.filter(r=>{
    const haystack=normalize([r.title,r.cuisine,...(r.diet||[]),...r.ingredients].join(' '));
    return terms.every(term=>haystack.includes(term)) && (!cuisine || r.cuisine===cuisine)
      && (!diet || matchesDiet(r,diet))
      && (quick==='All recipes' || (quick==='30 min or less' ? r.time<=30 : matchesDiet(r,quick)));
  });
  if(sort==='time') filtered.sort((a,b)=>a.time-b.time);
  if(sort==='rating') filtered.sort((a,b)=>window.KitchenStore.rating(b.id).average-window.KitchenStore.rating(a.id).average);
  if(sort==='title') filtered.sort((a,b)=>a.title.localeCompare(b.title));
  const hasFilter = Boolean(query || cuisine || diet || quick!=='All recipes');
  return <main className="discover page-width">
    {feature && <Featured recipe={feature} openRecipe={openRecipe}/>}
    <section className="explore" ref={section} id="recipe-index" aria-labelledby="explore-title">
      <div className="explore-heading">
        <div><div className="eyebrow section-kicker"><span/>The collection</div><h2 id="explore-title">Explore recipes</h2></div>
        <label className="search-field"><Icon name="search" size={20}/><input type="search" value={query} onChange={e=>update({query:e.target.value})} placeholder="Search recipes or ingredients" aria-label="Search recipes or ingredients"/></label>
      </div>
      <div className="filter-toolbar">
        <div className="quick-filters" aria-label="Quick filters">{quickFilters.map(item=><button key={item} className={'chip'+(quick===item?' active':'')} onClick={()=>update({quick:item})} aria-pressed={quick===item}>{item}</button>)}</div>
        <button className={'filter-toggle'+(filtersOpen?' expanded':'')} aria-controls="advanced-filters" aria-expanded={filtersOpen} onClick={()=>update({filtersOpen:!filtersOpen})}><Icon name="filters" size={17}/>Filters{(cuisine||diet||sort!=='featured') && <span className="filter-dot" aria-label="active"/>}</button>
      </div>
      {filtersOpen && <div id="advanced-filters" className="advanced-filters">
        <label>Cuisine<select value={cuisine} onChange={e=>update({cuisine:e.target.value})}><option value="">All cuisines</option>{[...new Set(approved.map(r=>r.cuisine))].sort().map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Dietary preference<select value={diet} onChange={e=>update({diet:e.target.value})}><option value="">All diets</option>{[...new Set(approved.flatMap(r=>r.diet||[]))].sort().map(d=><option key={d}>{d}</option>)}</select></label>
        <label>Sort by<select value={sort} onChange={e=>update({sort:e.target.value})}><option value="featured">Kitchen picks</option><option value="time">Shortest cooking time</option><option value="rating">Highest rated</option><option value="title">Title A–Z</option></select></label>
        <button className="text-button" onClick={reset}>Reset filters</button>
      </div>}
      {hasFilter && <p className="result-count" role="status">{filtered.length} {filtered.length===1?'recipe':'recipes'} found</p>}
      {filtered.length ? <div className="recipe-grid">{filtered.map(recipe=><RecipeCard key={recipe.id} {...{recipe,openRecipe,toggleSave}}/>)}</div> :
        <div className="no-results"><Icon name="search" size={30}/><h3>No recipes found</h3><p>Try another ingredient or clear your filters.</p><button className="button outline-button" onClick={reset}>Clear filters</button></div>}
    </section>
  </main>;
}
