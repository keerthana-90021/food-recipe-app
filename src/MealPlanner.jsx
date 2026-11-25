import React, {useRef, useState} from 'react';
import {Icon} from './Icons.jsx';
import {addToPlan, dayDate, isBought, localDay, markBought, plannedMeals, removeFromPlan, shiftDay, shoppingItems, slots, weekStart} from './mealStore.js';
import './planner.css';

const fullDate = new Intl.DateTimeFormat(undefined, {weekday:'long', month:'long', day:'numeric'});
const shortDate = new Intl.DateTimeFormat(undefined, {weekday:'short', month:'short', day:'numeric'});
const rangeDate = new Intl.DateTimeFormat(undefined, {month:'short', day:'numeric'});
const weekDay = new Intl.DateTimeFormat(undefined, {weekday:'short'});
const monthDay = new Intl.DateTimeFormat(undefined, {month:'short', day:'numeric'});

function SlotSelect({slot, setSlot}) {
  return <label>Meal<select value={slot} onChange={event => setSlot(event.target.value)}>{slots.map(value => <option key={value}>{value}</option>)}</select></label>;
}

export function PlanRecipeButton({recipe, user, requireLogin, notify}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(localDay);
  const [slot, setSlot] = useState('Dinner');
  const trigger = useRef(null);
  if (recipe.status !== 'approved') return null;

  function add(event) {
    event.preventDefault();
    try {
      const added = addToPlan(recipe.id, date, slot);
      notify(added ? 'Added to '+slot.toLowerCase()+' on '+shortDate.format(dayDate(date))+'.' : 'This recipe is already in that meal.');
      setOpen(false);
      trigger.current?.focus();
    } catch (error) { notify(error.message); }
  }

  return <div className={'mp-quick'+(open?' is-open':'')}>
    <button ref={trigger} type="button" className="outline-button button" aria-expanded={open} onClick={() => user ? setOpen(!open) : requireLogin()}><Icon name="plus" size={17}/>Plan meal</button>
    {open && <form className="mp-quick-fields" onSubmit={add}>
      <label>Date<input type="date" value={date} onChange={event => setDate(event.target.value)} required autoFocus/></label>
      <SlotSelect {...{slot,setSlot}}/>
      <button className="green-button button" type="submit">Add to plan</button>
    </form>}
  </div>;
}

function ShoppingList({start, items, notify, refresh}) {
  const [copyText, setCopyText] = useState('');
  const statuses = items.map(item => ({item, bought:isBought(start, item)}));
  const remaining = statuses.filter(entry => !entry.bought);

  function toggle(item, checked) {
    try { markBought(start, item, checked); setCopyText(''); refresh(); }
    catch (error) { notify(error.message); }
  }
  async function copy() {
    const text = ['Shopping list · '+shortDate.format(dayDate(start)), ...remaining.map(({item}) => '• '+item.label)].join('\n');
    try { await navigator.clipboard.writeText(text); notify('Shopping list copied.'); }
    catch { setCopyText(text); }
  }
  return <aside className="mp-shopping" aria-labelledby="mp-shopping-title">
    <h2 id="mp-shopping-title">Shopping list</h2>
    {items.length ? <>
      <p className="mp-small">{remaining.length} of {items.length} ingredients left to pick up</p>
      <ul className="mp-groceries">{statuses.map(({item, bought}) => <li key={item.id}>
        <label className={bought?'is-bought':''}><input type="checkbox" checked={bought} onChange={event => toggle(item,event.target.checked)}/><span>{item.label}</span></label>
      </li>)}</ul>
      <button className="outline-button button mp-copy" disabled={!remaining.length} onClick={copy}><Icon name="share" size={16}/>Copy remaining items</button>
      {copyText && <label className="mp-field mp-copy-text">Select and copy your list<textarea rows={4} value={copyText} readOnly onFocus={event=>event.target.select()}/></label>}
    </> : <p className="mp-empty-shopping">Add a recipe to this week to see the ingredients you’ll need.</p>}
  </aside>;
}

