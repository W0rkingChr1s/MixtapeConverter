import os
import uuid
import threading
import shutil
from pathlib import Path

from flask import (
    Flask, session, redirect, request,
    url_for, render_template, jsonify, flash,
)
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-change-me')
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB

BASE_DIR = os.path.dirname(__file__)
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
TMP_FOLDER = os.path.join(BASE_DIR, 'tmp')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TMP_FOLDER, exist_ok=True)

# In-memory job store for background CD ripping
_jobs: dict = {}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _is_authenticated():
    provider = session.get('provider')
    if provider == 'spotify':
        return bool(session.get('spotify_token'))
    return False


def _require_auth():
    if not _is_authenticated():
        flash('Bitte zuerst einloggen.', 'warning')
        return redirect(url_for('index'))
    return None


# ── Auth ─────────────────────────────────────────────────────────────────────

@app.route('/auth/<provider>')
def auth(provider):
    session['provider'] = provider
    if provider == 'spotify':
        from services.spotify_service import get_oauth
        sp_oauth = get_oauth()
        auth_url = sp_oauth.get_authorize_url()
        return redirect(auth_url)
    elif provider in ('apple_music', 'amazon_music'):
        flash('Diese Integration wird demnächst verfügbar sein.', 'info')
        return redirect(url_for('index'))
    return redirect(url_for('index'))


@app.route('/callback/spotify')
def spotify_callback():
    from services.spotify_service import get_oauth
    error = request.args.get('error')
    if error:
        flash(f'Spotify-Login fehlgeschlagen: {error}', 'error')
        return redirect(url_for('index'))
    code = request.args.get('code')
    sp_oauth = get_oauth()
    token_info = sp_oauth.get_access_token(code, as_dict=True)
    session['spotify_token'] = token_info
    return redirect(url_for('flow_select'))


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))


# ── Main pages ────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/flow')
def flow_select():
    guard = _require_auth()
    if guard:
        return guard
    return render_template('flow_select.html', provider=session.get('provider'))


# ── Flow: CD ─────────────────────────────────────────────────────────────────

@app.route('/flow/cd')
def cd_flow():
    guard = _require_auth()
    if guard:
        return guard
    from services.cd_service import get_cd_drives
    drives = get_cd_drives()
    return render_template('cd_flow.html', drives=drives)


@app.route('/flow/cd/start', methods=['POST'])
def cd_start():
    if not _is_authenticated():
        return jsonify({'error': 'Nicht eingeloggt'}), 401

    drive = request.form.get('drive', '').strip()
    if not drive:
        return jsonify({'error': 'Kein Laufwerk ausgewählt'}), 400

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {'status': 'ripping', 'tracks': None, 'error': None, 'total': 0, 'done_count': 0}

    def run_job(jid, dev):
        try:
            from services.cd_service import rip_cd, recognize_tracks
            tmp_dir = os.path.join(TMP_FOLDER, jid)
            os.makedirs(tmp_dir, exist_ok=True)

            wav_files = rip_cd(dev, tmp_dir)
            if not wav_files:
                _jobs[jid].update(status='error', error='Keine Tracks auf der CD gefunden.')
                return

            _jobs[jid].update(status='recognizing', total=len(wav_files))
            tracks = recognize_tracks(wav_files, progress_cb=lambda n: _jobs[jid].update(done_count=n))
            _jobs[jid].update(status='done', tracks=tracks)
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception as exc:
            _jobs[jid].update(status='error', error=str(exc))

    threading.Thread(target=run_job, args=(job_id, drive), daemon=True).start()
    return jsonify({'job_id': job_id})


@app.route('/flow/cd/status/<job_id>')
def cd_status(job_id):
    job = _jobs.get(job_id)
    if not job:
        return jsonify({'error': 'Job nicht gefunden'}), 404
    return jsonify(job)


@app.route('/flow/cd/finish', methods=['POST'])
def cd_finish():
    guard = _require_auth()
    if guard:
        return guard
    job_id = request.form.get('job_id', '')
    job = _jobs.get(job_id)
    if not job or job['status'] != 'done':
        flash('CD-Einlesen nicht abgeschlossen oder fehlgeschlagen.', 'error')
        return redirect(url_for('cd_flow'))
    session['tracks'] = job['tracks']
    _jobs.pop(job_id, None)
    return redirect(url_for('confirm_tracks'))


# ── Flow: Manuell ─────────────────────────────────────────────────────────────

@app.route('/flow/manual')
def manual_flow():
    guard = _require_auth()
    if guard:
        return guard
    return render_template('manual_flow.html')


