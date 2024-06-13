import sys
import os
import platform
import asyncio
import shutil
import tarfile
from PyQt5 import QtWidgets, uic
from PyQt5.QtWidgets import QFileDialog, QMessageBox
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import psutil
from pydub import AudioSegment
from shazamio import Shazam, Serialize
from subprocess import call, check_call, DEVNULL
from requests_oauthlib import OAuth2Session
import requests
import time
from music_token_generator import generate_apple_music_token

# Spotify API credentials
SPOTIPY_CLIENT_ID = 'b816b42cd02043d4bab939320364ac36'
SPOTIPY_CLIENT_SECRET = 'c3bc84a1fb22479ebc7569807098c4be'
SPOTIPY_REDIRECT_URI = 'http://localhost:5000/spotify_callback'

# Apple Music API credentials
APPLE_MUSIC_KEY_ID = '7YXMDFT7MF'
APPLE_MUSIC_TEAM_ID = 'CJBXA6767X'
APPLE_MUSIC_PRIVATE_KEY_PATH = 'AuthKey_7YXMDFT7MF.p8'

# Amazon Music API credentials
AMAZON_MUSIC_CLIENT_ID = 'amzn1.application-oa2-client.7666841a0ad4469dbeec29b0df132a87'
AMAZON_MUSIC_CLIENT_SECRET = 'amzn1.oa2-cs.v1.3aa562dfb8d1c3115a300b287856e4caa0d2ded7bc7b2022d7bf7e4cb7761fb1'
AMAZON_MUSIC_REDIRECT_URI = 'http://localhost:5000/amazon_music_callback'

