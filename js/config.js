/**
 * config.js – App-weite Konstanten.
 * BASE_PATH wird automatisch erkannt → funktioniert lokal und auf GitHub Pages.
 *
 * SPOTIFY_CLIENT_ID: Eigene Client-ID aus dem Spotify Developer Dashboard eintragen.
 * Anleitung: https://developer.spotify.com/dashboard
 */

const BASE_PATH = (() => {
  const u = new URL(window.location.href);
  return u.origin + u.pathname.replace(/\/[^/]*$/, '/');
})();

const CONFIG = {
  SPOTIFY_CLIENT_ID: 'YOUR_SPOTIFY_CLIENT_ID',
  SPOTIFY_SCOPES: 'playlist-modify-public playlist-modify-private user-read-private',
  REDIRECT_URI: BASE_PATH + 'callback.html',
};
