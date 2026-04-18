"""Montrose OAuth (PKCE) + per-user token refresh."""

from __future__ import annotations

import base64
import hashlib
import secrets
import time
from typing import Any
from urllib.parse import urlencode

import requests

from app.config import Config
from app.models.montrose import MontroseConnection
from app.models.user import User


class MontroseAuthError(RuntimeError):
    """User has not connected Montrose or tokens cannot be refreshed."""


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def pkce_pair() -> tuple[str, str]:
    verifier = _b64url(secrets.token_bytes(48))
    challenge = _b64url(hashlib.sha256(verifier.encode("ascii")).digest())
    return verifier, challenge


def _enrich_token_times(token_response: dict[str, Any]) -> dict[str, Any]:
    out = dict(token_response)
    now = int(time.time())
    out["obtained_at"] = now
    expires_in = out.get("expires_in")
    if isinstance(expires_in, (int, float)):
        out["expires_at"] = now + int(expires_in)
    return out


def oauth_metadata(issuer: str) -> dict[str, Any]:
    url = f"{issuer.rstrip('/')}/.well-known/oauth-authorization-server"
    r = requests.get(url, timeout=Config.MONTROSE_MCP_TIMEOUT)
    r.raise_for_status()
    return r.json()


def register_dynamic_client(
    *,
    issuer: str,
    redirect_uri: str,
    scope: str,
    client_name: str,
    timeout: int,
) -> dict[str, Any]:
    """RFC-style dynamic client registration at ``{issuer}/register`` (Montrose MCP)."""
    url = f"{issuer.rstrip('/')}/register"
    body = {
        "client_name": client_name,
        "redirect_uris": [redirect_uri],
        "grant_types": ["authorization_code", "refresh_token"],
        "token_endpoint_auth_method": "none",
        "response_types": ["code"],
        "scope": scope,
    }
    r = requests.post(url, json=body, timeout=timeout)
    r.raise_for_status()
    return r.json()


def exchange_authorization_code(
    *,
    token_endpoint: str,
    code: str,
    redirect_uri: str,
    client_id: str,
    client_secret: str | None,
    code_verifier: str,
) -> dict[str, Any]:
    form: dict[str, str] = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "code_verifier": code_verifier,
    }
    if client_secret:
        form["client_secret"] = client_secret
    r = requests.post(token_endpoint, data=form, timeout=Config.MONTROSE_MCP_TIMEOUT)
    r.raise_for_status()
    return _enrich_token_times(r.json())


def refresh_access_token(
    *,
    token_endpoint: str,
    client_id: str,
    client_secret: str | None,
    refresh_token: str,
) -> dict[str, Any]:
    form: dict[str, str] = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
    }
    if client_secret:
        form["client_secret"] = client_secret
    r = requests.post(token_endpoint, data=form, timeout=Config.MONTROSE_MCP_TIMEOUT)
    r.raise_for_status()
    refreshed = _enrich_token_times(r.json())
    if "refresh_token" not in refreshed:
        refreshed["refresh_token"] = refresh_token
    return refreshed


def build_authorization_url(
    *,
    authorization_endpoint: str,
    client_id: str,
    redirect_uri: str,
    scope: str,
    state: str,
    code_challenge: str,
) -> str:
    query = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": scope,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return f"{authorization_endpoint}?{urlencode(query)}"


def _is_token_valid(conn: MontroseConnection) -> bool:
    if not conn.access_token:
        return False
    if not conn.expires_at:
        return True
    return int(time.time()) < int(conn.expires_at) - 60


def get_valid_montrose_access_token(user: User) -> str:
    conn = MontroseConnection.get_or_none(MontroseConnection.user == user)
    if not conn:
        raise MontroseAuthError("Anslut Montrose först (OAuth).")

    if _is_token_valid(conn):
        return conn.access_token

    if not conn.refresh_token:
        raise MontroseAuthError("Montrose-sessionen har gått ut. Anslut igen.")

    meta = oauth_metadata(Config.MONTROSE_ISSUER)
    token_endpoint = meta.get("token_endpoint")
    if not token_endpoint:
        raise MontroseAuthError("Montrose OAuth-metadata saknar token_endpoint.")

    refreshed = refresh_access_token(
        token_endpoint=token_endpoint,
        client_id=conn.client_id,
        client_secret=conn.client_secret,
        refresh_token=conn.refresh_token,
    )
    conn.access_token = refreshed.get("access_token") or ""
    if refreshed.get("refresh_token"):
        conn.refresh_token = refreshed["refresh_token"]
    conn.expires_at = refreshed.get("expires_at")
    conn.obtained_at = refreshed.get("obtained_at")
    from datetime import datetime as dt

    conn.updated_at = dt.utcnow()
    conn.save()
    if not conn.access_token:
        raise MontroseAuthError("Montrose refresh returnerade inget access_token.")
    return conn.access_token
