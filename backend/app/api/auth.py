from __future__ import annotations

import json

from flask import Blueprint, jsonify, request
from requests.exceptions import HTTPError

from app.api.deps import current_user
from app.api.tink import sync_portfolio_for_user
from app.auth_tokens import encode_user_token
from app.config import Config
from app.models import OnboardingProfile, User
from app.services.holdings_service_client import HoldingsServiceError
from app.services.tink_client import TinkClient

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _user_public_dict(user: User) -> dict:
    try:
        profile = json.loads(user.tink_profile_json)
    except (json.JSONDecodeError, TypeError):
        profile = {}
    return {
        "id": user.id,
        "tink_user_id": user.tink_user_id,
        "tink_profile": profile,
    }


@bp.post("/mock")
def mock_sign_in():
    """Demo login for local development when Tink credentials are not configured."""
    if not Config.TINK_USE_MOCK and Config.TINK_CLIENT_ID and Config.TINK_CLIENT_SECRET:
        return jsonify({"error": "Mock-inloggning är inaktiverad i produktionsläge."}), 403

    demo_user, _ = User.get_or_create(
        tink_user_id="demo-user",
        defaults={"tink_profile_json": '{"demo": true}'},
    )
    OnboardingProfile.get_or_create(user=demo_user, defaults={})
    token = encode_user_token(demo_user.id)
    return jsonify({"token": token})


@bp.get("/me")
def me():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    profile = OnboardingProfile.get(OnboardingProfile.user == user)
    return jsonify(
        {
            "user": _user_public_dict(user),
            "onboarding_completed": profile.onboarding_completed,
        }
    )


@bp.post("/tink")
def sign_in_with_tink():
    """
    Exchange Tink Link OAuth `code` for a user access token, create/update local user
    from Tink-provided token/callback data, sync accounts/transactions, return JWT.
    """
    data = request.get_json(silent=True) or {}
    code = data.get("code")
    credentials_id = data.get("credentials_id")
    if not code:
        return jsonify({"error": "Saknar code från Tink."}), 400
    if not Config.TINK_CLIENT_ID or not Config.TINK_CLIENT_SECRET:
        return jsonify({"error": "Tink är inte konfigurerat (TINK_CLIENT_ID / TINK_CLIENT_SECRET)."}), 503

    client = TinkClient()
    try:
        token_payload = client.exchange_link_code_for_user_token(code)
    except HTTPError as exc:
        return jsonify({"error": "Tink OAuth misslyckades.", "detail": str(exc)}), 502

    access_token = token_payload.get("access_token")
    if not access_token:
        return jsonify({"error": "Tink returnerade inget access_token.", "token_payload": token_payload}), 502

    tink_uid = (
        token_payload.get("user_id")
        or token_payload.get("userId")
        or token_payload.get("id")
        or token_payload.get("sub")
        or credentials_id
    )
    if not tink_uid:
        return jsonify(
            {
                "error": "Kunde inte härleda Tink-användar-id från token/callback.",
                "token_payload": token_payload,
            }
        ), 502

    tink_profile = {
        "tink_user_id": str(tink_uid),
        "credentials_id": credentials_id,
        "token_payload": token_payload,
    }
    profile_json = json.dumps(tink_profile, ensure_ascii=False)

    # If the user is already logged in, reuse their account so onboarding
    # data entered before the Tink redirect is preserved.
    existing_user = current_user()
    if existing_user:
        user = existing_user
        user.tink_profile_json = profile_json
        user.save()
    else:
        user, created = User.get_or_create(
            tink_user_id=str(tink_uid), defaults={"tink_profile_json": profile_json}
        )
        if not created:
            user.tink_profile_json = profile_json
            user.save()
        OnboardingProfile.get_or_create(user=user, defaults={})

    try:
        portfolio = sync_portfolio_for_user(user, client, token_payload, access_token, credentials_id)
    except HoldingsServiceError as exc:
        return jsonify({"error": "Holdings-tjänsten svarade inte.", "detail": str(exc)}), 502
    except HTTPError as exc:
        return jsonify({"error": "Tink bankdata (konton eller transaktioner) misslyckades.", "detail": str(exc)}), 502

    token = encode_user_token(user.id)
    return jsonify(
        {
            "token": token,
            "user": _user_public_dict(user),
            **portfolio,
        }
    )
