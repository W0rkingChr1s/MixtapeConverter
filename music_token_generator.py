import jwt
import time

def generate_apple_music_token(key_id, team_id, private_key_path):
    with open(private_key_path, 'r') as f:
        private_key = f.read()

    headers = {
        'alg': 'ES256',
        'kid': key_id
    }

    payload = {
        'iss': team_id,
        'iat': int(time.time()),
        'exp': int(time.time()) + 86400 * 180,
    }

    token = jwt.encode(payload, private_key, algorithm='ES256', headers=headers)
    return token
