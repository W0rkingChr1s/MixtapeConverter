/**
 * spotify.js – Spotify PKCE OAuth + Web API.
 * Kein Backend nötig – läuft komplett im Browser.
 */

// ── PKCE Helpers ──────────────────────────────────────────────────────────────

async function _pkceVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function _pkceChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function startSpotifyLogin() {
  const verifier = await _pkceVerifier();
  const challenge = await _pkceChallenge(verifier);
  State.set('pkce_verifier', verifier);
  State.set('provider', 'spotify');

  const params = new URLSearchParams({
    client_id:             CONFIG.SPOTIFY_CLIENT_ID,
    response_type:         'code',
    redirect_uri:          CONFIG.REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge:        challenge,
    scope:                 CONFIG.SPOTIFY_SCOPES,
    show_dialog:           'true',
  });

  window.location.href = 'https://accounts.spotify.com/authorize?' + params;
}

async function handleSpotifyCallback(code) {
  const verifier = State.get('pkce_verifier');
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CONFIG.SPOTIFY_CLIENT_ID,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  CONFIG.REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  const token = await resp.json();
  if (token.access_token) {
    State.set('spotify_token', token);
    State.del('pkce_verifier');
    return true;
  }
  console.error('Spotify token error:', token);
  return false;
}

function isAuthenticated() {
  const token = State.get('spotify_token');
  return !!(token && token.access_token);
}

function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = BASE_PATH + 'index.html';
    return false;
  }
  return true;
}

// ── API ───────────────────────────────────────────────────────────────────────

async function _spotifyFetch(path, options = {}) {
  const token = State.get('spotify_token');
  const resp = await fetch('https://api.spotify.com/v1' + path, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + token.access_token,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (resp.status === 204) return {};
  return resp.json();
}

async function createSpotifyPlaylist(name, tracks, onProgress) {
  const me = await _spotifyFetch('/me');
  const playlist = await _spotifyFetch(`/users/${me.id}/playlists`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      public: false,
      description: 'Erstellt mit Mixtape Converter',
    }),
  });

  const uris = [];
  const notFound = [];

  for (let i = 0; i < tracks.length; i++) {
    if (onProgress) onProgress(i + 1, tracks.length);
    const res = await _spotifyFetch(
      `/search?q=${encodeURIComponent(tracks[i])}&type=track&limit=1`
    );
    const items = res?.tracks?.items;
    if (items?.length) uris.push(items[0].uri);
    else notFound.push(tracks[i]);
  }

  // Spotify max 100 tracks per request
  for (let i = 0; i < uris.length; i += 100) {
    await _spotifyFetch(`/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
  }

  return {
    playlist_url: playlist.external_urls?.spotify,
    tracks_added: uris.length,
    not_found: notFound,
  };
}
