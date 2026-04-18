from __future__ import annotations

import datetime as dt
import json
from typing import Any

from flask import Blueprint, jsonify, request

from app.api.deps import current_user
from app.config import Config
from app.models import BankConnection, OnboardingProfile, PortfolioSnapshot, User
from app.services.normalize import normalize_holdings
from app.services.portfolio_analysis import (
    analyze_buffer,
    analyze_holdings,
    list_liquid_accounts,
    sum_liquid_sek_from_accounts,
)
from app.services.tink_client import TinkClient, parse_token_expiry

bp = Blueprint("tink", __name__, url_prefix="/api/tink")

_SENSITIVE_OAUTH_KEYS = frozenset({"access_token", "refresh_token", "id_token"})


def _redact_oauth_token_payload(payload: dict) -> dict:
    """Return a copy safe to show in UI (tokens shortened; rest unchanged)."""
    out = dict(payload)
    for key in _SENSITIVE_OAUTH_KEYS:
        val = out.get(key)
        if not val or not isinstance(val, str):
            continue
        if len(val) > 14:
            out[key] = f"{val[:6]}…{val[-4:]}"
        else:
            out[key] = "***"
    return out


def _profile_dict(user: User) -> dict:
    p = OnboardingProfile.get(OnboardingProfile.user == user)
    eff_risk = p.adjusted_risk_tolerance or p.risk_tolerance
    return {
        "risk_tolerance": eff_risk,
        "time_horizon_years": p.time_horizon_years,
        "savings_purpose": p.savings_purpose,
        "disposable_income_monthly_sek": p.disposable_income_monthly_sek,
    }


def sync_portfolio_for_user(
    user: User,
    client: TinkClient,
    token_payload: dict[str, Any],
    access_token: str,
    credentials_id: str | None,
) -> dict[str, Any]:
    """Persist bank connection and portfolio snapshot from a user access token (fails if Tink fails)."""
    accounts = client.fetch_accounts(access_token)
    holdings = normalize_holdings(accounts, use_mock_enrichment=False)
    liquid = sum_liquid_sek_from_accounts(accounts)
    profile = _profile_dict(user)
    buffer = analyze_buffer(profile.get("disposable_income_monthly_sek"), liquid)
    analysis = analyze_holdings(profile, holdings)

    BankConnection.delete().where(BankConnection.user == user).execute()
    BankConnection.create(
        user=user,
        credentials_id=credentials_id or "",
        access_token=access_token,
        token_expires_at=parse_token_expiry(token_payload),
    )
    buffer_accounts = list_liquid_accounts(accounts)
    tink_transactions = client.fetch_transactions(access_token)

    tink_debug: dict[str, Any] = {
        "tink_oauth_token": _redact_oauth_token_payload(token_payload),
        "tink_transactions": tink_transactions,
        "credentials_id": credentials_id or "",
    }

    PortfolioSnapshot.create(
        user=user,
        raw_json=json.dumps(accounts, ensure_ascii=False),
        normalized_json=json.dumps(
            {
                "holdings": holdings,
                "buffer": buffer,
                "analysis": analysis,
                "buffer_accounts": buffer_accounts,
                "tink_debug": tink_debug,
            },
            ensure_ascii=False,
        ),
    )
    return {
        "accounts": accounts,
        "buffer": buffer,
        "holdings": holdings,
        "analysis": analysis,
        "buffer_accounts": buffer_accounts,
        "tink_oauth_token": tink_debug["tink_oauth_token"],
        "tink_transactions": tink_transactions,
    }


def _latest_snapshot_payload(user: User) -> dict | None:
    snap = (
        PortfolioSnapshot.select()
        .where(PortfolioSnapshot.user == user)
        .order_by(PortfolioSnapshot.created_at.desc())
        .first()
    )
    if not snap:
        return None
    payload = json.loads(snap.normalized_json)
    raw = json.loads(snap.raw_json)
    out: dict = {
        "holdings": payload.get("holdings") or [],
        "buffer": payload.get("buffer") or {},
        "analysis": payload.get("analysis") or {},
        "buffer_accounts": payload.get("buffer_accounts") or [],
        "accounts": raw,
    }
    td = payload.get("tink_debug")
    if isinstance(td, dict):
        out["tink_debug"] = td
        out["tink_oauth_token"] = td.get("tink_oauth_token")
        out["tink_transactions"] = td.get("tink_transactions")
        if td.get("tink_transactions_error"):
            out["tink_transactions_error"] = td["tink_transactions_error"]
        if td.get("credentials_id") is not None:
            out["credentials_id"] = td["credentials_id"]
    return out


@bp.get("/link")
def link_info():
    """Public: URL to start Tink Link (same flow for first-time sign-in and returning users)."""
    if not Config.TINK_CLIENT_ID or not Config.TINK_CLIENT_SECRET:
        return jsonify({"error": "Tink är inte konfigurerat (TINK_CLIENT_ID / TINK_CLIENT_SECRET)."}), 503
    client = TinkClient()
    return jsonify(
        {
            "url": client.build_transactions_link_url(),
            "redirect_uri": Config.TINK_REDIRECT_URI,
        }
    )


@bp.get("/snapshot")
def snapshot():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    payload = _latest_snapshot_payload(user)
    if not payload:
        return jsonify({"error": "Ingen portfölj ännu."}), 404
    return jsonify(payload)