@app.route('/flow/manual/process', methods=['POST'])
def manual_process():
    guard = _require_auth()
    if guard:
        return guard

    tracks = []

    uploaded = request.files.get('tracks_file')
    if uploaded and uploaded.filename:
        content = uploaded.read().decode('utf-8', errors='replace')
        tracks = [l.strip() for l in content.splitlines() if l.strip()]

    if not tracks:
        raw = request.form.get('tracks_text', '').strip()
        tracks = [l.strip() for l in raw.splitlines() if l.strip()]

    if not tracks:
        flash('Bitte Tracks eingeben oder eine TXT-Datei hochladen.', 'warning')
        return redirect(url_for('manual_flow'))

    session['tracks'] = tracks
    return redirect(url_for('confirm_tracks'))


# ── Flow: OCR ────────────────────────────────────────────────────────────────

_ALLOWED = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'pdf'}


def _allowed(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in _ALLOWED


@app.route('/flow/ocr')
def ocr_flow():
    guard = _require_auth()
    if guard:
        return guard
    return render_template('ocr_flow.html')


@app.route('/flow/ocr/process', methods=['POST'])
def ocr_process():
    guard = _require_auth()
    if guard:
        return guard

    uploaded = request.files.get('booklet_file')
    if not uploaded or not uploaded.filename:
        flash('Bitte eine Datei hochladen.', 'warning')
        return redirect(url_for('ocr_flow'))

    if not _allowed(uploaded.filename):
        flash('Ungültiges Format. Bitte Bild (PNG/JPG/…) oder PDF hochladen.', 'error')
        return redirect(url_for('ocr_flow'))

    ext = Path(uploaded.filename).suffix.lower()
    filepath = os.path.join(UPLOAD_FOLDER, str(uuid.uuid4()) + ext)
    uploaded.save(filepath)

    try:
        from services.ocr_service import process_image, process_pdf, parse_track_list
        text = process_pdf(filepath) if ext == '.pdf' else process_image(filepath)
        tracks = parse_track_list(text)

        if not tracks:
            flash('Keine Tracks erkannt. Bitte manuell eingeben.', 'warning')
            return redirect(url_for('manual_flow'))

        session['tracks'] = tracks
        return redirect(url_for('confirm_tracks'))
    except Exception as exc:
        flash(f'OCR-Fehler: {exc}', 'error')
        return redirect(url_for('ocr_flow'))
    finally:
        try:
            os.unlink(filepath)
        except OSError:
            pass


# ── Bestätigung & Erstellen ───────────────────────────────────────────────────

@app.route('/confirm')
def confirm_tracks():
    guard = _require_auth()
    if guard:
        return guard
    tracks = session.get('tracks', [])
    if not tracks:
        flash('Keine Tracks vorhanden.', 'warning')
        return redirect(url_for('flow_select'))
    return render_template('confirm_tracks.html', tracks=tracks, provider=session.get('provider'))


@app.route('/create', methods=['POST'])
def create_playlist():
    guard = _require_auth()
    if guard:
        return guard

    playlist_name = request.form.get('playlist_name', '').strip()
    tracks = [t.strip() for t in request.form.getlist('tracks') if t.strip()]

    if not playlist_name:
        flash('Bitte einen Playlist-Namen eingeben.', 'warning')
        session['tracks'] = tracks
        return redirect(url_for('confirm_tracks'))

    if not tracks:
        flash('Keine Tracks vorhanden.', 'warning')
        return redirect(url_for('confirm_tracks'))

    provider = session.get('provider')
    try:
        if provider == 'spotify':
            from services.spotify_service import create_playlist
            result = create_playlist(session['spotify_token'], playlist_name, tracks)
            session['result'] = result
            session['playlist_name'] = playlist_name
            return redirect(url_for('success'))
        else:
            flash(f'Streaming-Dienst „{provider}" wird demnächst unterstützt.', 'info')
            session['tracks'] = tracks
            return redirect(url_for('confirm_tracks'))
    except Exception as exc:
        flash(f'Fehler beim Erstellen der Playlist: {exc}', 'error')
        session['tracks'] = tracks
        return redirect(url_for('confirm_tracks'))


@app.route('/success')
def success():
    return render_template(
        'success.html',
        result=session.get('result', {}),
        playlist_name=session.get('playlist_name', 'Meine Playlist'),
    )


@app.route('/privacy')
def privacy_notice():
    return render_template('privacy_notice.html')


if __name__ == '__main__':
    app.run(debug=True, port=5000)
