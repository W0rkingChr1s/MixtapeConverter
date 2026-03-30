"""CD ripping and Shazam track recognition."""

import asyncio
import os
import subprocess
from pathlib import Path

import psutil


def get_cd_drives() -> list[dict]:
    """Return list of detected optical drives as {device, mountpoint}."""
    drives = []
    for part in psutil.disk_partitions():
        is_optical = (
            'cdrom' in part.opts
            or part.fstype in ('udf', 'iso9660', 'cdfs')
        )
        if is_optical:
            drives.append({'device': part.device, 'mountpoint': part.mountpoint})
    return drives


def rip_cd(drive_device: str, output_dir: str) -> list[str]:
    """
    Rip all audio tracks from *drive_device* to WAV files inside *output_dir*.
    Returns a sorted list of absolute file paths.
    """
    os.makedirs(output_dir, exist_ok=True)
    output_pattern = os.path.join(output_dir, 'track%02d.wav')

    subprocess.run(
        ['ffmpeg', '-f', 'cdda', '-i', drive_device, output_pattern, '-y'],
        capture_output=True,
        check=False,   # ffmpeg exits non-zero even on success sometimes
    )

    return sorted(str(p) for p in Path(output_dir).glob('track*.wav'))


# ── Shazam recognition ────────────────────────────────────────────────────────

async def _recognize_all(wav_files: list[str], progress_cb=None) -> list[str]:
    from shazamio import Shazam
    shazam = Shazam()
    results = []
    for i, wav_path in enumerate(wav_files):
        try:
            data = Path(wav_path).read_bytes()
            result = await shazam.recognize(data)
            track = result.get('track', {})
            title = track.get('title', '').strip()
            artist = track.get('subtitle', '').strip()
            if title:
                results.append(f'{artist} - {title}' if artist else title)
            else:
                results.append(f'Unbekannter Track {i + 1}')
        except Exception as exc:
            results.append(f'Unbekannter Track {i + 1} (Fehler: {exc})')

        if progress_cb:
            progress_cb(i + 1)

    return results


def recognize_tracks(wav_files: list[str], progress_cb=None) -> list[str]:
    """Synchronous wrapper around the async Shazam recognition."""
    return asyncio.run(_recognize_all(wav_files, progress_cb=progress_cb))
