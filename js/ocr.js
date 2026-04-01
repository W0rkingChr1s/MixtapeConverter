/**
 * ocr.js – Tesseract.js OCR für Bilder + PDF.js für PDFs.
 * HEIC/HEIF (iPhone) wird via libheif-js (self-hosted WASM) dekodiert.
 */

// ── HEIC-Konvertierung ────────────────────────────────────────────────────────

function _isHeic(file) {
  return file.type === 'image/heic'
    || file.type === 'image/heif'
    || /\.(heic|heif)$/i.test(file.name);
}

// Decode with native browser canvas (works in Safari + Chrome on macOS natively)
function _convertHeicNative(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        if (blob) {
          resolve(new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' }));
        } else {
          reject(new Error('Canvas-Export fehlgeschlagen'));
        }
      }, 'image/jpeg', 0.9);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Kein nativer HEIC-Support')); };
    img.src = url;
  });
}

// Decode with libheif-js WASM (works cross-platform, self-hosted bundle)
async function _convertHeicLibheif(file) {
  if (typeof window.libheifInit === 'undefined') {
    throw new Error('libheif nicht geladen');
  }
  const lh = await window.libheifInit();
  const buffer = await file.arrayBuffer();
  const decoder = new lh.HeifDecoder();
  const images = decoder.decode(new Uint8Array(buffer));
  if (!images || images.length === 0) throw new Error('Keine Bilder im HEIC-File');

  const image = images[0];
  const width  = image.get_width();
  const height = image.get_height();

  const canvas  = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  const ctx     = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);

  await new Promise((resolve, reject) => {
    image.display(imgData, result => {
      if (!result) { reject(new Error('libheif display() fehlgeschlagen')); return; }
      ctx.putImageData(result, 0, 0);
      resolve();
    });
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' }));
      } else {
        reject(new Error('Canvas-Export fehlgeschlagen'));
      }
    }, 'image/jpeg', 0.9);
  });
}

async function _convertHeicToJpeg(file) {
  // 1. Native browser decode (Safari, Chrome on macOS)
  try {
    console.log('[OCR] HEIC: nativer Browser-Decode…');
    return await _convertHeicNative(file);
  } catch (e1) { console.log('[OCR] Nativer Decode fehlgeschlagen:', e1.message); }

  // 2. libheif-js WASM (cross-platform fallback)
  try {
    console.log('[OCR] HEIC: libheif WASM-Decode…');
    return await _convertHeicLibheif(file);
  } catch (e) {
    console.warn('[OCR] libheif fehlgeschlagen:', e.message);
  }

  throw new Error(
    'HEIC konnte nicht gelesen werden. Bitte als JPG speichern: ' +
    'iPhone Einstellungen → Kamera → Format → "Maximale Kompatibilität".'
  );
}


// ── OCR ───────────────────────────────────────────────────────────────────────

async function ocrImage(file, onProgress, onStatus) {
  let processFile = file;

  if (_isHeic(file)) {
    if (onStatus) onStatus('HEIC wird zu JPEG konvertiert…');
    processFile = await _convertHeicToJpeg(file);
  }

  if (onStatus) onStatus('Bild wird vorverarbeitet…');
  processFile = await _preprocessForOcr(processFile);

  if (onStatus) onStatus('OCR wird gestartet…');
  const worker = await Tesseract.createWorker(['deu', 'eng'], 1, {
    logger: m => {
      if (onProgress && m.status === 'recognizing text') onProgress(m.progress);
    },
  });
  // PSM 6 = single uniform text block — works best for CD backcovers
  await worker.setParameters({ tessedit_pageseg_mode: '6' });
  const { data: { text } } = await worker.recognize(processFile);
  await worker.terminate();
  return text;
}

async function ocrPdf(file, onProgress) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    if (onProgress) onProgress((pageNum - 1) / pdf.numPages, pageNum, pdf.numPages);

    const page = await pdf.getPage(pageNum);

    // Zuerst digitalen Text versuchen (schnell, keine OCR nötig)
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(i => i.str).join(' ');

    if (pageText.trim().length > 20) {
      fullText += pageText + '\n';
    } else {
      // Seite als Bild rendern + OCR
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

      const worker = await Tesseract.createWorker(['deu', 'eng']);
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();
      fullText += text + '\n';
    }
  }

  if (onProgress) onProgress(1, pdf.numPages, pdf.numPages);
  return fullText;
}

// ── Bild-Preprocessing ────────────────────────────────────────────────────────

