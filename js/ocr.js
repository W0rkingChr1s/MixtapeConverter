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

  if (onStatus) onStatus('OCR wird gestartet…');
  const worker = await Tesseract.createWorker(['deu', 'eng'], 1, {
    logger: m => {
      console.log('[Tesseract]', m.status, m.progress);
      if (onProgress && m.status === 'recognizing text') onProgress(m.progress);
    },
  });
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

// ── Track-Parser ──────────────────────────────────────────────────────────────

function parseTrackList(text) {
  const timeRe     = /\s*\d{1,2}:\d{2}(?::\d{2})?\s*$/;
  const numberedRe = /^\d{1,2}\s*[.):\s]\s*(.+)$/;

  const lines = text.split('\n')
    .map(l => l.replace(timeRe, '').trim())
    .filter(l => l.length >= 3);

  const tracks = [];

  // Pass 1: nummerierte Zeilen  → "01. Artist - Title"
  for (const line of lines) {
    const m = line.match(numberedRe);
    if (m && m[1].trim().length >= 3) tracks.push(m[1].trim());
  }
  if (tracks.length) return tracks;

  // Pass 2: "Artist – Title" ohne Nummer
  for (const line of lines) {
    if (line.includes(' - ') && line.length >= 5 && line.length <= 150)
      tracks.push(line);
  }
  if (tracks.length) return tracks;

  // Pass 3: beliebige Zeilen als Fallback
  return lines.filter(l => l.length >= 4 && l.length <= 150);
}
