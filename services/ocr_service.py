"""OCR text extraction from images and PDFs, plus track-list parser."""

import re
from pathlib import Path


def process_image(file_path: str) -> str:
    """Extract text from an image file using Tesseract OCR."""
    import pytesseract
    from PIL import Image

    img = Image.open(file_path)
    # Try German + English; fall back gracefully if language pack missing
    try:
        text = pytesseract.image_to_string(img, lang='deu+eng')
    except pytesseract.pytesseract.TesseractError:
        text = pytesseract.image_to_string(img)
    return text


def process_pdf(file_path: str) -> str:
    """
    Extract text from a PDF.
    - Digital PDFs: uses pdfplumber (fast, accurate).
    - Scanned PDFs: falls back to pdf2image + Tesseract OCR.
    """
    import pdfplumber

    text = ''
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ''
            text += page_text + '\n'

    if text.strip():
        return text

    # Scanned PDF – render pages as images and run OCR
    try:
        from pdf2image import convert_from_path
        import pytesseract

        images = convert_from_path(file_path, dpi=200)
        for img in images:
            try:
                text += pytesseract.image_to_string(img, lang='deu+eng') + '\n'
            except pytesseract.pytesseract.TesseractError:
                text += pytesseract.image_to_string(img) + '\n'
    except ImportError:
        pass  # pdf2image not installed – return empty string

    return text


# ── Track list parser ─────────────────────────────────────────────────────────

_TIME_RE = re.compile(r'\s*\d{1,2}:\d{2}(?::\d{2})?\s*$')
_NUMBERED_RE = re.compile(r'^\s*\d{1,2}\s*[.):]\s*(.+)$')


def _clean_line(line: str) -> str:
    """Strip trailing time codes and whitespace."""
    return _TIME_RE.sub('', line).strip()


def parse_track_list(text: str) -> list[str]:
    """
    Parse free-form OCR text and return a list of 'Artist – Title' strings.

    Strategy (in order of priority):
    1. Numbered lines  → "01. Artist - Title"  or  "1) Title"
    2. Dash-separated  → "Artist - Title"  (no number prefix needed)
    3. Fallback        → any non-empty line between 4 and 150 characters
    """
    raw_lines = [_clean_line(l) for l in text.splitlines()]

    # Pass 1: numbered entries
    tracks = []
    for line in raw_lines:
        if not line or len(line) < 4:
            continue
        m = _NUMBERED_RE.match(line)
        if m:
            candidate = m.group(1).strip()
            if len(candidate) >= 3:
                tracks.append(candidate)

    if tracks:
        return tracks

    # Pass 2: "Artist - Title" or "Title - Artist" patterns
    for line in raw_lines:
        if not line or len(line) < 5:
            continue
        if ' - ' in line and 5 <= len(line) <= 150:
            tracks.append(line)

    if tracks:
        return tracks

    # Pass 3: any reasonable line
    for line in raw_lines:
        if 4 <= len(line) <= 150:
            tracks.append(line)

    return tracks
