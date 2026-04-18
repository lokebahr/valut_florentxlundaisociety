import datetime as dt

import jwt

from app.config import Config


def encode_user_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": dt.datetime.utcnow() + dt.timedelta(seconds=Config.JWT_EXPIRATION_SECONDS),
        "iat": dt.datetime.utcnow(),
    }
    return jwt.encode(payload, Config.SECRET_KEY, algorithm="HS256")


def decode_user_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, Config.SECRET_KEY, algorithms=["HS256"])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError):
        return None
