import React, {useState} from 'react';
import {FoodImage} from './Discover.jsx';
import {Icon} from './Icons.jsx';
import {PlanRecipeButton} from './MealPlanner.jsx';
import CookMode from './CookMode.jsx';
import {useCookSession} from './cookSession.js';

export default function RecipeDetail(props) {
  const {recipe,user} = props;
  const scope = JSON.stringify([user?.id,recipe.id,recipe.status,recipe.ingredients,recipe.steps]);
  return <RecipeView key={scope} {...props}/>;
}
function RecipeView({recipe,token,toggleSave,notify,user,requireLogin,refresh}) {
  const store = window.KitchenStore;
  const progress = useCookSession(recipe,user,notify);
  const {checked,done} = progress;
  const [shareUrl,setShareUrl] = useState('');
  const [shareText,setShareText] = useState('');
  const [ratingPending,setRatingPending] = useState(false);
  const [saving,setSaving] = useState(false);
  const snapshot = recipe.status==='shared';
  const saved = !snapshot && store.isSaved(recipe.id);
  const score = snapshot ? null : store.rating(recipe.id);
  async function rate(stars) {
    if(!user){requireLogin();return;}
    if(ratingPending)return;
    setRatingPending(true);
    try {await store.rate(recipe.id,stars);refresh();notify('Your rating has been saved.');}
    catch(error){notify(error.message);}
    finally {setRatingPending(false);}
  }
  async function bookmark() {
    if(saving)return;
    setSaving(true);
    try {await toggleSave(recipe.id);} finally {setSaving(false);}
  }
  async function share() {
    try {
      if(window.location.protocol==='file:'){
        const text=[recipe.title,'By '+recipe.author,recipe.time+' min · '+recipe.servings+' servings','Ingredients',...recipe.ingredients,'Method',...recipe.steps.map((step,i)=>(i+1)+'. '+step)].join('\n');
        setShareText(text);
        try{await navigator.clipboard.writeText(text);notify('Recipe copied for sharing.');}catch{notify('Select and copy the recipe below.');}
        return;
      }
      const snapshotToken = snapshot ? token : await store.shareToken(recipe.id);
      const url=new URL(window.location.href);
      url.hash='recipe/'+encodeURIComponent(recipe.id)+(snapshotToken?'?shared='+snapshotToken:'');
      setShareUrl(url.href);
      if(navigator.clipboard?.writeText) {
        try {await navigator.clipboard.writeText(url.href);notify('Recipe link copied.');} catch {notify('Select and copy the recipe link below.');}
      }
    } catch(error) {notify(error.message);}
  }
  return <main className="detail page-width">
    <a href="#discover" className="back-link"><Icon name="back" size={16}/>Explore recipes</a>
    <div className="detail-intro">
      <div className="detail-cover"><FoodImage recipe={recipe} eager/></div>
      <div className="detail-copy">
        <div className="eyebrow section-kicker"><span/>{recipe.cuisine} kitchen</div>
        <h1>{recipe.title}</h1>
        <p className="detail-summary">{recipe.description}</p>
        <p className="byline">By {recipe.author}</p>
        <div className="detail-meta">
          <span><Icon name="clock"/>{recipe.time} min</span><span><Icon name="users"/>{recipe.servings} servings</span>
          {score?.count>0 && <span><Icon name="star" size={16}/>{score.average.toFixed(1)} ({score.count})</span>}
        </div>
        {!!recipe.diet?.length && <div className="diet-list">{recipe.diet.map(d=><span key={d}>{d}</span>)}</div>}
        {snapshot && <p className="snapshot-note">Shared recipe from {recipe.author}’s cookbook.</p>}
        <div className="detail-actions">
          {!snapshot && <button className="green-button button" disabled={saving} aria-pressed={saved} onClick={bookmark}><Icon name="bookmark" size={17} fill={saved}/>{saved?'Saved to cookbook':'Save recipe'}</button>}
          <button className="outline-button button" onClick={share}><Icon name="share" size={17}/>Share recipe</button>
          {!snapshot && <PlanRecipeButton {...{recipe,user,requireLogin,notify}}/>}
        </div>
        {shareUrl && <label className="share-field">Recipe link<input aria-label="Recipe link" readOnly value={shareUrl} onFocus={e=>e.target.select()}/></label>}
        {shareText && <label className="share-field">Recipe to share<textarea rows="4" readOnly value={shareText} onFocus={e=>e.target.select()}/></label>}
      </div>
    </div>
    <div className="method-grid">
      <section className="ingredients-panel"><h2>Ingredients</h2><p className="section-hint">For {recipe.servings} {recipe.servings===1?'serving':'servings'}</p>
        <ul>{recipe.ingredients.map((ingredient,i)=><li key={i}><label className={checked.includes(i)?'is-checked':''}><input type="checkbox" checked={checked.includes(i)} onChange={()=>progress.toggleIngredient(i)}/><span>{ingredient}</span></label></li>)}</ul>
      </section>
      <section className="method-panel"><div className="method-heading"><h2>Step by step</h2><CookMode {...{recipe,progress,notify}}/></div>
        <ol>{recipe.steps.map((step,i)=><li key={i}><button className={'step-number'+(done.includes(i)?' complete':'')} onClick={()=>progress.toggleStep(i)} aria-label={'Mark step '+(i+1)+(done.includes(i)?' incomplete':' complete')} aria-pressed={done.includes(i)}>{done.includes(i)?<Icon name="check" size={17}/>:i+1}</button><p>{step}</p></li>)}</ol>
        {(checked.length > 0 || done.length > 0 || progress.timer) && <div className="cook-reset"><span>{done.length} of {recipe.steps.length} steps completed</span><button type="button" onClick={()=>{progress.reset();notify('Cooking progress reset.');}}>Reset cooking session</button></div>}
        {!snapshot && <div className="rating-panel">
          <h3>Rate this recipe</h3>
          {score?.count == null ? <p>Ratings will be available when the shared kitchen reconnects.</p> : <>
            <p>{score.mine ? 'Your rating: '+score.mine+' out of 5.' : 'How did it turn out?'}</p>
            <div className="rating-stars" aria-label="Rate recipe" aria-busy={ratingPending}>
              {[1,2,3,4,5].map(n => <button key={n} disabled={ratingPending} aria-label={'Rate '+n+' out of 5'} aria-pressed={score.mine===n} onClick={()=>rate(n)}><Icon name="star" size={28} fill={n<=score.mine}/></button>)}
            </div>
          </>}
        </div>}
      </section>
    </div>
  </main>;
}
