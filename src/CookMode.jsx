import React, {useRef, useState} from 'react';
import {Icon} from './Icons.jsx';
import './cook-mode.css';

export default function CookMode({recipe, done, setDone, notify}) {
  const dialog = useRef(null);
  const [index, setIndex] = useState(0);
  const steps = recipe.steps;
  function start() {
    const next = steps.findIndex((_, i) => !done.includes(i));
    setIndex(Math.max(next, 0));
    dialog.current.showModal();
  }
  function advance() {
    setDone(previous => previous.includes(index) ? previous : [...previous, index]);
    if (index < steps.length - 1) setIndex(index + 1);
    else {
      const remaining = steps.findIndex((_, i) => i !== index && !done.includes(i));
      if (remaining !== -1) setIndex(remaining);
      else { dialog.current.close(); notify('Recipe complete. Enjoy your meal!'); }
    }
  }
  return <>
    <button className="button outline-button cook-launch" onClick={start}><Icon name="book" size={17}/>Cook mode</button>
    <dialog className="cook-dialog" ref={dialog} aria-labelledby="cook-title">
      <header><span>{recipe.title}</span><button type="button" aria-label="Close cook mode" onClick={() => dialog.current.close()}><Icon name="close" size={21}/></button></header>
      <div className="cook-step" aria-live="polite" aria-atomic="true">
        <p className="cook-progress">Step {index + 1} of {steps.length}</p>
        <progress value={index + 1} max={steps.length} aria-label="Current step"/>
        <h2 id="cook-title">{steps[index]}</h2>
      </div>
      <details className="cook-ingredients"><summary>View ingredients</summary><ul>{recipe.ingredients.map((item,i) => <li key={i}>{item}</li>)}</ul></details>
      <footer><button className="button outline-button" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button>
        <button className="button green-button" onClick={advance}>{index < steps.length - 1 ? 'Complete & continue' : 'Complete step'}</button></footer>
    </dialog>
  </>;
}