export default function MealPlanner({user, go, notify, refresh, openRecipe}) {
  const today = localDay();
  const [start,setStart] = useState(() => weekStart(today));
  const [chosenDay,setChosenDay] = useState(today);
  const [slot,setSlot] = useState('Dinner');
  const [recipeId,setRecipeId] = useState('');
  const recipeSelect = useRef(null);
  if (!user) return <main className="mp-page page-width"><h1>Meal planner</h1><p>Sign in to plan your week and save your shopping list.</p><button className="green-button button" onClick={() => go('login')}>Sign in</button></main>;
  const recipes = window.KitchenStore.recipes().filter(recipe => recipe.status === 'approved').sort((a,b) => a.title.localeCompare(b.title));
  const meals = plannedMeals(start, recipes);
  const items = shoppingItems(meals);
  const days = Array.from({length:7}, (_, index) => shiftDay(start,index));
  const range = rangeDate.format(dayDate(start))+' – '+rangeDate.format(dayDate(days[6]))+', '+dayDate(days[6]).getFullYear();

  function changeWeek(next) {
    setStart(next);
    setChosenDay(next === weekStart(today) ? today : next);
  }
  function add(event) {
    event.preventDefault();
    try {
      const added = addToPlan(recipeId, chosenDay, slot);
      notify(added ? 'Added to your meal plan.' : 'This recipe is already in that meal.');
      if (added) { setRecipeId(''); refresh(); }
    } catch (error) { notify(error.message); }
  }
  function remove(meal) {
    try { removeFromPlan(meal.recipeId,meal.day,meal.slot); refresh(); notify('Meal removed from your plan.'); }
    catch (error) { notify(error.message); }
  }
  function chooseDay(day) {
    setChosenDay(day);
    recipeSelect.current?.focus();
  }

  return <main className="mp-page page-width">
    <header className="mp-heading"><h1>Meal planner</h1><p>Plan what to cook and take your weekly ingredient list to the store.</p></header>
    <div className="mp-week-bar">
      <div><h2>{range}</h2><span>{meals.length} {meals.length === 1 ? 'recipe' : 'recipes'} planned</span></div>
      <div className="mp-week-nav" aria-label="Week navigation">
        <button aria-label="Previous week" onClick={() => changeWeek(shiftDay(start,-7))}><Icon name="back" size={17}/></button>
        <button onClick={() => changeWeek(weekStart(today))}>This week</button>
        <button aria-label="Next week" onClick={() => changeWeek(shiftDay(start,7))}><Icon name="back" size={17} className="mp-forward"/></button>
      </div>
    </div>
    <div className="mp-columns">
      <section className="mp-schedule" aria-label="Weekly meals">
        <form className="mp-add-form" onSubmit={add}>
          <label className="mp-recipe-pick">Recipe<select ref={recipeSelect} required value={recipeId} onChange={event => setRecipeId(event.target.value)}><option value="">Choose a recipe</option>{recipes.map(recipe=><option key={recipe.id} value={recipe.id}>{recipe.title}</option>)}</select></label>
          <label>Day<select value={chosenDay} onChange={event => setChosenDay(event.target.value)}>{days.map(day=><option key={day} value={day}>{shortDate.format(dayDate(day))}</option>)}</select></label>
          <SlotSelect {...{slot,setSlot}}/>
          <button type="submit" className="green-button button">Add meal</button>
        </form>
        <ol className="mp-days">{days.map(day=>{
          const date = dayDate(day);
          const dayMeals = meals.filter(meal => meal.day === day);
          return <li key={day} className={'mp-day'+(day===today?' mp-today':'')}>
            <div className="mp-date"><strong>{weekDay.format(date)}</strong><time dateTime={day}>{monthDay.format(date)}</time>{day===today && <small>Today</small>}</div>
            <div className="mp-day-content">{dayMeals.length > 0 && <ul className="mp-meals">
              {dayMeals.map(meal=><li key={meal.slot+meal.recipeId}><div><small>{meal.slot}</small><button className="mp-open-recipe" onClick={() => openRecipe(meal.recipeId)}>{meal.recipe.title}</button></div>
                <button className="mp-remove" aria-label={'Remove '+meal.recipe.title+' from '+meal.slot.toLowerCase()+' on '+fullDate.format(date)} onClick={()=>remove(meal)}><Icon name="close" size={16}/></button>
              </li>)}</ul>}
              <button className="mp-add-day" onClick={()=>chooseDay(day)} aria-label={'Choose a recipe for '+fullDate.format(date)}><Icon name="plus" size={15}/>Add a dish</button>
            </div>
          </li>;
        })}</ol>
      </section>
      <ShoppingList key={start+'|'+user.id} {...{start,items,notify,refresh}}/>
    </div>
  </main>;
}
