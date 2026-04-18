from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.api.deps import current_user
from app.auth_tokens import encode_user_token, hash_password, verify_password
from app.models import OnboardingProfile, User

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.get("/me")
def me():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    profile = OnboardingProfile.get(OnboardingProfile.user == user)
    return jsonify(
        {
            "user": {"id": user.id, "email": user.email},
            "onboarding_completed": profile.onboarding_completed,
        }
    )


@bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or len(password) < 8:
        return jsonify({"error": "Ogiltig e-post eller lösenord (minst 8 tecken)."}), 400
    if User.select().where(User.email == email).exists():
        return jsonify({"error": "E-postadressen används redan."}), 409
    user = User.create(email=email, password_hash=hash_password(password))
    OnboardingProfile.create(user=user)
    token = encode_user_token(user.id)
    return jsonify({"token": token, "user": {"id": user.id, "email": user.email}})


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = User.get_or_none(User.email == email)
    if not user or not verify_password(user.password_hash, password):
        return jsonify({"error": "Felaktiga inloggningsuppgifter."}), 401
    token = encode_user_token(user.id)
    return jsonify({"token": token, "user": {"id": user.id, "email": user.email}})
