/**
 * audio.js – ID3-Tags aus Audiodateien lesen.
 * Benutzt jsmediatags (CDN). Fallback: Dateiname bereinigen.
 */

function _filenameToTrack(filename) {
  return filename
    .replace(/\.[^.]+$/, '')          // Extension entfernen
    .replace(/^\d{1,2}[\s._\-]+/, '') // Führende Tracknummer entfernen (01_, 02-, …)
    .replace(/_/g, ' ')               // Unterstriche → Leerzeichen
    .trim();
}

function _readTags(file) {
  return new Promise(resolve => {
    if (typeof jsmediatags === 'undefined') {
      resolve(_filenameToTrack(file.name));
      return;
    }
    jsmediatags.read(file, {
      onSuccess: tag => {
        const title  = tag.tags?.title?.trim();
        const artist = tag.tags?.artist?.trim();
        resolve(title ? (artist ? `${artist} - ${title}` : title) : _filenameToTrack(file.name));
      },
      onError: () => resolve(_filenameToTrack(file.name)),
    });
  });
}

/**
 * Liest ID3-Tags aller Dateien und gibt ein Array von Track-Strings zurück.
 * Dateien werden nach Name sortiert (Track-Reihenfolge).
 */
async function readTracksFromFiles(files) {
  const sorted = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return Promise.all(sorted.map(_readTags));
}
