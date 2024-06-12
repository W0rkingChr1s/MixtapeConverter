from flask import Flask, request, redirect, session, url_for, render_template
from spotipy.oauth2 import SpotifyOAuth
import spotipy
import os
import psutil

app = Flask(__name__)
app.secret_key = 'random_secret_key'
app.config['SESSION_COOKIE_NAME'] = 'MixtapeConverterCookie'

# Spotify API credentials
SPOTIPY_CLIENT_ID = 'b816b42cd02043d4bab939320364ac36'
SPOTIPY_CLIENT_SECRET = 'c3bc84a1fb22479ebc7569807098c4be'
SPOTIPY_REDIRECT_URI = 'http://localhost:5000/callback'

# Initialize Spotify OAuth
sp_oauth = SpotifyOAuth(
    SPOTIPY_CLIENT_ID, SPOTIPY_CLIENT_SECRET, SPOTIPY_REDIRECT_URI,
    scope='playlist-modify-public'
)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login')
def login():
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)

@app.route('/callback')
def callback():
    session.clear()
    code = request.args.get('code')
    token_info = sp_oauth.get_access_token(code)
    session['token_info'] = token_info
    return redirect(url_for('mixtape'))

@app.route('/mixtape', methods=['GET', 'POST'])
def mixtape():
    if request.method == 'POST':
        mixtape_name = request.form['mixtape_name']
        cd_drive = request.form['cd_drive']
        cd_tracks = get_cd_tracks(cd_drive)  # Dummy function to simulate reading CD
        recognized_tracks = recognize_tracks(cd_tracks)  # Dummy function to simulate track recognition
        session['mixtape_name'] = mixtape_name
        session['recognized_tracks'] = recognized_tracks
        return redirect(url_for('confirm_tracks'))
    
    cd_drives = get_cd_drives()  # Get available CD drives
    return render_template('mixtape.html', cd_drives=cd_drives)

@app.route('/reload_drives')
def reload_drives():
    cd_drives = get_cd_drives()
    return render_template('mixtape.html', cd_drives=cd_drives)

@app.route('/confirm_tracks', methods=['GET', 'POST'])
def confirm_tracks():
    if request.method == 'POST':
        confirmed_tracks = request.form.getlist('tracks')
        mixtape_name = session.get('mixtape_name')
        create_spotify_playlist(mixtape_name, confirmed_tracks)
        return redirect(url_for('success', playlist_name=mixtape_name))
    
    recognized_tracks = session.get('recognized_tracks', [])
    return render_template('confirm_tracks.html', recognized_tracks=recognized_tracks)

@app.route('/success')
def success():
    playlist_name = request.args.get('playlist_name')
    return render_template('success.html', playlist_name=playlist_name)

def get_cd_drives():
    cd_drives = []
    for part in psutil.disk_partitions():
        if 'cdrom' in part.opts or 'removable' in part.opts:
            cd_drives.append(part.device)
    return cd_drives

def get_cd_tracks(cd_drive):
    # Simulate reading CD tracks from the selected drive
    return ["Track1", "Track2", "Track3"]

def recognize_tracks(cd_tracks):
    # Simulate music recognition
    return ["Artist1 - Song1", "Artist2 - Song2", "Artist3 - Song3"]

def create_spotify_playlist(playlist_name, tracks):
    token_info = session.get('token_info')
    if not token_info:
        return redirect(url_for('login'))
    
    sp = spotipy.Spotify(auth=token_info['access_token'])
    user_id = sp.current_user()['id']
    playlist = sp.user_playlist_create(user=user_id, name=playlist_name)
    track_uris = []
    
    for track in tracks:
        result = sp.search(q=track, type='track', limit=1)
        if result['tracks']['items']:
            track_uris.append(result['tracks']['items'][0]['uri'])
    
    if track_uris:
        sp.user_playlist_add_tracks(user=user_id, playlist_id=playlist['id'], tracks=track_uris)

if __name__ == '__main__':
    app.run(debug=True)