class MixtapeConverterApp(QtWidgets.QMainWindow):
    def __init__(self):
        super(MixtapeConverterApp, self).__init__()
        uic.loadUi('app.ui', self)

        self.loginButton.clicked.connect(self.login)
        self.convertButton.clicked.connect(self.convert)
        self.reloadButton.clicked.connect(self.reload_drives)

        self.sp_oauth = SpotifyOAuth(
            SPOTIPY_CLIENT_ID, SPOTIPY_CLIENT_SECRET, SPOTIPY_REDIRECT_URI,
            scope='playlist-modify-public'
        )

        self.cd_drives = []
        self.token_info = None
        self.recognized_tracks = []

        self.reload_drives()

    def login(self):
        provider = self.providerComboBox.currentText()
        if provider == 'Spotify':
            auth_url = self.sp_oauth.get_authorize_url()
            self.webView.load(auth_url)
        elif provider == 'Apple Music':
            apple_music_auth_url = 'https://appleid.apple.com/auth/authorize'
            apple_music = OAuth2Session(
                client_id=APPLE_MUSIC_KEY_ID,
                redirect_uri=AMAZON_MUSIC_REDIRECT_URI,
                scope='user-library-modify user-library-read'
            )
            authorization_url, _ = apple_music.authorization_url(apple_music_auth_url)
            self.webView.load(authorization_url)
        elif provider == 'Amazon Music':
            amazon_music = OAuth2Session(AMAZON_MUSIC_CLIENT_ID, redirect_uri=AMAZON_MUSIC_REDIRECT_URI, scope='profile')
            auth_url, _ = amazon_music.authorization_url('https://www.amazon.com/ap/oa')
            self.webView.load(auth_url)

    def convert(self):
        mixtape_name = self.mixtapeNameLineEdit.text()
        cd_drive = self.cdDriveComboBox.currentText()
        cd_tracks = self.rip_cd_tracks(cd_drive)
        self.recognized_tracks = asyncio.run(self.recognize_tracks(cd_tracks))
        
        # Show confirmation dialog
        confirmed, tracks = self.show_confirmation_dialog(self.recognized_tracks)
        if confirmed:
            provider = self.providerComboBox.currentText()
            if provider == 'Spotify':
                self.create_spotify_playlist(mixtape_name, tracks)
            elif provider == 'Apple Music':
                self.create_apple_music_playlist(mixtape_name, tracks)
            elif provider == 'Amazon Music':
                self.create_amazon_music_playlist(mixtape_name, tracks)
            self.show_success_message(mixtape_name)

    def reload_drives(self):
        self.cd_drives = self.get_cd_drives()
        self.cdDriveComboBox.clear()
        self.cdDriveComboBox.addItems(self.cd_drives)

    def get_cd_drives(self):
        cd_drives = []
        for part in psutil.disk_partitions():
            if 'cdrom' in part.opts or 'removable' in part.opts:
                cd_drives.append(part.device)
        return cd_drives

    def install_ffmpeg():
        system = platform.system()
        dependencies_dir = 'dependencies'
    
        if system == 'Windows':
            ffmpeg_dir = os.path.join(dependencies_dir, 'ffmpeg', 'ffmpeg-7.0.1')
            ffmpeg_bin = os.path.join(ffmpeg_dir, 'bin')
            if os.path.isdir(ffmpeg_bin):
                os.environ['PATH'] += os.pathsep + os.path.abspath(ffmpeg_bin)
                print(f"Added {os.path.abspath(ffmpeg_bin)} to PATH")
            else:
                print(f"FFmpeg binary directory not found: {ffmpeg_bin}. Please check the path and try again.")
                sys.exit(1)
    
        elif system == 'Darwin':  # macOS
            ffmpeg_tar_path = os.path.join(dependencies_dir, 'ffmpeg', 'ffmpeg-7.0.1.tar.bz2')
            if os.path.isfile(ffmpeg_tar_path):
                with tarfile.open(ffmpeg_tar_path, 'r:bz2') as tar_ref:
                    tar_ref.extractall('/usr/local/bin')
                    print(f"Extracted FFmpeg to /usr/local/bin")
            else:
                print(f"FFmpeg tar file not found: {ffmpeg_tar_path}. Please check the path and try again.")
                sys.exit(1)
    
        elif system == 'Linux':
            ffmpeg_tar_path = os.path.join(dependencies_dir, 'ffmpeg', 'ffmpeg-7.0.1.tar.bz2')
            if os.path.isfile(ffmpeg_tar_path):
                with tarfile.open(ffmpeg_tar_path, 'r:bz2') as tar_ref:
                    tar_ref.extractall('/usr/local/bin')
                    print(f"Extracted FFmpeg to /usr/local/bin")
            else:
                print(f"FFmpeg tar file not found: {ffmpeg_tar_path}. Please check the path and try again.")
                sys.exit(1)

    def rip_cd_tracks(self, cd_drive):
        tracks = []
        if not os.path.exists('ripped_tracks'):
            os.makedirs('ripped_tracks')

        command = f'ffmpeg -f cdda -i {cd_drive} -vn ripped_tracks/track%d.wav'
        call(command, shell=True)

        for file in os.listdir('ripped_tracks'):
            if file.endswith('.wav'):
                tracks.append(AudioSegment.from_wav(os.path.join('ripped_tracks', file)))

        return tracks

    async def recognize_tracks(self, cd_tracks):
        recognized_tracks = []
        shazam = Shazam()
        for i, track in enumerate(cd_tracks):
            track.export(f"temp_track_{i}.wav", format="wav")
            with open(f"temp_track_{i}.wav", "rb") as fp:
                result = await shazam.recognize_song(fp.read())
                recognized_tracks.append(self.parse_shazam_result(result))
        return recognized_tracks

    def parse_shazam_result(self, result):
        track_info = Serialize.full_track(result)
        return f"{track_info['subtitle']} - {track_info['title']}"

    def create_spotify_playlist(self, playlist_name, tracks):
        if not self.token_info:
            self.login()
            return
        
        sp = spotipy.Spotify(auth=self.token_info['access_token'])
        user_id = sp.current_user()['id']
        playlist = sp.user_playlist_create(user=user_id, name=playlist_name)
        track_uris = []
        
        for track in tracks:
            result = sp.search(q=track, type='track', limit=1)
            if result['tracks']['items']:
                track_uris.append(result['tracks']['items'][0]['uri'])
        
        if track_uris:
            sp.user_playlist_add_tracks(user=user_id, playlist_id=playlist['id'], tracks=track_uris)

    def create_apple_music_playlist(self, playlist_name, tracks):
        if not self.token_info:
            self.login()
            return
        
        headers = {
            'Authorization': f'Bearer {self.token_info["access_token"]}',
            'Content-Type': 'application/json'
        }

        # Create playlist
        playlist_data = {
            "attributes": {
                "name": playlist_name,
                "description": "Created with Mixtape Converter"
            },
            "relationships": {
                "tracks": {
                    "data": [{"id": track, "type": "songs"} for track in tracks]
                }
            },
            "type": "playlists"
        }
        playlist_response = requests.post('https://api.music.apple.com/v1/me/library/playlists', headers=headers, json=playlist_data)
        playlist_response_data = playlist_response.json()
        playlist_id = playlist_response_data['data'][0]['id']

        # Add tracks to playlist
        track_uris = []
        for track in tracks:
            search_response = requests.get(f'https://api.music.apple.com/v1/catalog/us/search?term={track}&types=songs', headers=headers)
            search_data = search_response.json()
            if search_data['results']['songs']['data']:
                track_uris.append(search_data['results']['songs']['data'][0]['id'])

        if track_uris:
            add_tracks_data = {
                "data": [{"id": track_uri, "type": "songs"} for track_uri in track_uris]
            }
            requests.post(f'https://api.music.apple.com/v1/me/library/playlists/{playlist_id}/tracks', headers=headers, json=add_tracks_data)

    def create_amazon_music_playlist(self, playlist_name, tracks):
        if not self.token_info:
            self.login()
            return

        headers = {
            'Authorization': f'Bearer {self.token_info["access_token"]}',
            'Content-Type': 'application/json'
        }

        # Create playlist
        playlist_data = {
            "name": playlist_name,
            "description": "Created with Mixtape Converter",
            "public": False
        }
        playlist_response = requests.post('https://api.amazonmusic.com/v1/me/playlists', headers=headers, json=playlist_data)
        playlist_response_data = playlist_response.json()
        playlist_id = playlist_response_data['id']

        # Add tracks to playlist
        track_uris = []
        for track in tracks:
            search_response = requests.get(f'https://api.amazonmusic.com/v1/catalog/search?q={track}&type=track', headers=headers)
            search_data = search_response.json()
            if search_data['tracks']['items']:
                track_uris.append(search_data['tracks']['items'][0]['uri'])

        if track_uris:
            add_tracks_data = {
                "uris": track_uris
            }
            requests.post(f'https://api.amazonmusic.com/v1/playlists/{playlist_id}/tracks', headers=headers, json=add_tracks_data)

    def show_confirmation_dialog(self, tracks):
        msg = QMessageBox()
        msg.setIcon(QMessageBox.Question)
        msg.setWindowTitle("Bestätigen Sie die erkannten Tracks")
        msg.setText("Bitte bestätigen Sie die erkannten Tracks:")
        msg.setDetailedText("\n".join(tracks))
        msg.setStandardButtons(QMessageBox.Ok | QMessageBox.Cancel)
        result = msg.exec_()

        return result == QMessageBox.Ok, tracks

    def show_success_message(self, playlist_name):
        msg = QMessageBox()
        msg.setIcon(QMessageBox.Information)
        msg.setWindowTitle("Erfolg")
        msg.setText(f"Playlist '{playlist_name}' wurde erfolgreich erstellt!")
        msg.setStandardButtons(QMessageBox.Ok)
        msg.exec_()

if __name__ == '__main__':
    app = QtWidgets.QApplication(sys.argv)
    window = MixtapeConverterApp()
    window.show()
    sys.exit(app.exec_())
