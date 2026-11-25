import React, {useEffect, useId, useRef, useState} from 'react';
import './recipe-photo.css';

export default function PhotoInput({value = '', onChange, onBusyChange, disabled = false}) {
  const inputId = useId();
  const generation = useRef(0);
  const [processing,setProcessing] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => () => { generation.current += 1; }, []);
  function busy(state) { setProcessing(state); onBusyChange?.(state); }
  function remove() {
    generation.current += 1;
    if (!processing) onChange('');
    busy(false); setError('');
  }
  async function select(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const version = ++generation.current;
    setError(''); busy(true);
    try {
      const result = await window.KitchenPhoto.read(file);
      if (generation.current === version) onChange(result);
    } catch (failure) {
      if (generation.current === version) setError(failure.message || 'Try a different photo.');
    } finally { if (generation.current === version) busy(false); }
  }
  return <div className="recipe-photo-field">
    <label className="rp-label" htmlFor={inputId}>Recipe photo <small>(optional)</small></label>
    {value && <img className="rp-preview" src={value} alt="Recipe photo preview"/>}
    <input type="file" id={inputId} accept="image/jpeg,image/png,image/webp" disabled={disabled}
      aria-describedby={inputId+'-help'} onChange={select}/>
    <small id={inputId+'-help'}>JPEG, PNG or WebP, up to 10 MB. {value && 'Choose another file to replace this photo.'}</small>
    {(value || processing) && <button type="button" className="rp-remove" onClick={remove} disabled={disabled}>{processing ? 'Cancel photo selection' : 'Remove photo'}</button>}
    {processing && <p role="status">Preparing your photo…</p>}
    {error && <p role="alert" className="ac-error">{error}</p>}
  </div>;
}
