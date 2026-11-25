/* Shared by the React application and the plain JavaScript review build. */
(function () {
  'use strict';

  const prefix = 'supperclub.v1/';
  const passwordMinLength = 15;
  const passwordVersion = 2;
  const passwordAlgorithm = 'PBKDF2-SHA256';
  const passwordIterations = 600000;
  const legacyIterations = 100000;
  const standardDiets = ['Vegetarian','Vegan','Non-vegetarian','Contains egg','Gluten-free','Dairy-free'];
  const sessionDuration = 8 * 60 * 60 * 1000;
  let expiryTimer;
  let scheduledExpiry = 0;
  let signupReceipt = null;
  const admin = {
    id: 'demo-admin', name: 'Kitchen Admin', role: 'admin', email: 'admin@supperclub.test',
    passwordVersion, passwordAlgorithm, passwordIterations,
    salt: 'f3e6695d5a81a198a4e8ee7914ae34e6',
    hash: '7de49fc6d0419552f1536b1c3e375b5aa239b15c7b0b5d20d8e4968248a78913'
  };

  function key(group, ...parts) {
    return prefix + [group, ...parts.map(encodeURIComponent)].join('/');
  }

  function read(storageKey, fallback = null) {
    try {
      const value = localStorage.getItem(storageKey);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      // A damaged record or disabled local storage must not hide the public recipe book.
      return fallback;
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
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const item = localStorage.key(index);
        if (item && item.startsWith(start)) items.push(read(item));
      }
    } catch { return items.filter(item => item !== null); }
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
    if (!person || typeof person.id !== 'string' || typeof person.email !== 'string' || typeof person.name !== 'string' || !person.name.trim()) return null;
    const { id, name, email } = person;
    return { id, name, email, role: person === admin ? 'admin' : 'user' };
  }

  function findAccount(email) {
    return email === admin.email ? admin : read(key('accounts', email));
  }

  function scheduleExpiry(expiresAt) {
    if (scheduledExpiry === expiresAt || !window.setTimeout) return;
    window.clearTimeout(expiryTimer);
    scheduledExpiry = expiresAt;
    if (expiresAt) {
      expiryTimer = window.setTimeout(() => {
        scheduledExpiry = 0;
        if (!currentUser()) window.dispatchEvent(new Event('supperclub:session-expired'));
      }, Math.max(0, expiresAt - Date.now()));
    }
  }

  function currentUser() {
    const session = read(key('session'));
    if (!session) { scheduleExpiry(0); return null; }
    // The previous email-only session has no expiry. Its owner can sign in again.
    if (typeof session.email !== 'string' || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
      write(key('session'), null);
      scheduleExpiry(0);
      return null;
    }
    scheduleExpiry(session.expiresAt);
    return publicUser(findAccount(session.email));
  }

  function requireUser() {
    const person = currentUser();
    if (!person) throw new Error('Sign in to continue.');
    return person;
  }

  function requireAdmin() {
    if (requireUser().role !== 'admin') throw new Error('Only an administrator can do that.');
  }

  async function passwordHash(password, salt, iterations) {
    if (!window.crypto || !crypto.subtle) {
      throw new Error('Open the app on localhost or HTTPS to sign in.');
    }
    const material = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bytes = Uint8Array.from(salt.match(/../g), part => parseInt(part, 16));
    const result = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: bytes, hash: 'SHA-256', iterations }, material, 256
    );
    return hex(new Uint8Array(result));
  }

  async function passwordRecord(password) {
    const salt = id();
    return { salt, hash: await passwordHash(password, salt, passwordIterations),
      passwordVersion, passwordAlgorithm, passwordIterations };
  }

  // This optional per-tab hint pre-fills the next login form. It grants no access.
  function rememberSignup(receipt) {
    signupReceipt = receipt;
    try {
      if (receipt) window.sessionStorage.setItem(key('signup-receipt'), JSON.stringify(receipt));
      else window.sessionStorage.removeItem(key('signup-receipt'));
    } catch { /* The in-memory hint still works when session storage is unavailable. */ }
  }

  function recentSignup() {
    try {
      const receipt = JSON.parse(window.sessionStorage.getItem(key('signup-receipt')));
      return receipt && typeof receipt.name === 'string' && typeof receipt.email === 'string' ? receipt : signupReceipt;
    } catch { return signupReceipt; }
  }

  async function signup(name, email, password) {
    name = text(name, 'your name', 80);
    email = text(email, 'your email address', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
    if (typeof password !== 'string' || [...password].length < passwordMinLength || password.length > 128) {
      throw new Error('Use a passphrase between ' + passwordMinLength + ' and 128 characters.');
    }
    const passwordFields = await passwordRecord(password);
    const person = { id: id(), name, email, role: 'user', ...passwordFields };
    const register = () => {
      if (findAccount(email)) throw new Error('An account with this email already exists. Sign in instead.');
      write(key('accounts', email), person);
      rememberSignup({ name, email });
      return publicUser(person);
    };
    return window.navigator?.locks ? navigator.locks.request(key('accounts', email), register) : register();
  }

  async function login(email, password) {
    const person = findAccount(text(email, 'your email address', 254).toLowerCase());
    const legacy = person && person.passwordVersion === undefined;
    const knownVersion = person?.passwordVersion === passwordVersion &&
      person.passwordAlgorithm === passwordAlgorithm && person.passwordIterations === passwordIterations;
    if (!publicUser(person) || typeof password !== 'string' || password.length > 128 ||
        typeof person.salt !== 'string' || !/^[\da-f]{32}$/i.test(person.salt) ||
        (!legacy && !knownVersion) ||
        await passwordHash(password, person.salt, legacy ? legacyIterations : passwordIterations) !== person.hash) {
      throw new Error('The email or password is incorrect.');
    }
    if (legacy) {
      write(key('accounts', person.email), { ...person, ...await passwordRecord(password) });
    }
    const expiresAt = Date.now() + sessionDuration;
    write(key('session'), {email:person.email, expiresAt});
    scheduleExpiry(expiresAt);
    rememberSignup(null);
    return publicUser(person);
  }

  function logout() {
    write(key('session'), null);
    scheduleExpiry(0);
    rememberSignup(null);
  }

  function users() {
    requireAdmin();
    return [admin, ...entries(key('accounts') + '/')].map(publicUser).filter(Boolean);
  }

  function allRecipes() {
    const seeds = (window.KitchenSeeds || []).map(seed => ({
      author: 'Supperclub Kitchen', authorId: 'kitchen', ...seed,
      status: read(key('seed-status', seed.id), 'approved')
    }));
    const community = entries(key('recipes') + '/').filter(dish =>
      typeof dish.id === 'string' && typeof dish.title === 'string' && typeof dish.authorId === 'string' &&
      typeof dish.author === 'string' && typeof dish.cuisine === 'string' &&
      ['approved','pending','rejected'].includes(dish.status) && Number.isInteger(dish.time) && Number.isInteger(dish.servings) &&
      [dish.ingredients, dish.steps, dish.diet].every(list => Array.isArray(list) && list.every(item => typeof item === 'string'))
    );
    return [...seeds, ...community.map(dish => ({...dish, diet: dietaryLabels(dish.diet, false)}))];
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

  function dietaryLabels(values, validate) {
    const keyFor = label => label.toLowerCase().replace(/[\s_-]+/g,'');
    const labels = [...new Set(values.map(label => standardDiets.find(known => keyFor(known) === keyFor(label)) || label.trim()))];
    const excluded = new Set();
    if (labels.includes('Non-vegetarian')) { excluded.add('Vegetarian'); excluded.add('Vegan'); }
    if (labels.includes('Contains egg')) excluded.add('Vegan');
    if (validate && labels.some(label => excluded.has(label))) throw new Error('Review the dietary labels. The selected preferences are incompatible.');
    return labels.filter(label => !excluded.has(label));
  }

  function recipeFields(input) {
    return {
      title: text(input.title, 'a recipe title', 100),
      description: text(input.description, 'the description', 600, false),
      cuisine: text(input.cuisine, 'the cuisine', 60),
      diet: dietaryLabels(lines(input.diet, 'dietary labels', 8, 40, 0), true),
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

  function moderate(recipeId, status, note = '', expectedRevision) {
    requireAdmin();
    if (status !== 'approved' && status !== 'rejected') throw new Error('Choose approve or reject.');
    const storageKey = key('recipes', recipeId);
    const dish = read(storageKey);
    if (!dish) throw new Error('This submission could not be found.');
    const revision = dish.revision || 0;
    if ((expectedRevision !== undefined && revision !== expectedRevision) || dish.status === status) {
      throw new Error('This submission has already changed. Reopen it to see the latest review.');
    }
    const reviewNote = status === 'rejected' ? text(note, 'feedback explaining what the cook should change', 400) : '';
    const updated = { ...dish, status, reviewNote, revision: revision + 1, reviewedAt: new Date().toISOString() };
    write(storageKey, updated);
    return updated;
  }

  function resubmitRecipe(recipeId, input, expectedRevision) {
    const author = requireUser();
    const storageKey = key('recipes', recipeId);
    const dish = read(storageKey);
    if (!dish || dish.authorId !== author.id || dish.status !== 'rejected') {
      throw new Error('Only the author can revise a declined recipe.');
    }
    const revision = dish.revision || 0;
    if (expectedRevision !== undefined && expectedRevision !== revision) throw new Error('A newer revision is available. Reopen this recipe before editing.');
    const updated = { ...dish, ...recipeFields(input), status: 'pending', revision: revision + 1, updatedAt: new Date().toISOString() };
    write(storageKey, updated);
    return updated;
  }

  function collectionList(person) {
    return [{ id: 'saved', name: 'Saved recipes' }, ...entries(key('collections', person.id) + '/').filter(
      group => typeof group.id === 'string' && typeof group.name === 'string'
    )];
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
    const votes = entries(key('ratings', recipeId) + '/').filter(vote => Number.isInteger(vote) && vote >= 1 && vote <= 5);
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
      const local = read(key('recipes', raw.id));
      if (local) {
        if (local.status !== 'approved') throw Error();
        return approvedRecipe(raw.id);
      }
      return {
        ...recipeFields(raw), id: raw.id, author: text(raw.author, 'the author name', 80),
        authorId: '', status: 'shared', image: ''
      };
    } catch {
      throw new Error('This shared recipe link is incomplete or invalid.');
    }
  }

  window.KitchenStore = Object.freeze({
    currentUser, signup, recentSignup, passwordMinLength, login, logout, users, recipes, submitRecipe, resubmitRecipe, moderate,
    collections, createCollection, setCollection, isSaved, save, rating, rate, shareToken, readShare
  });
})();
