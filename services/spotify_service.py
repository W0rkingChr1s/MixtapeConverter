"""Spotify OAuth helpers and playlist creation."""

import os
import spotipy
from spotipy.oauth2 import SpotifyOAuth


def get_oauth() -> SpotifyOAuth:
    return SpotifyOAuth(
        client_id=os.environ['SPOTIFY_CLIENT_ID'],
        client_secret=os.environ['SPOTIFY_CLIENT_SECRET'],
        redirect_uri=os.environ['SPOTIFY_REDIRECT_URI'],
        scope='playlist-modify-public playlist-modify-private',
        cache_path=None,
        show_dialog=True,
    )


def create_playlist(token_info: dict, playlist_name: str, tracks: list[str]) -> dict:
    """
    Create a private Spotify playlist and add *tracks* to it.

    Returns a dict with:
      - playlist_url : str  – Spotify URL to open the new playlist
      - tracks_added : int  – how many tracks were matched and added
      - not_found    : list[str] – track strings that yielded no search result
    """
    sp = spotipy.Spotify(auth=token_info['access_token'])
    user_id = sp.current_user()['id']

    playlist = sp.user_playlist_create(
        user=user_id,
        name=playlist_name,
        public=False,
        description='Erstellt mit Mixtape Converter',
    )

    track_uris: list[str] = []
    not_found: list[str] = []

    for track in tracks:
        result = sp.search(q=track, type='track', limit=1)
        items = result['tracks']['items']
        if items:
            track_uris.append(items[0]['uri'])
        else:
            not_found.append(track)

    # Spotify allows max 100 tracks per request
    for i in range(0, len(track_uris), 100):
        sp.playlist_add_items(playlist['id'], track_uris[i:i + 100])

    return {
        'playlist_url': playlist['external_urls']['spotify'],
        'tracks_added': len(track_uris),
        'not_found': not_found,
    }
