(function classic() {
  'use strict';
  const store = window.KitchenStore;
  const main = document.getElementById('main');
  const nav = document.getElementById('nav');
  const notice = document.getElementById('notice');
  const filters = { query: '', cuisine: '', diet: '' };
  let returnTo = '';
  let noticeTimer;

  function html(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  }
  function say(message) {
    clearTimeout(noticeTimer);
    notice.textContent = message;
    noticeTimer = setTimeout(() => { notice.textContent = ''; }, 3600);
  }
  function route() {
    const [path, query = ''] = location.hash.slice(1).split('?');
    const [page, id = ''] = (path || 'explore').split('/');
    return { page, id: decodeURIComponent(id), query: new URLSearchParams(query) };
  }
  function go(path) {
    if (location.hash === '#' + path) render();
    else location.hash = path;
  }
  function detailUrl(id) { return '#recipe/' + encodeURIComponent(id); }
  function approved() { return store.recipes().filter(recipe => recipe.status === 'approved'); }
  function current() { return store.currentUser(); }
  function requireLogin() {
    if (current()) return true;
    returnTo = location.hash.slice(1) || 'explore';
    go('login');
    return false;
  }
  function navbar(page) {
    const person = current();
    const links = [['explore', 'Explore'], ['collections', 'My cookbook'], ['submit', 'Submit a recipe']];
    if (person?.role === 'admin') links.push(['admin', 'Admin']);
    nav.innerHTML = links.map(([path, label]) => `<a href="#${path}" ${page === path ? 'aria-current="page"' : ''}>${label}</a>`).join('')
      + (person ? '<button class="textbtn" data-action="logout">Log out</button>' : '<a class="button" href="#login">Log in</a>');
  }
  function art(recipe, cls) {
    const image = /^[a-z0-9][a-z0-9._-]*$/i.test(recipe.image || '') ? recipe.image : '';
    return `<div class="${cls}">${image
      ? `<img src="../images/${encodeURIComponent(image)}" alt="${html(recipe.title)}" ${cls === 'thumb' ? 'loading="lazy"' : ''}>`
      : '<div class="art" aria-hidden="true">sc</div>'}</div>`;
  }
  function eyebrow(text) { return `<p class="eyebrow">${html(text)}</p>`; }
  function empty(title, detail, action = '') {
    return `<div class="empty"><h3>${html(title)}</h3><p>${html(detail)}</p>${action}</div>`;
  }
  function card(recipe) {
    const saved = current() && store.isSaved(recipe.id);
    return `<article class="card"><a class="card-link" href="${detailUrl(recipe.id)}">${art(recipe, 'thumb')}
      <div class="cardmeta"><span>${html(recipe.cuisine)}</span><span>${html(recipe.time)} min</span></div><h3>${html(recipe.title)}</h3></a>
      <button class="save" data-action="save" data-id="${html(recipe.id)}" aria-pressed="${!!saved}" aria-label="${saved ? 'Unsave' : 'Save'} ${html(recipe.title)}">${saved ? 'Saved' : 'Save'}</button></article>`;
  }
  function options(values, selected, first) {
    return `<option value="">${html(first)}</option>` + [...new Set(values.filter(Boolean))].sort().map(value =>
      `<option ${value === selected ? 'selected' : ''} value="${html(value)}">${html(value)}</option>`).join('');
  }
  function catalogue() {
    const list = approved();
    const featured = list.find(recipe => recipe.id === 'tomato-pasta') || list[0];
    main.innerHTML = (featured ? `<section class="hero"><div class="hero-text">${eyebrow('Recipe of the day')}<h1>${html(featured.title)}</h1>
      <p>${html(featured.description)}</p><a class="button" href="${detailUrl(featured.id)}">Cook this recipe</a></div>${art(featured, 'hero-media')}</section>` : '')
      + `<section aria-labelledby="explore-title"><div class="sectionhead"><h2 id="explore-title">Explore recipes</h2></div>
        <div class="filters"><label class="filter-search">Search recipes or ingredients<input type="search" id="search" placeholder="Try tomatoes or pasta" value="${html(filters.query)}"></label>
        <label>Cuisine<select id="cuisine-filter">${options(list.map(r => r.cuisine), filters.cuisine, 'All cuisines')}</select></label>
        <label>Dietary preference<select id="diet-filter">${options(list.flatMap(r => r.diet), filters.diet, 'All preferences')}</select></label>
        <button class="textbtn under" data-action="reset">Reset</button></div><div id="results"></div></section>`;
    showResults();
  }
  function showResults() {
    const terms = filters.query.trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
    const list = approved().filter(recipe => {
      const searchable = [recipe.title, recipe.cuisine, ...recipe.diet, ...recipe.ingredients].join(' ').toLowerCase();
      return (!filters.cuisine || recipe.cuisine === filters.cuisine) && (!filters.diet || recipe.diet.includes(filters.diet))
        && terms.every(term => searchable.includes(term));
    });
    document.getElementById('results').innerHTML = `<p class="count" aria-live="polite">${list.length} ${list.length === 1 ? 'recipe' : 'recipes'}</p>`
      + (list.length ? `<div class="grid">${list.map(card).join('')}</div>` : empty('No recipes found', 'Try a different ingredient or clear a filter.', '<button class="button light" data-action="reset">Clear filters</button>'));
  }
  function back() { return '<a class="back" href="#explore">Explore recipes</a>'; }
  function detail(id, token) {
    let recipe = store.recipes().find(r => r.id === id);
    if (!recipe && token) {
      const shared = store.readShare(token);
      if (shared.id === id) recipe = shared;
    }
    if (!recipe) { main.innerHTML = back() + empty('Recipe unavailable', 'Choose a recipe from the catalogue.'); return; }
    const published = recipe.status === 'approved';
    const portable = recipe.status === 'shared';
    const user = current();
    const rating = published ? store.rating(id) : null;
    const toggles = published && user ? store.collections().filter(c => c.id !== 'saved').map(c =>
      `<label class="check"><input type="checkbox" data-collection="${html(c.id)}" data-id="${html(id)}" ${c.recipeIds.includes(id) ? 'checked' : ''}><span>${html(c.name)}</span></label>`).join('') : '';
    main.innerHTML = `${back()}<section class="detail-intro"><div>${eyebrow(recipe.cuisine)}<h1>${html(recipe.title)}</h1>
      <p class="sub">${html(recipe.description)}</p><p class="meta">By ${html(recipe.author || 'Supperclub Kitchen')}</p>
      <div class="stats"><span><b>${html(recipe.time)}</b> min</span><span><b>${html(recipe.servings)}</b> servings</span>
      ${rating ? `<span>${rating.count ? `★ ${Number(rating.average).toFixed(1)} (${rating.count})` : 'No ratings yet'}</span>` : ''}</div>
      <div class="actions">${recipe.diet.map(d => `<span class="pill">${html(d)}</span>`).join('')}
      ${published ? `<button class="button" data-action="save" data-id="${html(id)}" aria-pressed="${!!(user && store.isSaved(id))}">${user && store.isSaved(id) ? 'Saved to cookbook' : 'Save recipe'}</button>` : `<span class="status">${html(recipe.status)}</span>`}
      ${published || portable ? `<button class="button light" data-action="share" data-id="${html(id)}">Share recipe</button>` : ''}</div>
      <div id="share-fallback"></div></div>${art(recipe, 'detail-photo')}</section>
      <div class="detail-body"><section class="panel"><h2>Ingredients</h2><ul class="ingredients">${recipe.ingredients.map(item => `<li><label class="check"><input type="checkbox"><span>${html(item)}</span></label></li>`).join('')}</ul></section>
      <section><h2>Method</h2><ol class="method">${recipe.steps.map(step => `<li>${html(step)}</li>`).join('')}</ol></section></div>
      ${published ? `<div class="detail-actions"><section class="panel"><h3>Your rating</h3>${user ? `<div class="starrow">${[1,2,3,4,5].map(n => `<button class="star" aria-label="Rate ${n} out of 5" aria-pressed="${rating.mine === n}" data-action="rate" data-id="${html(id)}" data-stars="${n}">${n} ★</button>`).join('')}</div>` : '<button class="textbtn under" data-action="signin">Log in to rate this recipe</button>'}</section>
      <section class="panel"><h3>Add to collections</h3>${user ? `${toggles}<a class="under" href="#collections">Manage collections</a>` : '<button class="textbtn under" data-action="signin">Log in to organize your recipes</button>'}</section></div>` : ''}`;
  }
  function auth(register) {
    main.innerHTML = `<div class="authbox panel"><form id="${register ? 'signup' : 'login'}" class="formgrid">${eyebrow('Your cookbook')}
      <h1>${register ? 'Join Supperclub' : 'Welcome back'}</h1>
      ${register ? '<label>Your name<input name="name" autocomplete="name" required maxlength="80"></label>' : ''}
      <label>Email address<input type="email" name="email" autocomplete="email" required></label>
      <label>Password<input type="password" name="password" autocomplete="${register ? 'new-password' : 'current-password'}" required ${register ? 'minlength="8" maxlength="128"' : ''}>${register ? '<span class="tip">Use at least 8 characters.</span>' : ''}</label>
      <p class="form-error" role="alert"></p><button class="button" type="submit">${register ? 'Create account' : 'Log in'}</button>
      <p>${register ? 'Already a member? <a href="#login">Log in</a>' : 'New to Supperclub? <a href="#signup">Create an account</a>'}</p></form>
      ${register ? '' : '<details><summary>Admin review account</summary><p>Email <b>admin@supperclub.test</b><br>Password <b>KitchenAdmin27!</b></p></details>'}</div>`;
  }
  function cookedCollection(id) {
    const person = current();
    const groups = store.collections();
    const active = groups.find(group => group.id === id) || groups.find(group => group.id === 'saved') || groups[0];
    const list = approved().filter(recipe => active?.recipeIds.includes(recipe.id));
    const mine = store.recipes().filter(recipe => recipe.authorId === person.id);
    main.innerHTML = `<section class="intro">${eyebrow(person.name + '’s kitchen')}<h1>My cookbook</h1></section>
      <form id="collection" class="book-create"><label>New collection<input name="name" maxlength="60" required placeholder="Weeknight dinners"></label><button class="button">Create collection</button><p class="form-error" role="alert"></p></form>
      <nav class="tabs" aria-label="Recipe collections">${groups.map(group => `<a href="#collections/${encodeURIComponent(group.id)}" aria-current="${active?.id === group.id}">${html(group.name)} (${group.recipeIds.length})</a>`).join('')}</nav>
      ${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : empty('No recipes here yet', 'Open a recipe to save it or add it to a collection.', '<a class="button light" href="#explore">Browse recipes</a>')}
      <section class="shelf"><div class="sectionhead"><h2>My submissions</h2><a href="#submit" class="under">Submit a recipe</a></div>
      ${mine.length ? `<div class="rows">${mine.map(r => `<div class="row"><a href="${detailUrl(r.id)}">${html(r.title)}</a><span class="status ${html(r.status)}">${html(r.status)}</span></div>`).join('')}</div>` : '<p class="soft">Recipes you submit will appear here for you to track.</p>'}</section>`;
  }
  function submitPage() {
    main.innerHTML = `<div class="formbox"><div class="intro">${eyebrow('Community kitchen')}<h1>Submit a recipe</h1><p>Share a dish you love. An admin reviews each recipe before it appears in Explore.</p></div>
      <form id="submit-recipe" class="formgrid panel"><label>Recipe name<input name="title" required maxlength="100"></label>
      <label>Description<textarea name="description" rows="2" maxlength="600"></textarea></label>
      <div class="double"><label>Cuisine<input name="cuisine" required maxlength="60" placeholder="e.g. Indian"></label>
      <label>Dietary preferences<input name="diet" placeholder="e.g. Vegetarian, Gluten-free"><span class="tip">Optional, separated by commas.</span></label></div>
      <div class="double"><label>Total time (minutes)<input type="number" name="time" min="1" max="1440" required></label><label>Servings<input type="number" name="servings" min="1" max="50" required></label></div>
      <label>Ingredients<textarea name="ingredients" required rows="5" placeholder="2 cups cooked rice"></textarea><span class="tip">Include quantities and use one line per ingredient.</span></label>
      <label>Method<textarea name="steps" required rows="6" placeholder="Rinse the rice until the water runs clear."></textarea><span class="tip">Use one line per step.</span></label>
      <p class="form-error" role="alert"></p><button class="button">Submit for review</button></form></div>`;
  }
  function adminPage(status) {
    const recipes = store.recipes();
    const group = ['pending','approved','rejected'].includes(status) ? status : 'pending';
    const list = recipes.filter(r => r.status === group);
    main.innerHTML = `<div class="intro">${eyebrow('Admin workspace')}<h1>Recipe moderation</h1><p>Review the ingredients and method of each submission before publishing it to the catalogue.</p></div>
      <nav class="tabs" aria-label="Moderation status">${['pending','approved','rejected'].map(s => `<a href="#admin/${s}" aria-current="${s === group}">${s[0].toUpperCase() + s.slice(1)} (${recipes.filter(r => r.status === s).length})</a>`).join('')}</nav>
      ${list.length ? `<div class="rows">${list.map(r => `<article class="row"><div><h3><a href="${detailUrl(r.id)}">${html(r.title)}</a></h3><p class="meta">${html(r.cuisine)} · ${html(r.author)} · ${html(r.time)} min</p>${group === 'pending' ? `<details><summary>Read submission</summary><p>${html(r.description)}</p><b>Ingredients</b><ul>${r.ingredients.map(a=>`<li>${html(a)}</li>`).join('')}</ul><b>Method</b><ol>${r.steps.map(a=>`<li>${html(a)}</li>`).join('')}</ol></details>` : ''}</div>
      ${group === 'pending' ? `<div class="actions"><button class="button" data-action="moderate" data-id="${html(r.id)}" data-value="approved">Approve</button><button class="button light" data-action="moderate" data-id="${html(r.id)}" data-value="rejected">Reject</button></div>` : `<span class="status ${group}">${group}</span>`}</article>`).join('')}</div>`
      : empty('No ' + group + ' recipes', group === 'pending' ? 'New recipe submissions will appear here for review.' : 'Recipes with this status will appear here.')} `;
  }
  function render() {
    try {
      const {page, id, query} = route();
      const person = current();
      if (['collections','submit','admin'].includes(page) && !requireLogin()) return;
      if (page === 'admin' && person.role !== 'admin') { go('collections'); say('An admin account is required.'); return; }
      if (['login','signup'].includes(page) && person) { go(person.role === 'admin' ? 'admin' : 'collections'); return; }
      navbar(page);
      switch (page) {
        case 'explore': catalogue(); break;
        case 'recipe': detail(id, query.get('shared')); break;
        case 'collections': cookedCollection(id); break;
        case 'submit': submitPage(); break;
        case 'admin': adminPage(id); break;
        case 'login': case 'signup': auth(page === 'signup'); break;
        default: main.innerHTML = back() + empty('Page unavailable', 'Return to Explore to browse the recipe book.');
      }
      document.title = `${main.querySelector('h1,h2,h3')?.textContent || 'Recipe book'} · Supperclub`;
    } catch (error) {
      main.innerHTML = back() + empty('Unable to open this page', error.message || 'Try opening the recipe catalogue.');
    }
  }
  function resetFilters() { Object.assign(filters, {query: '', cuisine: '', diet: ''}); catalogue(); }
  async function share(id) {
    const url = new URL(location.href);
    const existingToken = route().query.get('shared');
    const token = existingToken || store.shareToken(id);
    url.hash = detailUrl(id).slice(1) + (token ? '?shared=' + encodeURIComponent(token) : '');
    let content = url.href;
    const localFile = url.protocol === 'file:';
    if (localFile) {
      const recipe = store.recipes().find(r => r.id === id) || store.readShare(existingToken);
      content = [
        recipe.title, 'By ' + recipe.author, recipe.time + ' min · Serves ' + recipe.servings,
        '', 'Ingredients', ...recipe.ingredients.map(item => '• ' + item),
        '', 'Method', ...recipe.steps.map((step, i) => (i + 1) + '. ' + step)
      ].join('\n');
    }
    try {
      await navigator.clipboard.writeText(content);
      say(localFile ? 'Recipe text copied.' : 'Recipe link copied.');
    } catch {
      const box = document.getElementById('share-fallback');
      box.innerHTML = localFile
        ? '<label>Copy this recipe<textarea rows="6" readonly></textarea></label>'
        : '<label>Copy this recipe link<input type="text" readonly></label>';
      const field = box.querySelector('textarea, input');
      field.value = content;
      field.select();
    }
  }
  document.addEventListener('click', async event => {
    const skip = event.target.closest('a.skip');
    if (skip) { event.preventDefault(); main.focus(); return; }
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const {action, id, stars, value} = button.dataset;
    try {
      switch (action) {
        case 'reset': resetFilters(); break;
        case 'logout': store.logout(); returnTo = ''; go('explore'); say('Logged out.'); break;
        case 'signin': requireLogin(); break;
        case 'share': await share(id); break;
        case 'save':
          if (requireLogin()) { const saved = store.save(id); render(); say(saved ? 'Recipe saved to your cookbook.' : 'Recipe removed from Saved recipes.'); } break;
        case 'rate':
          if (requireLogin()) { store.rate(id, Number(stars)); render(); say('Your rating has been saved.'); } break;
        case 'moderate':
          store.moderate(id, value); render(); say(value === 'approved' ? 'Recipe approved and published.' : 'Recipe rejected.'); break;
      }
    } catch (error) { say(error.message); }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'search') { filters.query = event.target.value; showResults(); }
  });
  document.addEventListener('change', event => {
    const el = event.target;
    if (el.id === 'cuisine-filter' || el.id === 'diet-filter') { filters[el.id.split('-')[0]] = el.value; showResults(); }
    if (el.dataset.collection) {
      try { store.setCollection(el.dataset.collection, el.dataset.id, el.checked); say('Collection updated.'); }
      catch (error) { el.checked = !el.checked; say(error.message); }
    }
  });
  document.addEventListener('submit', async event => {
    const form = event.target;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const errorBox = form.querySelector('.form-error');
    errorBox.textContent = '';
    const submit = form.querySelector('button[type="submit"], button:last-of-type');
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      if (form.id === 'login' || form.id === 'signup') {
        const user = form.id === 'login' ? await store.login(data.email, data.password) : await store.signup(data.name, data.email, data.password);
        const destination = user.role === 'admin' ? 'admin' : returnTo && !returnTo.startsWith('admin') ? returnTo : 'collections';
        returnTo = ''; go(destination); say(`Welcome, ${user.name}.`);
      } else if (form.id === 'collection') {
        const collection = store.createCollection(data.name);
        go('collections/' + encodeURIComponent(collection.id)); say('Collection created.');
      } else if (form.id === 'submit-recipe') {
        data.diet = data.diet.split(',').map(d => d.trim()).filter(Boolean);
        for (const key of ['ingredients','steps']) data[key] = data[key].split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        data.time = Number(data.time); data.servings = Number(data.servings);
        store.submitRecipe(data); go('collections'); say('Recipe submitted for admin review.');
      }
    } catch (error) { errorBox.textContent = error.message; }
    finally { submit.disabled = false; }
  });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0,0); main.focus({preventScroll:true}); });
  window.addEventListener('storage', () => render());
  render();
})();

