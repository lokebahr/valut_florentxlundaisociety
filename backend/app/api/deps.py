from __future__ import annotations

from flask import Request, request

from app.auth_tokens import decode_user_token
from app.models import User


def bearer_user_id(req: Request) -> int | None:
    auth = req.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.removeprefix("Bearer ").strip()
    return decode_user_token(token)


def current_user() -> User | None:
    uid = bearer_user_id(request)
    if not uid:
        return None
    return User.get_or_none(User.id == uid)
