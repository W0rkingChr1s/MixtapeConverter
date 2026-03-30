/**
 * config.js – App-weite Konstanten.
 * BASE_PATH wird automatisch erkannt → funktioniert lokal und auf GitHub Pages.
 */

const BASE_PATH = (() => {
  const u = new URL(window.location.href);
  return u.origin + u.pathname.replace(/\/[^/]*$/, '/');
})();

const CONFIG = {
  SPOTIFY_CLIENT_ID: 'b816b42cd02043d4bab939320364ac36',
  SPOTIFY_SCOPES: 'playlist-modify-public playlist-modify-private',
  REDIRECT_URI: BASE_PATH + 'callback.html',
};
