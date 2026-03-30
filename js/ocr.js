/**
 * ocr.js – Tesseract.js OCR für Bilder + PDF.js für PDFs.
 * Beide Libraries werden per CDN geladen.
 */

// ── OCR ───────────────────────────────────────────────────────────────────────

async function ocrImage(file, onProgress) {
  const worker = await Tesseract.createWorker(['deu', 'eng'], 1, {
    logger: m => { if (onProgress && m.status === 'recognizing text') onProgress(m.progress); },
  });
  const { data: { text } } = await worker.recognize(file);
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

  let tracks = [];

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
