"""Shazam-based track recognition for uploaded audio files."""

import asyncio
from pathlib import Path


async def _recognize_all(audio_files: list[str], progress_cb=None) -> list[str]:
    from shazamio import Shazam
    shazam = Shazam()
    results = []
    for i, path in enumerate(audio_files):
        try:
            data = Path(path).read_bytes()
            result = await shazam.recognize(data)
            track = result.get('track', {})
            title = track.get('title', '').strip()
            artist = track.get('subtitle', '').strip()
            if title:
                results.append(f'{artist} - {title}' if artist else title)
            else:
                results.append(f'Unbekannter Track {i + 1} ({Path(path).name})')
        except Exception as exc:
            results.append(f'Unbekannter Track {i + 1} (Fehler: {exc})')

        if progress_cb:
            progress_cb(i + 1)

    return results


def recognize_tracks(audio_files: list[str], progress_cb=None) -> list[str]:
    """Synchronous wrapper – runs Shazam recognition on a list of local audio files."""
    return asyncio.run(_recognize_all(audio_files, progress_cb=progress_cb))
