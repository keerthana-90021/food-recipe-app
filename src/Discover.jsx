import React, {useState} from 'react';
import {Icon} from './Icons.jsx';
import {RecipePicker} from './KitchenMotion.jsx';
export {MotionPreference} from './KitchenMotion.jsx';

const quickFilters = ['All recipes', 'Non-vegetarian', 'Vegetarian', '30 min or less', 'Vegan', 'Gluten-free'];
const priorityCuisines = ['Indian', 'Italian', 'Mexican', 'Chinese', 'Japanese', 'Korean'];
const spotlightIds = ['tomato-pasta', 'pepper-chicken-fry', 'salmon-teriyaki', 'palak-paneer', 'bibimbap', 'mushroom-tacos'];
const kitchenPicks = ['pepper-chicken-fry', 'miso-ramen', 'fish-veracruz', 'bibimbap', 'chana-masala', 'mushroom-tacos', 'chicken-piccata', 'sesame-noodles', 'pesto-gnocchi', 'greek-salad', 'chickpea-tagine'];
const normalize = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const pageSize = 12;

function searchCriteria(query) {
  let terms = normalize(query);
  const diets = [];
  for (const [expression, name] of [[/\bnon\s*(?:vegetarian|veg)\b/g, 'Non-vegetarian'], [/\b(?:vegetarian|veg)\b/g, 'Vegetarian'],
    [/\bvegan\b/g, 'Vegan'], [/\bgluten\s*free\b/g, 'Gluten-free']]) {
    terms = terms.replace(expression, () => { diets.push(name); return ' '; });
  }
  return {dietNames:diets, words:terms.split(/\s+/).filter(Boolean)};
}

export function FoodImage({recipe, eager=false}) {
  const [failedImage, setFailedImage] = useState(null);
  if (recipe.image && failedImage !== recipe.image) {
    return <img src={window.SupperclubPhotos?.[recipe.image] || './images/' + encodeURIComponent(recipe.image)}
      alt={recipe.title} loading={eager ? 'eager' : 'lazy'} onError={() => setFailedImage(recipe.image)}/>;
  }
  return <div className="food-placeholder">
    <span className="placeholder-label"><Icon name="leaf" size={16}/>Ingredients</span>
    <ul>{recipe.ingredients.slice(0, 3).map((ingredient, index) => <li key={index}>{ingredient}</li>)}</ul>
  </div>;
}

function Featured({choices, openRecipe}) {
  const [selected, setSelected] = useState(0);
  const index = selected % choices.length;
  const recipe = choices[index];
  const ampersand = recipe.title.indexOf(' & ');
  const lastSpace = recipe.title.lastIndexOf(' ');
  const splitAt = ampersand >= 0 ? ampersand : lastSpace;
  const lead = splitAt > 0 ? recipe.title.slice(0, splitAt) : '';
  const finish = splitAt > 0 ? recipe.title.slice(splitAt + 1) : recipe.title;
  function change(direction) {
    setSelected(current => (current + direction + choices.length) % choices.length);
  }
  return <section className="featured" aria-label="Featured recipes" aria-roledescription="carousel">
    <div className="feature-image" key={'photo-' + recipe.id}><FoodImage recipe={recipe} eager/></div>
    <div className="feature-copy" key={recipe.id}>
      <div className="eyebrow feature-label"><span/>Featured recipe</div>
      <h1>{lead}{lead && ' '}<em>{finish}</em></h1>
      <p className="feature-description">{recipe.description}</p>
      <div className="feature-meta">
        <span>{recipe.cuisine}</span><i/><span><Icon name="clock" size={16}/>{recipe.time} min</span><i/>
        <span><Icon name="users" size={16}/>{recipe.servings} servings</span>
      </div>
      <button className="button feature-button" onClick={() => openRecipe(recipe.id)}><Icon name="book" size={18}/>View recipe</button>
    </div>
    {choices.length > 1 && <div className="spotlight-controls" role="group" aria-label="Choose a featured recipe"
      onKeyDown={event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault(); change(event.key === 'ArrowLeft' ? -1 : 1);
      }}>
      <button aria-label="Previous featured recipe" onClick={() => change(-1)}><span className="carousel-chevron previous"/></button>
      <span className="feature-position" aria-live="polite" aria-atomic="true">{index + 1} <span>/</span> {choices.length}<span className="visually-hidden">. {recipe.title}</span></span>
      <button aria-label="Next featured recipe" onClick={() => change(1)}><span className="carousel-chevron"/></button>
    </div>}
  </section>;
}

