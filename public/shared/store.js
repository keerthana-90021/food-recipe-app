/* Shared by the React application and the plain JavaScript review build. */
(function () {
  'use strict';

  const prefix = 'supperclub.v1/';
  const admin = {
    id: 'demo-admin', name: 'Kitchen Admin', role: 'admin', email: 'admin@supperclub.test',
    salt: '581f3b9b03709c7b868c876dac780639',
    hash: 'de2db5229c19d94a60fcda2151c2232840fce6bc389b18b99c067030da362133'
  };

  function key(group, ...parts) {
    return prefix + [group, ...parts.map(encodeURIComponent)].join('/');
  }

  function read(storageKey, fallback = null) {
    try {
      const value = localStorage.getItem(storageKey);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      throw new Error('Browser storage is unavailable or damaged. Try opening the app in another browser profile.');
    }
  }

  function write(storageKey, value) {
    try {
      if (value === null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      throw new Error('Your browser could not save this change. Check the available browser storage and try again.');
    }
  }

  function entries(start) {
    const items = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const item = localStorage.key(index);
      if (item && item.startsWith(start)) items.push(read(item));
    }
    return items.filter(item => item !== null);
  }

  function id() {
    return hex(crypto.getRandomValues(new Uint8Array(16)));
  }

  function hex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function text(value, label, max, required = true) {
    const result = typeof value === 'string' ? value.trim() : '';
    if (required && !result) throw new Error('Enter ' + label + '.');
    if (result.length > max) throw new Error('Keep ' + label + ' within ' + max + ' characters.');
    return result;
  }

  function publicUser(person) {
    if (!person) return null;
    const { id, name, role, email } = person;
    return { id, name, role, email };
  }

  function findAccount(email) {
    return email === admin.email ? admin : read(key('accounts', email));
  }

  function currentUser() {
    const email = read(key('session'));
    return email ? publicUser(findAccount(email)) : null;
  }

  function requireUser() {
    const person = currentUser();
    if (!person) throw new Error('Sign in to continue.');
    return person;
  }

  function requireAdmin() {
    if (requireUser().role !== 'admin') throw new Error('Only an administrator can do that.');
  }

  async function passwordHash(password, salt) {
    if (!window.crypto || !crypto.subtle) {
      throw new Error('Open the app on localhost or HTTPS to sign in.');
    }
    const material = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bytes = Uint8Array.from(salt.match(/../g), part => parseInt(part, 16));
    const result = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: bytes, hash: 'SHA-256', iterations: 100000 }, material, 256
    );
    return hex(new Uint8Array(result));
  }

  async function signup(name, email, password) {
    name = text(name, 'your name', 80);
    email = text(email, 'your email address', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      throw new Error('Use a password between 8 and 128 characters.');
    }
    const salt = id();
    const person = { id: id(), name, email, role: 'user', salt, hash: await passwordHash(password, salt) };
    const register = () => {
      if (findAccount(email)) throw new Error('An account with this email already exists. Sign in instead.');
      write(key('accounts', email), person);
      write(key('session'), email);
      return publicUser(person);
    };
    return window.navigator?.locks ? navigator.locks.request(key('accounts', email), register) : register();
  }

  async function login(email, password) {
    const person = findAccount(text(email, 'your email address', 254).toLowerCase());
    if (!person || typeof password !== 'string' || password.length > 128 ||
        await passwordHash(password, person.salt) !== person.hash) {
      throw new Error('The email or password is incorrect.');
    }
    write(key('session'), person.email);
    return publicUser(person);
  }

  function logout() {
    write(key('session'), null);
  }

  function users() {
    requireAdmin();
    return [admin, ...entries(key('accounts') + '/')].map(publicUser);
  }

  function allRecipes() {
    const seeds = (window.KitchenSeeds || []).map(seed => ({
      author: 'Supperclub Kitchen', authorId: 'kitchen', ...seed,
      status: read(key('seed-status', seed.id), 'approved')
    }));
    return [...seeds, ...entries(key('recipes') + '/')];
  }

  function recipes() {
    const viewer = currentUser();
    return allRecipes().filter(recipe =>
      recipe.status === 'approved' || viewer?.role === 'admin' || (viewer && recipe.authorId === viewer.id)
    );
  }

  function approvedRecipe(recipeId) {
    const dish = allRecipes().find(recipe => recipe.id === recipeId && recipe.status === 'approved');
    if (!dish) throw new Error('This recipe is unavailable.');
    return dish;
  }

  function whole(value, label, maximum) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > maximum) {
      throw new Error('Enter ' + label + ' as a whole number from 1 to ' + maximum + '.');
    }
    return number;
  }

  function lines(value, label, maximum, length, minimum = 1) {
    const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\r?\n/) : [];
    const cleaned = items.map(item => text(item, label, length, false)).filter(Boolean);
    if (cleaned.length < minimum || cleaned.length > maximum) {
      throw new Error('Provide ' + minimum + ' to ' + maximum + ' entries for ' + label + '.');
    }
    return cleaned;
  }

  function recipeFields(input) {
    return {
      title: text(input.title, 'a recipe title', 100),
      description: text(input.description, 'the description', 600, false),
      cuisine: text(input.cuisine, 'the cuisine', 60),
      diet: [...new Set(lines(input.diet, 'dietary labels', 8, 40, 0))],
      time: whole(input.time, 'cooking time in minutes', 1440),
      servings: whole(input.servings, 'servings', 50),
      ingredients: lines(input.ingredients, 'ingredients', 50, 200),
      steps: lines(input.steps, 'preparation steps', 30, 600)
    };
  }

  function submitRecipe(input) {
    const author = requireUser();
    const dish = {
      ...recipeFields(input), id: 'dish-' + id(), authorId: author.id, author: author.name,
      status: 'pending', createdAt: new Date().toISOString(), image: ''
    };
    write(key('recipes', dish.id), dish);
    return dish;
  }

  function moderate(recipeId, status) {
    requireAdmin();
    if (status !== 'approved' && status !== 'rejected') throw new Error('Choose approve or reject.');
    const storageKey = key('recipes', recipeId);
    const dish = read(storageKey);
    if (dish) {
      const updated = { ...dish, status };
      write(storageKey, updated);
      return updated;
    }
    const seed = (window.KitchenSeeds || []).find(recipe => recipe.id === recipeId);
    if (!seed) throw new Error('This recipe could not be found.');
    write(key('seed-status', recipeId), status);
    return { ...seed, status };
  }

  function collectionList(person) {
    return [{ id: 'saved', name: 'Saved recipes' }, ...entries(key('collections', person.id) + '/')];
  }

  function collections() {
    const person = currentUser();
    if (!person) return [];
    const available = new Set(allRecipes().filter(dish => dish.status === 'approved').map(dish => dish.id));
    return collectionList(person).map(collection => ({
      ...collection,
      recipeIds: entries(key('members', person.id, collection.id) + '/').filter(recipeId => available.has(recipeId))
    }));
  }

  function createCollection(name) {
    const person = requireUser();
    name = text(name, 'a collection name', 60);
    if (collectionList(person).some(item => item.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('You already have a collection with that name.');
    }
    const collection = { id: id(), name };
    write(key('collections', person.id, collection.id), collection);
    return { ...collection, recipeIds: [] };
  }

  function setCollection(collectionId, recipeId, included) {
    const person = requireUser();
    if (typeof included !== 'boolean') throw new Error('Choose whether to include this recipe.');
    if (!collectionList(person).some(item => item.id === collectionId)) throw new Error('Collection not found.');
    if (included) approvedRecipe(recipeId);
    write(key('members', person.id, collectionId, recipeId), included ? recipeId : null);
    return included;
  }

  function isSaved(recipeId) {
    const person = currentUser();
    return Boolean(person && read(key('members', person.id, 'saved', recipeId)));
  }

  function save(recipeId) {
    return setCollection('saved', recipeId, !isSaved(recipeId));
  }

  function rating(recipeId) {
    const person = currentUser();
    const seed = (window.KitchenSeeds || []).find(item => item.id === recipeId);
    const baseCount = Number(seed?.ratingCount ?? seed?.baseCount) || 0;
    const baseRating = Number(seed?.ratingAverage ?? seed?.baseRating ?? seed?.rating) || 0;
    const votes = entries(key('ratings', recipeId) + '/');
    const count = baseCount + votes.length;
    const total = votes.reduce((sum, score) => sum + score, baseCount * baseRating);
    return {
      average: count ? Math.round(total / count * 10) / 10 : 0, count,
      mine: person ? read(key('ratings', recipeId, person.id), 0) : 0
    };
  }

  function rate(recipeId, stars) {
    const person = requireUser();
    approvedRecipe(recipeId);
    write(key('ratings', recipeId, person.id), whole(stars, 'a star rating', 5));
    return rating(recipeId);
  }

  // Imported snapshots stay outside the catalogue and the moderation queue.
  function shareToken(recipeId) {
    const dish = approvedRecipe(recipeId);
    if (!read(key('recipes', recipeId))) return '';
    const snapshot = { ...recipeFields(dish), id: dish.id, author: dish.author };
    const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function readShare(token) {
    try {
      if (typeof token !== 'string' || token.length > 180000 || !/^[A-Za-z0-9_-]+$/.test(token)) throw Error();
      const binary = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const raw = JSON.parse(new TextDecoder().decode(bytes));
      if (!/^dish-[\da-f]{32}$/.test(raw.id)) throw Error();
      return {
        ...recipeFields(raw), id: raw.id, author: text(raw.author, 'the author name', 80),
        authorId: '', status: 'shared', image: ''
      };
    } catch {
      throw new Error('This shared recipe link is incomplete or invalid.');
    }
  }

  window.KitchenStore = Object.freeze({
    currentUser, signup, login, logout, users, recipes, submitRecipe, moderate,
    collections, createCollection, setCollection, isSaved, save, rating, rate, shareToken, readShare
  });
})();
