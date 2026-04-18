from __future__ import annotations

import secrets
from datetime import datetime, timedelta

import requests
from flask import Blueprint, jsonify, request

from app.api.deps import current_user
from app.config import Config
from app.models.montrose import MontroseConnection, MontroseOAuthState
from app.services.montrose_oauth import (
    build_authorization_url,
    exchange_authorization_code,
    oauth_metadata,
    pkce_pair,
    register_dynamic_client,
)

bp = Blueprint("montrose", __name__, url_prefix="/api/montrose")

_STATE_TTL = timedelta(minutes=15)


@bp.get("/status")
def status():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    conn = MontroseConnection.get_or_none(MontroseConnection.user == user)
    return jsonify(
        {
            "client_configured": True,
            "connected": conn is not None and bool(conn.access_token),
            "expires_at": conn.expires_at if conn else None,
        }
    )


@bp.post("/start")
def start_oauth():
    """Begin Montrose OAuth (PKCE). Returns URL for the browser."""
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401

    try:
        registration = register_dynamic_client(
            issuer=Config.MONTROSE_ISSUER,
            redirect_uri=Config.MONTROSE_REDIRECT_URI,
            scope=Config.MONTROSE_SCOPE,
            client_name=Config.MONTROSE_CLIENT_NAME,
            timeout=Config.MONTROSE_MCP_TIMEOUT,
        )
    except requests.HTTPError as exc:
        detail = ""
        if exc.response is not None:
            detail = (exc.response.text or "")[:1500]
        return jsonify(
            {"error": "Kunde inte registrera OAuth-klient hos Montrose (/register).", "detail": detail or str(exc)}
        ), 502
    except requests.RequestException as exc:
        return jsonify({"error": "Nätverksfel mot Montrose.", "detail": str(exc)}), 502

    client_id = (registration.get("client_id") or "").strip()
    if not client_id:
        return jsonify({"error": "Montrose /register returnerade inget client_id.", "registration": registration}), 502
    reg_secret = registration.get("client_secret")
    client_secret = reg_secret.strip() if isinstance(reg_secret, str) and reg_secret.strip() else None

    meta = oauth_metadata(Config.MONTROSE_ISSUER)
    auth_endpoint = meta.get("authorization_endpoint")
    if not auth_endpoint:
        return jsonify({"error": "Montrose OAuth-metadata saknar authorization_endpoint."}), 502

    verifier, challenge = pkce_pair()
    state = secrets.token_urlsafe(24)
    MontroseOAuthState.delete().where(MontroseOAuthState.user == user).execute()
    MontroseOAuthState.create(
        user=user,
        state=state,
        code_verifier=verifier,
        client_id=client_id,
        client_secret=client_secret,
    )

    authorization_url = build_authorization_url(
        authorization_endpoint=auth_endpoint,
        client_id=client_id,
        redirect_uri=Config.MONTROSE_REDIRECT_URI,
        scope=Config.MONTROSE_SCOPE,
        state=state,
        code_challenge=challenge,
    )
    return jsonify(
        {
            "authorization_url": authorization_url,
            "state": state,
            "redirect_uri": Config.MONTROSE_REDIRECT_URI,
        }
    )


@bp.post("/complete")
def complete_oauth():
    """Exchange authorization code and store tokens on the user."""
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    data = request.get_json(silent=True) or {}
    code = data.get("code")
    state = data.get("state")
    if not code or not state:
        return jsonify({"error": "Saknar code eller state."}), 400

    row = MontroseOAuthState.get_or_none(MontroseOAuthState.state == state)
    if not row or row.user_id != user.id:
        return jsonify({"error": "Ogiltig eller okänd OAuth-state."}), 400
    if datetime.utcnow() - row.created_at.replace(tzinfo=None) > _STATE_TTL:
        MontroseOAuthState.delete().where(MontroseOAuthState.id == row.id).execute()
        return jsonify({"error": "OAuth-state har gått ut. Försök igen."}), 400

    client_id = ((row.client_id or "") if row.client_id is not None else "").strip()
    if not client_id:
        return jsonify({"error": "OAuth-state saknar klient. Starta anslutningen från instrumentpanelen igen."}), 400
    row_secret = row.client_secret
    client_secret = row_secret.strip() if isinstance(row_secret, str) and row_secret.strip() else None

    meta = oauth_metadata(Config.MONTROSE_ISSUER)
    token_endpoint = meta.get("token_endpoint")
    if not token_endpoint:
        return jsonify({"error": "Montrose OAuth-metadata saknar token_endpoint."}), 502

    try:
        tokens = exchange_authorization_code(
            token_endpoint=token_endpoint,
            code=code,
            redirect_uri=Config.MONTROSE_REDIRECT_URI,
            client_id=client_id,
            client_secret=client_secret,
            code_verifier=row.code_verifier,
        )
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": "Kunde inte byta authorization code mot token.", "detail": str(exc)}), 502

    access = tokens.get("access_token")
    if not access:
        return jsonify({"error": "Montrose returnerade inget access_token.", "token_response": tokens}), 502

    MontroseOAuthState.delete().where(MontroseOAuthState.user == user).execute()

    MontroseConnection.delete().where(MontroseConnection.user == user).execute()
    MontroseConnection.create(
        user=user,
        access_token=access,
        refresh_token=tokens.get("refresh_token"),
        client_id=client_id,
        client_secret=client_secret,
        expires_at=tokens.get("expires_at"),
        obtained_at=tokens.get("obtained_at"),
        updated_at=datetime.utcnow(),
    )
    return jsonify({"ok": True})