// Scale small images up and boost contrast for better OCR on dark/dense covers
function _preprocessForOcr(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = Math.max(img.naturalWidth, img.naturalHeight);
      // Scale up images below 1400px on longest edge (helps OCR on phone photos)
      const scale = maxDim < 1400 ? Math.min(2.5, 1400 / maxDim) : 1;
      const w = Math.round(img.naturalWidth  * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.filter = 'contrast(1.4) brightness(1.1) saturate(0)'; // greyscale + boost
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        blob => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file),
        'image/jpeg', 0.95
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ── Track-Parser ──────────────────────────────────────────────────────────────

function parseTrackList(text) {
  // Strip all common time/duration formats from end of line:
  //   6:47  |  (3:37)  |  ( 3:37 )  |  [6:47]
  const stripTime = s => s
    .replace(/\s*[\[(]\s*\d{1,2}:\d{2}(?::\d{2})?\s*[\])]\s*$/, '')
    .replace(/\s*\d{1,2}:\d{2}(?::\d{2})?\s*$/, '')
    .trim();

  // Lines that are almost certainly not track titles
  const noiseRe = /^(produc|produzier|co-produc|record|aufgenomm|mixed|mastered|arranged|written|lyrics|music by|text by|℗|©|\(c\)|\(p\)|all rights|distributed|manufactured|marketed|www\.|https?:|instagram|facebook|twitter|total time|gesamtzeit|booklet|liner notes|artwork|design|photography|photo by|cover by|executive|assistant|label:|made in|pressed|publishing|courtesy of|℗ \+|fbi|anti.piracy|unauthorized\s+cop|punishable|federal law|suite\s+\d|\w+\s+records\s+release|inc\.|llc\.|gmbh|nashville|℗\s*\d{4})/i;

  const rawLines = text.split('\n')
    .map(l => stripTime(l.replace(/\s+/g, ' ').trim()))
    .filter(l => {
      if (l.length < 3 || l.length > 200) return false;
      if (noiseRe.test(l)) return false;
      const letters = (l.match(/[a-zA-ZäöüÄÖÜéèêàùûîôß]/g) || []).length;
      if (letters < 2) return false;
      // Skip lines with too many single-char "words" — likely column-bleed artefacts
      const words = l.split(/\s+/);
      const shortWords = words.filter(w => w.length <= 1).length;
      if (words.length >= 3 && shortWords / words.length > 0.4) return false;
      return true;
    });

  // Merge "featuring …" / "feat. …" subtitle lines into the preceding track
  const lines = [];
  for (const l of rawLines) {
    if (/^feat(?:uring)?\.?\s+/i.test(l) && lines.length > 0) {
      lines[lines.length - 1] += ' ' + l;
    } else {
      lines.push(l);
    }
  }

  const tracks = [];

  // Pass 1: Numbered lines
  // Handles: "1." "01." "1)" "01)" "1 -" "01 -" "Track 1"
  // Also handles dual-numbering "01 1." (e.g. Symphoniker: "01 1. Prologue & Tango")
  const numberedRe = /^(?:track\s*)?\d{1,2}(?:[.):\-]\s*|\s+)(?:\d{1,2}[.):\s]\s*)?(.+)$/i;
  // Roman numerals I–XIII
  const romanRe    = /^(?:XI{0,3}|IX|VIII|VII|VI|V|IV|III|II|I)[.):\s]\s*(.+)$/i;

  for (const line of lines) {
    const m = line.match(numberedRe) || line.match(romanRe);
    if (m) {
      const title = _cleanTrack(m[1].trim());
      if (title.length >= 3) tracks.push(title);
    }
  }
  if (tracks.length >= 2) return tracks;

  // Pass 2: "Artist – Title" or "Artist - Title" separator
  for (const line of lines) {
    if ((line.includes(' - ') || line.includes(' – ')) && line.length >= 5)
      tracks.push(_cleanTrack(line));
  }
  if (tracks.length >= 2) return tracks;

  // Pass 3: All remaining non-noise lines as fallback
  return lines.filter(l => l.length >= 4).map(_cleanTrack).filter(l => l.length >= 2);
}

// Strip trailing OCR artefacts from a track title
// e.g. "BREATHLESS (==)" → "BREATHLESS", "ROSETTA. :" → "ROSETTA", "COMEBACK =" → "COMEBACK"
function _cleanTrack(t) {
  return t
    .replace(/\s*\([=\-~_*]+\)\s*$/, '')       // (==) (---) etc.
    .replace(/\s*[=\-:·•,;]+\s*$/, '')          // trailing = - : · , ;
    .replace(/\s*\.\s*$/, '')                    // trailing period
    .trim();
}
