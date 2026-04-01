/**
 * spotify.js – Spotify PKCE OAuth + Web API.
 * Kein Backend nötig – läuft komplett im Browser.
 */
/* global State, CONFIG, BASE_PATH */

// ── PKCE Helpers ──────────────────────────────────────────────────────────────

async function _pkceVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  // Array.from avoids spread-btoa issues with high byte values in some browsers
  return btoa(Array.from(arr, b => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function _pkceChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(Array.from(new Uint8Array(digest), b => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── Token Refresh ─────────────────────────────────────────────────────────────

async function _refreshToken() {
  const token = State.get('spotify_token');
  if (!token?.refresh_token) return false;
  try {
    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     CONFIG.SPOTIFY_CLIENT_ID,
        grant_type:    'refresh_token',
        refresh_token: token.refresh_token,
      }),
    });
    const fresh = await resp.json();
    if (fresh.access_token) {
      fresh.expires_at    = Date.now() + (fresh.expires_in - 60) * 1000;
      fresh.refresh_token = fresh.refresh_token || token.refresh_token; // reuse if not rotated
      State.set('spotify_token', fresh);
      return true;
    }
  } catch (e) { console.warn('[Spotify] Token-Refresh fehlgeschlagen:', e); }
  return false;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function startSpotifyLogin() {
  const verifier   = await _pkceVerifier();
  const challenge  = await _pkceChallenge(verifier);
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
    method:  'POST',
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
  if (!token.access_token) {
    console.error('Spotify token error:', token);
    return false;
  }

  // Verify Spotify actually granted the scopes we need
  const granted  = (token.scope || '').split(' ');
  const required = CONFIG.SPOTIFY_SCOPES.split(' ');
  const missing  = required.filter(s => !granted.includes(s));
  if (missing.length) {
    console.error('Spotify: fehlende Scopes:', missing);
    // Store token anyway so we can show an error on the next page
    token._missing_scopes = missing;
  }

  token.expires_at = Date.now() + (token.expires_in - 60) * 1000;
  State.set('spotify_token', token);
  State.del('pkce_verifier');
  return true;
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
  let token = State.get('spotify_token');

  if (!token?.access_token) {
    throw new Error('Nicht angemeldet. Bitte neu einloggen.');
  }

  // Refresh proactively if token is expired or expiring within 60s
  if (token.expires_at && Date.now() > token.expires_at) {
    const ok = await _refreshToken();
    if (!ok) {
      State.clear();
      window.location.href = BASE_PATH + 'index.html';
      throw new Error('Sitzung abgelaufen. Bitte erneut anmelden.');
    }
    token = State.get('spotify_token');
  }

  const resp = await fetch('https://api.spotify.com/v1' + path, {
    ...options,
    headers: {
      Authorization:  'Bearer ' + token.access_token,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (resp.status === 204) return {};

  // Guard against non-JSON responses (Spotify occasionally returns HTML/text on errors)
  const ct = resp.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await resp.text();
    throw new Error('Spotify antwortete mit ungültigem Format (HTTP ' + resp.status + '): ' + text.slice(0, 120));
  }

  const json = await resp.json();

  // Surface Spotify API errors as thrown errors with clear messages
  if (json.error) {
    const status = json.error.status;
    const msg    = json.error.message || '';

    if (status === 401) {
      throw new Error('Sitzung abgelaufen – bitte neu anmelden.');
    }
    if (status === 403) {
      throw new Error(
        'Zugriff verweigert (403). ' +
        'Die Spotify-App läuft im Entwicklermodus – ' +
        'nur freigeschaltete Nutzer können sie verwenden. ' +
        'Bitte die Spotify-E-Mail-Adresse im Developer Dashboard unter ' +
        '"User Management" hinzufügen oder Extended Quota Mode beantragen.'
      );
    }
    if (status === 429) {
      throw new Error('Spotify Rate Limit erreicht – bitte kurz warten und erneut versuchen.');
    }
    throw new Error('Spotify API Fehler ' + status + (msg ? ': ' + msg : ''));
  }

  return json;
}

async function createSpotifyPlaylist(name, tracks, onProgress) {
  const playlist = await _spotifyFetch('/me/playlists', {
    method: 'POST',
    body:   JSON.stringify({
      name,
      public:      false,
      description: 'Erstellt mit Mixtape Converter',
    }),
  });
  if (!playlist.id) throw new Error('Playlist konnte nicht erstellt werden.');

  const uris     = [];
  const notFound = [];

  for (let i = 0; i < tracks.length; i++) {
    if (onProgress) onProgress(i + 1, tracks.length);
    try {
      const res   = await _spotifyFetch(`/search?q=${encodeURIComponent(tracks[i])}&type=track&limit=1`);
      const items = res?.tracks?.items;
      if (items?.length) uris.push(items[0].uri);
      else notFound.push(tracks[i]);
    } catch (searchErr) {
      console.warn('[Spotify] Track nicht gefunden:', tracks[i], searchErr.message);
      notFound.push(tracks[i]);
    }
  }

  // Spotify max 100 tracks per request
  for (let i = 0; i < uris.length; i += 100) {
    await _spotifyFetch(`/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      body:   JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
  }

  return {
    playlist_url:  playlist.external_urls?.spotify,
    tracks_added:  uris.length,
    not_found:     notFound,
  };
}
