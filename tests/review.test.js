import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = filename => readFileSync(new URL(filename, root), 'utf8');
const catalogSource = source('public/shared/recipes.js');
const storeSource = source('public/shared/store.js');
const password = 'my three kitchen notebooks';
const curry = {
  title:'Weeknight chickpeas', description:'A quick stovetop supper.', cuisine:'Indian',
  diet:['Vegan'], time:20, servings:2, ingredients:['1 tbsp oil','1 cup cooked chickpeas'],
  steps:['Warm the oil in a pan.','Add the chickpeas and stir until hot.']
};

class MemoryStorage {
  #items = new Map();
  get length() { return this.#items.size; }
  key(i) { return [...this.#items.keys()][i] ?? null; }
  getItem(key) { return this.#items.get(key) ?? null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
}
function browser() {
  const localStorage = new MemoryStorage();
  const context = vm.createContext({localStorage, sessionStorage:new MemoryStorage(), crypto:webcrypto,
    TextEncoder, TextDecoder, btoa, atob, console});
  context.window = context;
  vm.runInContext(catalogSource, context);
  vm.runInContext(storeSource, context);
  return {store:context.KitchenStore, recipes:context.KitchenSeeds, localStorage};
}

test('published catalogue has working images, unique links and non-vegetarian choices in all six requested cuisines', () => {
  const {recipes} = browser();
  assert.equal(new Set(recipes.map(r => r.id)).size, recipes.length);
  for (const recipe of recipes) {
    assert.ok(recipe.steps.length && recipe.ingredients.length, recipe.title);
    assert.ok(recipe.image && existsSync(new URL('public/images/'+recipe.image,root)), recipe.title);
    assert.ok(recipe.time > 0 && recipe.servings > 0, recipe.title);
  }
  for (const cuisine of ['Indian','Italian','Mexican','Chinese','Japanese','Korean']) {
    assert.ok(recipes.some(r => r.cuisine===cuisine && r.diet.includes('Non-vegetarian')), cuisine);
    assert.ok(recipes.some(r => r.cuisine===cuisine && (r.diet.includes('Vegetarian') || r.diet.includes('Vegan'))), cuisine);
  }
});

test('registration requires a separate login, preserves one rating per user and isolates saved dishes', async () => {
  const {store,localStorage} = browser();
  const id = 'tomato-pasta';
  await store.signup('Mourya','Mourya@example.test',password);
  assert.equal(store.currentUser(),null);
  await assert.rejects(store.login('mourya@example.test','incorrect'));
  await store.login('mourya@example.test',password);
  assert.equal(store.currentUser().role,'user');
  const account = JSON.parse(localStorage.getItem('supperclub.v1/accounts/mourya%40example.test'));
  assert.ok(account.salt && account.hash && !JSON.stringify(account).includes(password));
  store.setCollection('saved',id,true);
  store.rate(id,4);
  store.rate(id,5);
  assert.equal(store.rating(id).count,1);
  assert.equal(store.rating(id).average,5);
  store.logout();
  await store.signup('Second cook','cook2@example.test',password);
  await store.login('cook2@example.test',password);
  assert.equal(store.isSaved(id),false);
  assert.equal(store.rating(id).mine,0);
  assert.equal(store.rating(id).count,1);
});

test('rejection, revision and approval preserve the recipe link and enforce local visibility', async () => {
  const {store} = browser();
  await store.signup('Reviewer Cook','cook@example.test',password);
  await store.login('cook@example.test',password);
  assert.throws(() => store.submitRecipe({...curry,diet:['Vegan','Non-vegetarian']}));
  const recipe = store.submitRecipe(curry);
  const status = () => store.recipes().find(r => r.id===recipe.id)?.status;
  assert.equal(status(),'pending');
  assert.throws(() => store.moderate(recipe.id,'approved'));
  store.logout();
  assert.equal(status(),undefined);
  await store.login('admin@supperclub.test','KitchenAdmin27!');
  assert.throws(() => store.moderate(recipe.id,'rejected',''));
  const declined = store.moderate(recipe.id,'rejected','Please specify the amount of oil.',0);
  store.logout();
  await store.login('cook@example.test',password);
  const revised = store.resubmitRecipe(recipe.id,{...curry,description:'Now includes exact quantities.'},declined.revision);
  assert.equal(revised.id,recipe.id);
  assert.equal(status(),'pending');
  store.logout();
  await store.login('admin@supperclub.test','KitchenAdmin27!');
  assert.throws(() => store.moderate(recipe.id,'approved','',0));
  const approved = store.moderate(recipe.id,'approved','',revised.revision);
  const link = store.shareToken(recipe.id);
  assert.equal(browser().store.readShare(link).status,'shared');
  store.moderate(recipe.id,'rejected','Withdrawn for correction.',approved.revision);
  store.logout();
  assert.equal(status(),undefined);
  assert.throws(() => store.readShare(link));
});
