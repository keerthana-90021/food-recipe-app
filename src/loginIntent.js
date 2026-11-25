// A tab can remember the action that opened sign-in. This hint grants no access.
const key = 'supperclub.v1/login-intent';
const validPage = /^(collections|planner|submissions|admin|submit(?:\/dish-[a-f0-9]{32})?|recipe\/[a-zA-Z0-9_-]+)$/;
let fallback = null;

export function loginIntent() {
  let data = fallback;
  try { data = JSON.parse(sessionStorage.getItem(key)) || fallback; } catch { /* Storage may be disabled. */ }
  if (!data || typeof data.page !== 'string' || !validPage.test(data.page)) return null;
  return { page:data.page, saveId:data.page === 'recipe/' + data.saveId ? data.saveId : null };
}

export function rememberIntent(page, saveId = null) {
  fallback = validPage.test(page) ? {page, saveId} : null;
  try {
    if (fallback) sessionStorage.setItem(key, JSON.stringify(fallback));
    else sessionStorage.removeItem(key);
  } catch { /* The in-memory intent still works for this page visit. */ }
}
