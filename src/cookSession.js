import {useEffect, useRef, useState} from 'react';

const blank = () => ({checked:[], done:[], timer:null});
const validIndices = (list, limit) => Array.isArray(list)
  ? [...new Set(list.filter(value => Number.isInteger(value) && value >= 0 && value < limit))] : [];
const maxDuration = 180 * 60000;

function validTimer(timer) {
  if (!timer || !Number.isInteger(timer.remaining) || timer.remaining < 1 || timer.remaining > maxDuration) return null;
  if (timer.end !== null && (!Number.isSafeInteger(timer.end) || timer.end <= 0)) return null;
  return {remaining:timer.remaining, end:timer.end};
}

// Shared snapshots remain temporary. Guest sessions last for the current browser tab.
export function useCookSession(recipe, user, notify) {
  const revision = JSON.stringify([recipe.ingredients, recipe.steps]);
  const owner = user?.id || null;
  const key = ['supperclub.v1/cook', encodeURIComponent(owner || 'guest'), encodeURIComponent(recipe.id)].join('/');
  function storage() {
    if (recipe.status === 'shared') return null;
    return owner ? window.localStorage : window.sessionStorage;
  }
  function read(fallback) {
    try {
      const source = storage();
      if (!source) return fallback;
      const item = JSON.parse(source.getItem(key));
      if (item?.revision !== revision) return blank();
      return {
        checked:validIndices(item.checked, recipe.ingredients.length),
        done:validIndices(item.done, recipe.steps.length),
        timer:validTimer(item.timer)
      };
    } catch { return fallback; }
  }
  const [progress,setProgress] = useState(() => read(blank()));
  const memory = useRef(progress);
  const unsaved = useRef(false);
  useEffect(() => {
    function sync(event) {
      if (event.key && event.key !== key) return;
      const next = read(memory.current);
      memory.current = next;
      setProgress(next);
    }
    window.addEventListener('storage',sync);
    return () => window.removeEventListener('storage',sync);
  },[key,revision]);

  function change(update) {
    if ((window.KitchenStore.currentUser()?.id || null) !== owner) return;
    const latest = unsaved.current ? memory.current : read(memory.current);
    const next = update(latest);
    try {
      const target = storage();
      if (target) {
        if (!next.checked.length && !next.done.length && !next.timer) target.removeItem(key);
        else target.setItem(key,JSON.stringify({...next,revision}));
      }
      unsaved.current = false;
    } catch {
      if (!unsaved.current) notify('Your changes work here, but this browser could not save them.');
      unsaved.current = true;
    }
    memory.current = next;
    setProgress(next);
  }
  const toggle = (field, index) => change(latest => {
    const list = latest[field];
    return {...latest, [field]:list.includes(index) ? list.filter(value => value !== index) : [...list,index]};
  });
  return {
    ...progress,
    toggleIngredient:index => toggle('checked',index),
    toggleStep:index => toggle('done',index),
    completeStep:index => change(latest => latest.done.includes(index) ? latest : {...latest,done:[...latest.done,index]}),
    setTimer:timer => change(latest => ({...latest,timer})),
    reset:() => change(blank)
  };
}
