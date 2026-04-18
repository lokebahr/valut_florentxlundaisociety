from __future__ import annotations

import json
from typing import Any

from flask import Blueprint, jsonify, request

from app.api.deps import current_user
from app.config import Config
from app.models import BankConnection, OnboardingProfile, PortfolioSnapshot, User
from app.services.fund_enrichment import enrich_holdings
from app.services.holdings_service_client import HoldingsServiceError, fetch_tink_shaped_accounts
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
    use_holdings_service = bool((Config.HOLDINGS_SERVICE_URL or "").strip())

    if use_holdings_service:
        accounts = fetch_tink_shaped_accounts(user_id=user.id)
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
        tink_transactions: list[Any] | dict[str, Any] = []
        tink_debug = {
            "tink_oauth_token": _redact_oauth_token_payload(token_payload),
            "tink_transactions": tink_transactions,
            "credentials_id": credentials_id or "",
            "holdings_service": True,
            "holdings_service_user_id": user.id,
        }
    else:
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

        tink_debug = {
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
    out: dict[str, Any] = {
        "accounts": accounts,
        "buffer": buffer,
        "holdings": holdings,
        "analysis": analysis,
        "buffer_accounts": buffer_accounts,
        "tink_oauth_token": tink_debug["tink_oauth_token"],
        "tink_transactions": tink_transactions,
    }
    if use_holdings_service:
        out["holdings_service"] = True
    return out


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


@bp.post("/connect-mock")
def connect_mock():
    """Synthesise a demo portfolio for local development when Tink is not configured."""
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    if Config.TINK_CLIENT_ID and Config.TINK_CLIENT_SECRET:
        return jsonify({"error": "Mock-koppling är inaktiverad i produktionsläge."}), 403

    if (Config.HOLDINGS_SERVICE_URL or "").strip():
        try:
            accounts = fetch_tink_shaped_accounts(user_id=user.id)
        except HoldingsServiceError as exc:
            return jsonify({"error": "Holdings-tjänsten svarade inte.", "detail": str(exc)}), 502
        holdings = normalize_holdings(accounts, use_mock_enrichment=True)
        liquid = sum_liquid_sek_from_accounts(accounts)
        profile = _profile_dict(user)
        buffer = analyze_buffer(profile.get("disposable_income_monthly_sek"), liquid)
        analysis = analyze_holdings(profile, holdings)
        buffer_accounts = list_liquid_accounts(accounts)
        tink_debug = {
            "holdings_service": True,
            "holdings_service_user_id": user.id,
            "mock_connect": True,
            "tink_transactions": [],
            "tink_oauth_token": {},
            "credentials_id": "",
        }
        PortfolioSnapshot.delete().where(PortfolioSnapshot.user == user).execute()
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
        return jsonify(
            {
                "buffer": buffer,
                "holdings": holdings,
                "analysis": analysis,
                "buffer_accounts": buffer_accounts,
                "holdings_service": True,
            }
        )

    from app.services.mock_portfolio import (  # noqa: PLC0415
        mock_buffer_accounts,
        mock_normalized_holdings,
        mock_tink_accounts_payload,
    )

    holdings = mock_normalized_holdings()
    profile = _profile_dict(user)
    liquid_sek = 42_500 + 90_000
    buffer = analyze_buffer(profile.get("disposable_income_monthly_sek"), liquid_sek)
    analysis = analyze_holdings(profile, holdings)
    buffer_accounts = mock_buffer_accounts()

    PortfolioSnapshot.delete().where(PortfolioSnapshot.user == user).execute()
    PortfolioSnapshot.create(
        user=user,
        raw_json=json.dumps(mock_tink_accounts_payload()),
        normalized_json=json.dumps(
            {
                "holdings": holdings,
                "buffer": buffer,
                "analysis": analysis,
                "buffer_accounts": buffer_accounts,
            }
        ),
    )

    return jsonify(
        {
            "buffer": buffer,
            "holdings": holdings,
            "analysis": analysis,
            "buffer_accounts": buffer_accounts,
        }
    )


@bp.get("/link")
def link_info():
    """Public: URL to start Tink Link (same flow for first-time sign-in and returning users)."""
    if not Config.TINK_CLIENT_ID or not Config.TINK_CLIENT_SECRET:
        return jsonify({"mode": "mock"})
    client = TinkClient()
    return jsonify(
        {
            "mode": "tink",
            "url": client.build_transactions_link_url(),
            "redirect_uri": Config.TINK_REDIRECT_URI,
        }
    )


@bp.post("/enrich-holdings")
def enrich_holdings_endpoint():
    """Enrich the latest snapshot's holdings by sending each ISIN through the fund-parser."""
    from app.services.mock_portfolio import mock_normalized_holdings

    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401

    snap = (
        PortfolioSnapshot.select()
        .where(PortfolioSnapshot.user == user)
        .order_by(PortfolioSnapshot.created_at.desc())
        .first()
    )
    if not snap:
        return jsonify({"error": "Ingen portfölj ännu."}), 404

    payload = json.loads(snap.normalized_json)
    snapshot_holdings = payload.get("holdings") or []

    has_isins = any(h.get("isin") for h in snapshot_holdings)
    if not has_isins:
        base = mock_normalized_holdings()
        for i, h in enumerate(base):
            if i < len(snapshot_holdings):
                h["value_sek"] = snapshot_holdings[i].get("value_sek", h["value_sek"])
        snapshot_holdings = base

    holdings = enrich_holdings(snapshot_holdings)
    payload["holdings"] = holdings

    profile = _profile_dict(user)
    payload["analysis"] = analyze_holdings(profile, holdings)

    snap.normalized_json = json.dumps(payload, ensure_ascii=False)
    snap.save()

    return jsonify({
        "holdings": holdings,
        "analysis": payload["analysis"],
    })


@bp.get("/snapshot")
def snapshot():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    payload = _latest_snapshot_payload(user)
    if not payload:
        return jsonify({"error": "Ingen portfölj ännu."}), 404
    return jsonify(payload)
