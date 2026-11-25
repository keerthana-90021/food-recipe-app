// Each history entry keeps its own scroll position, even if it visits the same recipe.
export function trackRecipeNavigation(setRoute, getRoute) {
  const positions = new Map();
  const previousRestoration = history.scrollRestoration;
  history.scrollRestoration = 'manual';
  let sequence = 0;
  const prefix = Date.now().toString(36) + '-';
  function identifyEntry() {
    const existing = history.state?.supperclubEntry;
    if (existing && positions.has(existing)) return existing;
    const key = prefix + (++sequence);
    history.replaceState({ ...history.state, supperclubEntry: key }, '');
    return key;
  }
  let active = identifyEntry();
  let frame = 0;
  let restoring = false;
  const record = () => {
    if (!restoring) positions.set(active, window.scrollY);
  };
  record();
  function navigate() {
    cancelAnimationFrame(frame);
    const entry = identifyEntry();
    const top = positions.get(entry) || 0;
    active = entry;
    restoring = true;
    setRoute(getRoute());
    frame = requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus({ preventScroll: true });
      window.scrollTo({ top, behavior: 'instant' });
      restoring = false;
      record();
    });
  }
  window.addEventListener('scroll', record, { passive: true });
  window.addEventListener('hashchange', navigate);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', record);
    window.removeEventListener('hashchange', navigate);
    history.scrollRestoration = previousRestoration;
  };
}