export function RecipeCard({recipe, openRecipe, toggleSave}) {
  const store = window.KitchenStore;
  const saved = store.isSaved(recipe.id);
  const [celebrate, setCelebrate] = useState(false);
  const rating = store.rating(recipe.id);
  const href = '#recipe/' + encodeURIComponent(recipe.id);
  return <article className="recipe-card">
    <div className="card-photo">
      <a href={href} aria-label={'View ' + recipe.title} onClick={event => {
        if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
          event.preventDefault();
          openRecipe(recipe.id);
        }
      }}><FoodImage recipe={recipe}/></a>
      <button className={'save-icon' + (saved ? ' saved' : '') + (celebrate && saved ? ' just-saved' : '')}
        aria-label={(saved ? 'Unsave ' : 'Save ') + recipe.title} aria-pressed={saved}
        onAnimationEnd={() => setCelebrate(false)} onClick={() => {
          toggleSave(recipe.id);
          setCelebrate(!saved && store.isSaved(recipe.id));
        }}><Icon name="bookmark" size={17} fill={saved}/></button>
    </div>
    <div className="card-body">
      <div className="card-kicker"><span>{recipe.cuisine}</span>
        {rating.count > 0 && <span className="card-rating" aria-label={rating.average.toFixed(1) + ' out of five stars'}><Icon name="star" size={14} fill/>{rating.average.toFixed(1)}</span>}
      </div>
      <h3><a href={href}>{recipe.title}</a></h3>
      <div className="card-meta"><span><Icon name="clock" size={15}/>{recipe.time} min</span>
        {(recipe.diet?.[0] || recipe.category) && <><i/>{recipe.diet?.[0] || recipe.category}</>}
      </div>
    </div>
  </article>;
}

function matchesDiet(recipe, diet) {
  const diets = (recipe.diet || []).map(normalize);
  return diets.includes(normalize(diet)) || (normalize(diet) === 'vegetarian' && diets.includes('vegan'));
}

