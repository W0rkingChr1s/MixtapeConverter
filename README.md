> **Projekt eingestellt**
> Spotify verlangt seit Ende 2024 eine Unternehmens-Registrierung sowie ein aktives Premium-Abo auf dem Developer-Account, um die Web API öffentlich zu betreiben. Als Privatperson ist das nicht umsetzbar. Der Code bleibt als Referenz erhalten und kann mit einer eigenen Spotify-App selbst gehostet werden – siehe [Setup](#setup).

---

<div align="center">
  <img src="static/logo.svg" alt="Mixtape Converter Logo" width="260">

  <h1>Mixtape Converter</h1>

  <p><strong>Wandle deine CD-Sammlung in Spotify-Playlists um – direkt im Browser, kein Server nötig.</strong></p>

  <p>
    <a href="https://github.com/w0rkingchr1s/MixtapeConverter/actions/workflows/deploy.yml">
      <img src="https://github.com/w0rkingchr1s/MixtapeConverter/actions/workflows/deploy.yml/badge.svg" alt="Deploy">
    </a>
    <a href="https://github.com/w0rkingchr1s/MixtapeConverter/actions/workflows/ci.yml">
      <img src="https://github.com/w0rkingchr1s/MixtapeConverter/actions/workflows/ci.yml/badge.svg" alt="CI">
    </a>
    <a href="https://github.com/w0rkingchr1s/MixtapeConverter/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/w0rkingchr1s/MixtapeConverter?color=ff2d78" alt="License">
    </a>
    <a href="https://github.com/w0rkingchr1s/MixtapeConverter/commits/main">
      <img src="https://img.shields.io/github/last-commit/w0rkingchr1s/MixtapeConverter?color=00f5d4" alt="Last Commit">
    </a>
    <img src="https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
    <img src="https://img.shields.io/badge/Spotify-API-1DB954?logo=spotify&logoColor=white" alt="Spotify API">
    <img src="https://img.shields.io/badge/GitHub%20Pages-deployed-blue?logo=github" alt="GitHub Pages">
  </p>

  <p>
    <a href="https://zeitler.tech">
      <img src="https://img.shields.io/badge/Live%20Demo%20%E2%86%92%20zeitler.tech-ff2d78?style=for-the-badge" alt="Live Demo">
    </a>
  </p>
</div>

---

## Features

| Feature | Beschreibung |
|---|---|
| **Audio-Dateien** | Gerippte MP3/FLAC/WAV hochladen – ID3-Tags werden automatisch ausgelesen |
| **Manuell** | Trackliste direkt eintippen oder als TXT-Datei hochladen |
| **OCR / Booklet** | Foto oder PDF-Scan eines CD-Booklets hochladen – Texterkennung läuft lokal im Browser |
| **HEIC-Support** | iPhone-Fotos (HEIC/HEIF) werden direkt unterstützt – kein Konvertieren nötig |
| **Tracks bearbeiten** | Vor dem Erstellen: Tracks editieren, löschen, hinzufügen und per Drag & Drop sortieren |
| **Spotify-Playlist** | Direkte Erstellung per Spotify Web API – ohne Umweg über einen Server |
| **Helles & dunkles Theme** | Y2K Neon-Design mit Light/Dark-Toggle, Einstellung wird gespeichert |
| **Datenschutz** | Keine eigene Server-Infrastruktur – alles bleibt auf deinem Gerät |

---

## So funktioniert es

```
Spotify Login  →  Eingabemethode wählen  →  Tracks prüfen & editieren  →  Playlist erstellt
```

### Flow 1 – Audio-Dateien

> Ideal wenn du deine CD schon mit einem Tool wie *fre:ac*, *EAC* oder *iTunes* gerrippt hast.

1. CD mit einem beliebigen Ripper als MP3 / FLAC exportieren
2. Dateien in den Upload-Bereich ziehen
3. ID3-Tags werden automatisch ausgelesen (Künstler, Titel)
4. Trackliste prüfen & Playlist erstellen

```
01 - Die Ärzte - Männer sind Schweine.mp3
02 - Depeche Mode - Personal Jesus.mp3
   ↓  jsmediatags liest ID3-Tags
[01]  Die Ärzte - Männer sind Schweine
[02]  Depeche Mode - Personal Jesus
```

### Flow 2 – Manuell

> Für handgeschriebene Setlists, Kassetten oder wenn ID3-Tags fehlen.

1. Tracks zeilenweise eintippen (`Künstler - Titel`)
2. **oder** eine fertige `.txt`-Datei hochladen
3. Trackliste bearbeiten & Playlist erstellen

### Flow 3 – OCR / Booklet-Scan

> Das Backcover oder Booklet aus der CD-Hülle abfotografieren – fertig.

1. Foto (JPG/PNG/**HEIC**/WEBP) oder PDF-Scan des Covers hochladen
2. Bild wird automatisch vorverarbeitet (Kontrastverstärkung, Skalierung)
3. [Tesseract.js](https://tesseract.projectnaptha.com/) erkennt den Text **lokal im Browser** – keine Daten verlassen dein Gerät
4. Parser extrahiert Trackliste automatisch aus verschiedenen Nummerierungsformaten
5. **Erkannten Text editieren** – Rauschzeilen entfernen, Korrekturen vornehmen
6. Playlist erstellen

Der Parser erkennt u.a.:
- Nummerierungen: `1.` `01.` `1)` `Track 1` `I.` `II.` sowie Doppelnummerierungen (`01 1.`)
- Zeitangaben: `6:47` und `( 3:37 )` werden automatisch entfernt
- Rauschfilter: Copyright-Zeilen, Produzentenangaben, URLs, Barcodes

---

## Tech Stack

| Schicht | Technologie |
|---|---|
| **Frontend** | Vanilla JavaScript (ES2022), HTML5, CSS3 |
| **Auth** | [Spotify PKCE OAuth](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow) – kein Client Secret nötig |
| **Playlist-API** | [Spotify Web API](https://developer.spotify.com/documentation/web-api) – `/me/playlists` |
| **OCR** | [Tesseract.js v5](https://github.com/naptha/tesseract.js) + [PDF.js](https://mozilla.github.io/pdf.js/) |
| **HEIC-Decode** | [libheif-js v1.19.8](https://github.com/strukturag/libheif) – self-hosted WASM, kein CDN |
| **ID3-Tags** | [jsmediatags](https://github.com/aadsm/jsmediatags) |
| **Hosting** | GitHub Pages (statisch, kein Server) |
| **CI/CD** | GitHub Actions (ESLint · HTML-Validierung · Link-Check · Auto-Deploy) |

---

## Setup

### 1. Repository forken & GitHub Pages aktivieren

```
Repository → Settings → Pages
  Source: GitHub Actions
  → Save
```

Beim nächsten Push auf `main` deployt GitHub Actions die App automatisch.

### 2. Spotify Developer App konfigurieren

1. [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) öffnen
2. App auswählen (oder neu erstellen) → **Edit Settings**
3. **Redirect URIs** eintragen:

```
https://DEIN-USERNAME.github.io/MixtapeConverter/callback.html
```

Für lokale Entwicklung zusätzlich:

```
http://localhost:5500/callback.html
```

4. Speichern.

> Die `SPOTIFY_CLIENT_ID` ist bereits in `js/config.js` eingetragen.
> Für eine eigene App dort austauschen.

> **Hinweis Entwicklermodus:** Spotify-Apps im Development Mode erlauben nur bis zu 25 Nutzer.
> Eigene E-Mail unter Dashboard → **User Management** hinzufügen oder Extended Quota Mode beantragen.

### 3. Lokal testen

Kein Build-Schritt nötig:

```bash
# Python
python -m http.server 5500

# Node.js
npx serve .

# VS Code → Live Server Extension
```

App im Browser öffnen: **http://localhost:5500**

---

## Code-Qualität & CI

```bash
npm install           # Abhängigkeiten installieren

npm run lint          # ESLint – JavaScript prüfen
npm run lint:fix      # ESLint – automatisch korrigieren
npm run validate      # html-validate – alle HTML-Seiten
node scripts/check-links.js   # Interne Links auf Existenz prüfen
```

### CI-Pipeline (GitHub Actions)

| Job | Tool | Prüft |
|---|---|---|
| **Lint JavaScript** | ESLint v9 | Code-Qualität, no-var, eqeqeq |
| **Validate HTML** | html-validate | Semantik, Attribut-Vollständigkeit |
| **Check internal links** | Eigenes Script | Alle `href`/`src`-Verweise |

---

## Projektstruktur

```
MixtapeConverter/
│
├── index.html          Startseite – Streaming-Dienst auswählen
├── callback.html       Spotify OAuth PKCE Callback
├── flow.html           Eingabemethode wählen
├── audio.html          Audio-Dateien hochladen + ID3-Tags lesen
├── manual.html         Manuell eingeben / TXT-Datei hochladen
├── ocr.html            Foto/PDF-Scan + OCR + editierbarer Review-Schritt
├── confirm.html        Trackliste bearbeiten + Playlist erstellen
├── success.html        Ergebnis mit Link zur neuen Playlist
├── privacy.html        Datenschutzerklärung
│
├── css/
│   └── styles.css      Y2K Neon-Design, Light/Dark Theme, CSS-Variablen
│
├── js/
│   ├── config.js       Spotify Client ID + Auto-Redirect-URI-Erkennung
│   ├── state.js        sessionStorage-Wrapper
│   ├── spotify.js      PKCE OAuth + Spotify Web API + Token-Refresh
│   ├── audio.js        ID3-Tag-Lesezugriff via jsmediatags
│   ├── ocr.js          Tesseract.js + PDF.js + HEIC-Decode + Track-Parser
│   └── theme.js        Light/Dark-Toggle (localStorage-Persistenz)
│
├── scripts/
│   └── check-links.js  CI-Script: prüft alle internen Links
│
├── .github/workflows/
│   ├── deploy.yml      Auto-Deploy → GitHub Pages (bei Push auf main)
│   └── ci.yml          ESLint + HTML-Validierung + Link-Check
│
├── static/
│   ├── logo.svg              SVG-Logo (neon Y2K-Design)
│   └── libheif-bundle.js     libheif-js WASM (self-hosted, für HEIC-Support)
│
├── eslint.config.js
├── .htmlvalidate.json
└── package.json
```

---

## Roadmap

- [x] Spotify PKCE OAuth (kein Backend)
- [x] Flow: Audio-Dateien + ID3-Tags
- [x] Flow: Manuell / TXT-Upload
- [x] Flow: OCR (Tesseract.js, lokal im Browser)
- [x] HEIC/HEIF-Support (iPhone-Fotos, libheif-js WASM)
- [x] OCR: Bildvorverarbeitung + editierbarer Review-Schritt
- [x] Trackliste editierbar (inline, drag & drop, add/delete)
- [x] Y2K Neon-Design mit Light/Dark-Toggle
- [x] GitHub Actions CI/CD
- [ ] Apple Music (MusicKit JS)
- [ ] Playlist-Cover aus CD-Booklet übernehmen
- [ ] Mehrsprachigkeit (DE / EN)

---

## Contributing

Pull Requests sind willkommen. Für größere Änderungen bitte zuerst ein Issue öffnen.

```bash
git checkout -b feature/mein-feature
# Änderungen machen
npm run lint && npm run validate   # CI lokal vorab prüfen
git commit -m "feat: kurze Beschreibung"
git push origin feature/mein-feature
# Pull Request auf GitHub öffnen
```

---

## Lizenz

[MIT](LICENSE) © 2024 W0rkingChr1s
