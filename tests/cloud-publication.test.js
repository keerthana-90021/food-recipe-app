import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {openTestKitchen} from './support/kitchen-http.js';

function client(kitchen) {
  let cookie = '';
  return async function send(action, fields = {}, expected = 200) {
    const reply = await kitchen.request({
      method: action ? 'POST' : 'GET',
      headers: {origin: kitchen.origin, 'content-type': 'application/json', cookie},
      body: action ? JSON.stringify({action, ...fields}) : undefined
    });
    const data = JSON.parse(reply.body.toString('utf8'));
    assert.equal(reply.status, expected, action + ': ' + (data.error || reply.status));
    if (reply.headers['set-cookie']) {
      const [header] = reply.headers['set-cookie'];
      assert.match(header, /HttpOnly/i);
      cookie = header.split(';', 1)[0];
    }
    return data;
  };
}

test('the public cookbook follows admin moderation, revision conflicts and deletion across independent sessions', async t => {
  const kitchen = await openTestKitchen();
  t.after(() => kitchen.close());
  const guest = client(kitchen);
  const author = client(kitchen);
  const editor = client(kitchen);
  const credentials = {email: 'qa-author@example.test', password: randomBytes(24).toString('hex')};
  const input = {
    title: 'Tomato and pepper rasam', description: 'Pepper broth with tamarind and tomatoes.',
    cuisine: 'Indian', diet: ['Vegan'], time: 25, servings: 3,
    ingredients: ['3 tomatoes', '500 ml water', '1 tsp pepper'],
    steps: ['Crush the pepper.', 'Simmer the tomatoes and pepper in the water.']
  };
  const signup = await author('signup', {name: 'Test cook', ...credentials});
  assert.equal(signup.state.user, null);
  const user = (await author('login', credentials)).state.user;
  await editor('login', {email: kitchen.adminEmail, password: kitchen.adminPassword});
  const jpeg = await readFile(new URL('../public/images/masala-dosa.jpg', import.meta.url));
  const submittedInput = {...input, photo: 'data:image/jpeg;base64,' + jpeg.toString('base64')};
  const submitted = (await author('submitRecipe', {input: submittedInput})).state.recipes.find(dish => dish.title === input.title);
  assert.equal(submitted.status, 'pending');
  assert.equal((await guest()).state.recipes.some(dish => dish.id === submitted.id), false);
  assert.equal((await kitchen.request({path: submitted.image})).status, 404);
  const pending = (await editor()).state.recipes.find(dish => dish.id === submitted.id);
  assert.equal(pending.authorId, user.id);
  await editor('moderate', {id: pending.id, status: 'approved', note: '', revision: pending.revision});
  const published = (await guest()).state.recipes.find(dish => dish.id === submitted.id);
  assert.equal(published.status, 'approved');
  const photo = await kitchen.request({path: published.image});
  assert.equal(photo.status, 200);
  assert.equal(photo.headers['content-type'], 'image/jpeg');
  assert.deepEqual(photo.body, jpeg);
  const edited = {
    ...input, title: 'Roasted tomato and pepper rasam', image: 'masala-dosa.jpg'
  };
  await editor('editRecipe', {id: published.id, input: edited, revision: published.revision});
  await editor('editRecipe', {id: published.id, input, revision: published.revision}, 409);
  await editor('deleteRecipe', {id: published.id, revision: published.revision}, 409);
  const current = (await guest()).state.recipes.find(dish => dish.id === submitted.id);
  assert.equal(current.title, edited.title);
  assert.equal(current.image, edited.image);
  assert.equal((await kitchen.request({path: published.image})).status, 404);
  await editor('deleteRecipe', {id: current.id, revision: current.revision});
  assert.equal((await guest()).state.recipes.some(dish => dish.id === current.id), false);
  await editor('deleteUser', {id: user.id});
  assert.equal((await author()).state.user, null);
  await author('login', credentials, 401);
});
