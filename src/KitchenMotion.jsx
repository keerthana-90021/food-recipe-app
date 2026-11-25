import React, {useLayoutEffect, useRef, useState} from 'react';
import {Icon} from './Icons.jsx';

const motionKey = 'supperclub.appearance.reduceMotion';

export function MotionPreference() {
  const [reduced, setReduced] = useState(() => {
    try { return localStorage.getItem(motionKey) === 'true'; } catch { return false; }
  });

  useLayoutEffect(() => {
    document.documentElement.toggleAttribute('data-reduce-motion', reduced);
  }, [reduced]);

  function change(event) {
    const checked = event.currentTarget.checked;
    setReduced(checked);
    try { localStorage.setItem(motionKey, String(checked)); } catch { /* Preference still works for this visit. */ }
  }

  return <label className="motion-preference">
    <input type="checkbox" checked={reduced} onChange={change}/>Reduce motion
  </label>;
}

function LittlePot() {
  return <svg className="little-pot" viewBox="0 0 48 42" aria-hidden="true" focusable="false">
    <g className="pot-steam" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M15 13c-3-3 3-4 1-7"/><path d="M25 9c-2-2 3-4 1-7"/><path d="M33 13c-2-2 2-3 1-6"/>
    </g>
    <g className="pot-body" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round">
      <path d="M8 24H5a2.5 2.5 0 0 0 0 5h4m30-5h4a2.5 2.5 0 0 1 0 5h-4" fill="none"/>
      <path d="M9 22h30l-1.8 11c-.5 3.4-3 5.5-6 5.5H16.8c-3 0-5.5-2.1-6-5.5Z" fill="#d7a169"/>
      <path d="M14 25v6" stroke="#ffe3a8" strokeLinecap="round"/>
      <g className="pot-face" fill="currentColor" stroke="none"><circle cx="20" cy="29" r="1.15"/><circle cx="29" cy="29" r="1.15"/></g>
      <path d="M22 31q2.5 2.5 5 0" fill="none" strokeLinecap="round"/>
    </g>
    <g className="pot-lid" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21c2-2 6-5.4 13.5-6.4h5C34 15.6 38 19 40 21Z" fill="#edc99c"/>
      <path d="M21 14.5v-1q0-2 3-2t3 2v1Z" fill="#b77b52"/>
      <path d="M7 21h34" fill="none"/>
    </g>
  </svg>;
}

export function RecipePicker({recipes, openRecipe, FoodImage}) {
  const [pickedId, setPickedId] = useState('');
  const dialog = useRef(null);
  const chosen = recipes.find(recipe => recipe.id === pickedId);

  function pick() {
    const candidates = recipes.length > 1 ? recipes.filter(recipe => recipe.id !== pickedId) : recipes;
    if (candidates.length) setPickedId(candidates[Math.floor(Math.random() * candidates.length)].id);
  }

  function open() {
    if (!recipes.length) return;
    pick();
    dialog.current.showModal();
  }

  return <>
    <button type="button" className="picker-trigger" disabled={!recipes.length} aria-haspopup="dialog" onClick={open}>
      <LittlePot/><span>Surprise me</span>
    </button>
    <dialog ref={dialog} className="recipe-picker" aria-label="Recipe suggestion" onClick={event => {
      if (event.target === dialog.current) {
        const bounds = dialog.current.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current.close();
      }
    }}>
      <button className="picker-close" aria-label="Close recipe suggestion" autoFocus onClick={() => dialog.current.close()}><Icon name="close" size={17}/></button>
      {chosen && <div className="picker-choice" key={chosen.id}>
        <div className="picker-image"><FoodImage recipe={chosen} eager/></div>
        <div className="picker-copy" aria-live="polite" aria-atomic="true">
          <div className="picker-meta"><span>{chosen.cuisine}</span><span><Icon name="clock" size={14}/>{chosen.time} min</span></div>
          <h2>{chosen.title}</h2><p>{chosen.description}</p>
        </div>
      </div>}
      <footer>{recipes.length > 1 && <button className="button outline-button" onClick={pick}><Icon name="shuffle" size={16}/>Pick another</button>}
        <button className="button green-button" disabled={!chosen} onClick={() => {dialog.current.close();openRecipe(chosen.id);}}>View recipe</button>
      </footer>
    </dialog>
  </>;
}
