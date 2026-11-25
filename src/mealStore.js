export const slots = ['Breakfast', 'Lunch', 'Dinner'];

export function localDay(date = new Date()) {
  return [String(date.getFullYear()).padStart(4, '0'), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function dayDate(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Choose a valid date.');
  // Noon keeps local calendar arithmetic clear of typical DST clock changes.
  const date = new Date(day + 'T12:00:00');
  if (!Number.isFinite(date.getTime()) || localDay(date) !== day) throw new Error('Choose a valid date.');
  return date;
}

export function shiftDay(day, offset) {
  const date = dayDate(day);
  date.setDate(date.getDate() + offset);
  return localDay(date);
}

export function weekStart(day = localDay()) {
  return shiftDay(day, -((dayDate(day).getDay() + 6) % 7));
}

function weekKey(day) {
  const user = window.KitchenStore.currentUser();
  if (!user) throw new Error('Sign in to use your meal planner.');
  return 'supperclub.v1/planner/' + encodeURIComponent(user.id) + '/' + weekStart(day) + '/';
}

function mealKey(day, slot, recipeId) {
  if (!slots.includes(slot)) throw new Error('Choose breakfast, lunch, or dinner.');
  return weekKey(day) + 'meal/' + day + '/' + slot + '/' + encodeURIComponent(recipeId);
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    throw new Error('Your browser could not save this change. Check that site storage is available.');
  }
}

export function addToPlan(recipeId, day, slot) {
  const key = mealKey(day, slot, recipeId);
  const recipes = window.KitchenStore.recipes().filter(recipe => recipe.status === 'approved');
  const available = recipes.some(recipe => recipe.id === recipeId);
  if (!available) throw new Error('Choose a published recipe.');
  const meals = plannedMeals(day, recipes);
  if (meals.some(meal=>meal.day === day && meal.slot === slot && meal.recipeId === recipeId)) return false;
  pruneBought(day, meals);
  write(key, JSON.stringify({day, slot, recipeId}));
  return true;
}

export function removeFromPlan(recipeId, day, slot) {
  write(mealKey(day, slot, recipeId), null);
  const recipes = window.KitchenStore.recipes().filter(recipe => recipe.status === 'approved');
  pruneBought(day,plannedMeals(day,recipes));
}

export function plannedMeals(day, approvedRecipes) {
  const prefix = weekKey(day) + 'meal/';
  const first = weekStart(day);
  const weekDays = new Set(Array.from({length:7},(_,index)=>shiftDay(first,index)));
  const recipes = new Map(approvedRecipes.map(recipe => [recipe.id, recipe]));
  const meals = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    let meal;
    try { meal = JSON.parse(localStorage.getItem(key)); }
    catch { continue; }
    const recipe = recipes.get(meal?.recipeId);
    if (!recipe || !slots.includes(meal.slot) || !weekDays.has(meal.day)) continue;
    if (key !== prefix + meal.day + '/' + meal.slot + '/' + encodeURIComponent(recipe.id)) continue;
    meals.push({day:meal.day,slot:meal.slot,recipeId:recipe.id,recipe});
  }
  return meals.sort((a, b) => a.day.localeCompare(b.day) || slots.indexOf(a.slot) - slots.indexOf(b.slot) || a.recipe.title.localeCompare(b.recipe.title));
}

const fractions = {'¼':1/4, '½':1/2, '¾':3/4, '⅓':1/3, '⅔':2/3, '⅛':1/8, '⅜':3/8, '⅝':5/8, '⅞':7/8};
const unitAliases = {
  'g':'g', 'gram':'g', 'grams':'g', 'kg':'kg', 'ml':'ml', 'l':'L',
  'tsp':'tsp', 'teaspoon':'tsp', 'teaspoons':'tsp', 'tbsp':'tbsp', 'tablespoon':'tbsp', 'tablespoons':'tbsp',
  'cup':'cup', 'cups':'cup', 'oz':'oz', 'lb':'lb', 'lbs':'lb'
};
const measuredLine = /^((?:\d+\s+)?\d+\/\d+|\d*\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:\.\d+)?)\s*([a-z]+)\.?\s+(.+)$/i;

function amountOf(number) {
  const tail = number.slice(-1);
  if (tail in fractions) return Number(number.slice(0, -1).trim() || 0) + fractions[tail];
  if (number.includes('/')) {
    const parts = number.split(/\s+/);
    const [numerator, denominator] = parts.pop().split('/').map(Number);
    return Number(parts[0] || 0) + numerator / denominator;
  }
  return Number(number);
}

function displayAmount(amount) {
  const whole = Math.floor(amount);
  for (const [symbol, value] of Object.entries(fractions)) {
    if (Math.abs(amount - whole - value) < 0.00001) return (whole || '') + symbol;
  }
  return String(Number(amount.toFixed(4)));
}

// Sum only matching units and full ingredient descriptions. Other lines retain their original quantities.
export function shoppingItems(meals) {
  const lines = new Map();
  for (const {recipe} of meals) {
    for (const raw of recipe.ingredients) {
      const text = raw.trim().replace(/\s+/g, ' ');
      if (!text) continue;
      const match = text.match(measuredLine);
      const unitName = match?.[2].toLowerCase();
      const unit = Object.hasOwn(unitAliases,unitName) ? unitAliases[unitName] : '';
      const parsed = unit ? amountOf(match[1].trim()) : NaN;
      const measured = Number.isFinite(parsed) && parsed > 0;
      const name = measured ? match[3] : text;
      const id = JSON.stringify([measured ? unit : '', name.toLowerCase()]);
      const item = lines.get(id) || {id, name, unit: measured ? unit : '', amount:0};
      item.amount += measured ? parsed : 1;
      lines.set(id, item);
    }
  }
  return [...lines.values()].map(item => ({...item,label:quantityLabel(item,item.amount)}))
    .sort((a,b) => a.name.localeCompare(b.name));
}

export function quantityLabel({name,unit},amount) {
  return unit ? displayAmount(amount) + ' ' + (unit === 'cup' && amount > 1 ? 'cups' : unit) + ' ' + name
    : name + (amount > 1 ? ' × ' + amount : '');
}

function checkKey(day, item) {
  return weekKey(day) + 'bought/' + encodeURIComponent(item.id);
}

function pruneBought(day, meals) {
  const prefix = weekKey(day) + 'bought/';
  const needed = new Set(shoppingItems(meals).map(item => prefix+encodeURIComponent(item.id)));
  for (let index=localStorage.length-1; index >= 0; index--) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix) && !needed.has(key)) write(key,null);
  }
}

export function stillNeeded(day, item) {
  const bought = Number(localStorage.getItem(checkKey(day, item)));
  if (!Number.isFinite(bought) || bought <= 0) return item.amount;
  return Number(Math.max(0,item.amount-bought).toFixed(6));
}

export function isBought(day, item) {
  return stillNeeded(day,item) === 0;
}

export function markBought(day, item, bought) {
  write(checkKey(day, item), bought ? String(item.amount) : null);
}
