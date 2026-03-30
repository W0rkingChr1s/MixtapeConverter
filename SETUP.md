# Mixtape Converter – Setup & Deployment

## GitHub Pages aktivieren

1. Repository auf GitHub öffnen
2. **Settings → Pages**
3. Source: **Deploy from a branch**
4. Branch: `main` · Folder: `/ (root)`
5. **Save** klicken

Die App ist dann unter `https://w0rkingchr1s.github.io/MixtapeConverter/` erreichbar.

---

## Spotify-App konfigurieren

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) öffnen
2. Deine App auswählen → **Edit Settings**
3. Unter **Redirect URIs** eintragen:
   ```
   https://w0rkingchr1s.github.io/MixtapeConverter/callback.html
   ```
   Für lokale Entwicklung zusätzlich:
   ```
   http://localhost:5500/callback.html
   ```
4. **Save**

> Die `SPOTIFY_CLIENT_ID` in `js/config.js` ist bereits eingetragen.

---

## Lokal testen

Einfach mit einem beliebigen Static-Server starten:

```bash
# Python
python -m http.server 5500

# Node.js (npx)
npx serve .

# VS Code: "Live Server"-Extension → "Open with Live Server"
```

Dann im Browser: `http://localhost:5500`

---

## Architektur

```
Alles läuft im Browser des Nutzers – kein eigener Server.

index.html      Provider-Auswahl (Spotify)
callback.html   Spotify OAuth PKCE Callback
flow.html       Eingabemethode wählen
audio.html      Audio-Dateien hochladen → ID3-Tags auslesen
manual.html     Manuell eingeben / TXT hochladen
ocr.html        Foto/PDF → Tesseract.js OCR (läuft lokal im Browser)
confirm.html    Trackliste bearbeiten → Playlist bei Spotify erstellen
success.html    Ergebnis mit Link zur Playlist

js/config.js    Spotify Client ID + REDIRECT_URI (auto-detect)
js/state.js     sessionStorage-Wrapper
js/spotify.js   PKCE OAuth + Spotify Web API
js/audio.js     ID3-Tag-Lesezugriff via jsmediatags
js/ocr.js       Tesseract.js + PDF.js Integration + Track-Parser
css/styles.css  Teal/Türkis-Design
```

---

## Was ist mit Apple Music & Amazon Music?

Beide sind als „Demnächst" markiert.

- **Apple Music**: Möglich über [MusicKit JS](https://developer.apple.com/documentation/musickitjs) – benötigt Apple Developer Account
- **Amazon Music**: Kein öffentliches JavaScript-API verfügbar
