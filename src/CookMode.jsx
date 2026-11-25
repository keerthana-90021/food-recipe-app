import React, {useEffect, useRef, useState} from 'react';
import {Icon} from './Icons.jsx';
import './cook-mode.css';

function KitchenTimer({timer,setTimer}) {
  const [minutes,setMinutes] = useState('5');
  const [now,setNow] = useState(Date.now);
  const end = timer?.end;
  const expired = Number.isFinite(end) && end <= now;
  useEffect(() => {
    if (!end || expired) return;
    const tick = () => setNow(Date.now());
    tick();
    const clock = window.setInterval(tick,500);
    document.addEventListener('visibilitychange',tick);
    return () => { window.clearInterval(clock); document.removeEventListener('visibilitychange',tick); };
  },[end,expired]);

  function run(duration) {
    const start = Date.now();
    setNow(start);
    setTimer({remaining:duration, end:start+duration});
  }
  function begin(event) {
    event.preventDefault();
    const value = Number(minutes);
    if (Number.isInteger(value) && value >= 1 && value <= 180) run(value * 60000);
  }
  function pause() {
    const remaining = end - Date.now();
    if (remaining > 0) setTimer({remaining, end:null});
    else setNow(Date.now());
  }
  const remaining = timer ? Math.ceil((end ? Math.max(0,end-now) : timer.remaining)/1000) : 0;
  const display = Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');
  return <section className="cook-timer" aria-label="Kitchen timer">
    <h3><Icon name="clock" size={16}/>Kitchen timer</h3>
    {timer ? <div className="cook-timer-controls">
      <span className="cook-clock" role="timer" aria-label={display+' remaining'}>{display}</span>
      {expired ? <strong role="status">Time's up</strong> :
        <button type="button" onClick={end ? pause : () => run(timer.remaining)}>{end ? 'Pause' : 'Resume'}</button>}
      <button type="button" onClick={()=>setTimer(null)}>{expired ? 'Dismiss timer' : 'Reset timer'}</button>
    </div> : <form className="cook-timer-controls" onSubmit={begin}>
      <label><input type="number" min="1" max="180" step="1" required value={minutes} onChange={event=>setMinutes(event.target.value)}/>minutes</label>
      <button type="submit">Start timer</button>
    </form>}
  </section>;
}

export default function CookMode({recipe, progress, notify}) {
  const dialog = useRef(null);
  const [index, setIndex] = useState(0);
  const steps = recipe.steps;
  const {done,timer,setTimer} = progress;
  function start() {
    const next = steps.findIndex((_, i) => !done.includes(i));
    setIndex(Math.max(next, 0));
    dialog.current.showModal();
  }
  function advance() {
    progress.completeStep(index);
    let next = steps.findIndex((_, i) => i > index && !done.includes(i));
    if (next === -1) next = steps.findIndex((_, i) => i !== index && !done.includes(i));
    if (next !== -1) setIndex(next);
    else { dialog.current.close(); notify('Recipe complete. Enjoy your meal!'); }
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
      <KitchenTimer {...{timer,setTimer}}/>
      <footer><button className="button outline-button" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button>
        <button className="button green-button" onClick={advance}>{index < steps.length - 1 ? 'Complete & continue' : 'Complete step'}</button></footer>
    </dialog>
  </>;
}
