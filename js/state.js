/**
 * state.js – Leichtgewichtiges sessionStorage-Wrapper.
 * Alle Keys werden mit 'mc_' präfixiert.
 */

const NS = 'mc_';

const State = {
  get:   key      => { try { return JSON.parse(sessionStorage.getItem(NS + key)); } catch { return null; } },
  set:   (key, v) => sessionStorage.setItem(NS + key, JSON.stringify(v)),
  del:   key      => sessionStorage.removeItem(NS + key),
  clear: ()       => Object.keys(sessionStorage)
                       .filter(k => k.startsWith(NS))
                       .forEach(k => sessionStorage.removeItem(k)),
};