export default function Discover({recipes, openRecipe, toggleSave, discoverState, setDiscoverState}) {
  const {query, quick, cuisine, diet, sort, filtersOpen, visibleCount=pageSize} = discoverState;
  const update = patch => setDiscoverState(previous => ({...previous, ...patch}));
  const filter = patch => update({...patch, visibleCount:pageSize});
  const reset = () => filter({query:'', quick:'All recipes', cuisine:'', diet:'', sort:'featured'});
  const approved = recipes.filter(recipe => recipe.status === 'approved');
  const availableCuisines = new Map();
  for (const recipe of approved) {
    const name = recipe.cuisine?.trim();
    const key = normalize(name);
    if (key && !availableCuisines.has(key)) availableCuisines.set(key, name);
  }
  const preferred = priorityCuisines.filter(name => availableCuisines.has(normalize(name)));
  preferred.forEach(name => availableCuisines.delete(normalize(name)));
  const cuisines = [...preferred, ...[...availableCuisines.values()].sort()];
  const diets = [...new Set(approved.flatMap(recipe => recipe.diet || []))].sort();
  const choices = spotlightIds.map(id => approved.find(recipe => recipe.id === id)).filter(Boolean);
  if (!choices.length && approved.length) choices.push(approved[0]);
  const {words, dietNames} = searchCriteria(query);
  const matches = approved.filter(recipe => {
    const searchText = normalize([recipe.title, recipe.cuisine, recipe.category, ...(recipe.diet || []), ...recipe.ingredients].join(' '));
    return words.every(term => searchText.includes(term)) && dietNames.every(name => matchesDiet(recipe, name))
      && (!cuisine || normalize(recipe.cuisine) === normalize(cuisine))
      && (!diet || matchesDiet(recipe, diet))
      && (quick === 'All recipes' || (quick === '30 min or less' ? recipe.time <= 30 : matchesDiet(recipe, quick)));
  });
  if (sort === 'time') matches.sort((a, b) => a.time - b.time);
  if (sort === 'rating') {
    const scores = new Map(matches.map(recipe => [recipe.id, window.KitchenStore.rating(recipe.id).average]));
    matches.sort((a, b) => scores.get(b.id) - scores.get(a.id));
  }
  if (sort === 'title') matches.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'featured') {
    const ranks = new Map(kitchenPicks.map((id, index) => [id, index]));
    matches.sort((a, b) => (ranks.get(a.id) ?? kitchenPicks.length) - (ranks.get(b.id) ?? kitchenPicks.length));
  }
  const hasFilter = Boolean(query || cuisine || diet || quick !== 'All recipes');
  const countLabel = matches.length + (matches.length === 1 ? ' recipe' : ' recipes');
  return <main className="discover page-width">
    {choices.length > 0 && <Featured choices={choices} openRecipe={openRecipe}/>}
    <section className="explore" id="recipe-index" aria-labelledby="explore-title">
      <div className="explore-heading">
        <div className="explore-title-block"><h2 id="explore-title">Explore recipes</h2>
          <p className="result-count" role="status">{hasFilter ? countLabel + ' found' : countLabel + ' from ' + cuisines.length + ' cuisines'}</p>
        </div>
        <div className="explore-controls">
          <label className="search-field"><Icon name="search" size={19}/>
            <input type="search" value={query} onChange={event => filter({query:event.target.value})}
              placeholder="Search recipes or ingredients" aria-label="Search recipes or ingredients"/>
          </label>
          <label className="cuisine-field"><span>Cuisine</span>
            <select value={cuisine} onChange={event => filter({cuisine:event.target.value})}>
              <option value="">All cuisines</option>{cuisines.map(name => <option key={name}>{name}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="filter-toolbar">
        <div className="quick-filters" aria-label="Quick filters">{quickFilters.map(item =>
          <button key={item} className={'chip' + (quick === item ? ' active' : '')}
            onClick={() => filter({quick:item})} aria-pressed={quick === item}>{item}</button>)}</div>
        <div className="recipe-tools"><RecipePicker recipes={matches} {...{openRecipe, FoodImage}}/>
        <button className={'filter-toggle' + (filtersOpen ? ' expanded' : '')} aria-controls="advanced-filters"
          aria-expanded={filtersOpen} onClick={() => update({filtersOpen:!filtersOpen})}>
          <Icon name="filters" size={16}/>Filters{(diet || sort !== 'featured') && <span className="filter-dot" aria-label="active"/>}
        </button></div>
      </div>
      {filtersOpen && <div id="advanced-filters" className="advanced-filters">
        <label>Dietary preference<select value={diet} onChange={event => filter({diet:event.target.value})}>
          <option value="">All diets</option>{diets.map(name => <option key={name}>{name}</option>)}
        </select></label>
        <label>Sort by<select value={sort} onChange={event => filter({sort:event.target.value})}>
          <option value="featured">Kitchen picks</option><option value="time">Shortest cooking time</option>
          <option value="rating">Highest rated</option><option value="title">Title A–Z</option>
        </select></label>
        <button className="text-button" onClick={reset}>Reset filters</button>
      </div>}
      {matches.length > 0 ? <>
        <div className="recipe-grid">{matches.slice(0, visibleCount).map(recipe =>
          <RecipeCard key={recipe.id} {...{recipe, openRecipe, toggleSave}}/>)}</div>
        {matches.length > visibleCount && <div className="show-more"><button className="button outline-button"
          onClick={() => update({visibleCount:visibleCount + pageSize})}>Show more recipes<Icon name="plus" size={16}/></button>
          <span>Showing {visibleCount} of {matches.length}</span>
        </div>}
      </> : <div className="no-results"><Icon name="search" size={28}/><h3>No recipes found</h3>
        <p>Try another ingredient or clear your filters.</p><button className="button outline-button" onClick={reset}>Clear filters</button>
      </div>}
    </section>
  </main>;
}
