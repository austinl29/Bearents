const KEY = 'bearents:identity';
const listeners = new Set();

function getIdentity() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch (e) {
    return null;
  }
}

function setIdentity(identity) {
  localStorage.setItem(KEY, JSON.stringify(identity));
  listeners.forEach((fn) => fn(identity));
}

function clearIdentity() {
  localStorage.removeItem(KEY);
  listeners.forEach((fn) => fn(null));
}

function onIdentityChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export { getIdentity, setIdentity, clearIdentity, onIdentityChange };
