from __future__ import annotations

import datetime as dt
import json
import uuid

import requests
from flask import Blueprint, jsonify, request

from app.api.deps import current_user
from app.config import Config
from app.models import BankConnection, OnboardingProfile, PortfolioSnapshot, User
from app.services.mock_portfolio import mock_buffer_accounts, mock_tink_accounts_payload
from app.services.normalize import normalize_holdings, snapshot_json
from app.services.portfolio_analysis import (
    analyze_buffer,
    analyze_holdings,
    list_liquid_accounts,
    sum_liquid_sek_from_accounts,
)
from app.services.tink_client import TinkClient, parse_token_expiry

bp = Blueprint("tink", __name__, url_prefix="/api/tink")


def _profile_dict(user: User) -> dict:
    p = OnboardingProfile.get(OnboardingProfile.user == user)
    eff_risk = p.adjusted_risk_tolerance or p.risk_tolerance
    return {
        "risk_tolerance": eff_risk,
        "time_horizon_years": p.time_horizon_years,
        "savings_purpose": p.savings_purpose,
        "disposable_income_monthly_sek": p.disposable_income_monthly_sek,
    }


@bp.get("/link")
def link_info():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    if Config.TINK_USE_MOCK or not (Config.TINK_CLIENT_ID and Config.TINK_CLIENT_SECRET):
        return jsonify(
            {
                "mode": "mock",
                "message": "Mock-läge: ingen Tink-nyckel eller TINK_USE_MOCK=true.",
            }
        )
    client = TinkClient()
    return jsonify(
        {
            "mode": "tink",
            "url": client.build_transactions_link_url(),
            "redirect_uri": Config.TINK_REDIRECT_URI,
        }
    )


@bp.post("/connect-mock")
def connect_mock():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    accounts = mock_tink_accounts_payload()
    holdings = normalize_holdings(accounts, use_mock_enrichment=True)
    liquid = sum_liquid_sek_from_accounts(accounts)
    profile = _profile_dict(user)
    buffer = analyze_buffer(profile.get("disposable_income_monthly_sek"), liquid)
    analysis = analyze_holdings(profile, holdings)

    BankConnection.delete().where(BankConnection.user == user).execute()
    BankConnection.create(
        user=user,
        is_mock=True,
        credentials_id="mock",
        access_token="mock",
        token_expires_at=dt.datetime.utcnow() + dt.timedelta(days=3650),
    )
    PortfolioSnapshot.create(
        user=user,
        raw_json=snapshot_json(accounts),
        normalized_json=snapshot_json(
            {
                "holdings": holdings,
                "buffer": buffer,
                "analysis": analysis,
                "buffer_accounts": mock_buffer_accounts(),
            }
        ),
    )
    return jsonify(
        {
            "accounts": accounts,
            "buffer": buffer,
            "holdings": holdings,
            "analysis": analysis,
            "buffer_accounts": mock_buffer_accounts(),
        }
    )


@bp.post("/finalize")
def finalize():
    """Exchange Tink Link `code` for user token and persist accounts (sandbox)."""
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    data = request.get_json(silent=True) or {}
    code = data.get("code")
    credentials_id = data.get("credentials_id")
    if not code:
        return jsonify({"error": "Saknar code från Tink callback."}), 400

    if Config.TINK_USE_MOCK or not (Config.TINK_CLIENT_ID and Config.TINK_CLIENT_SECRET):
        return jsonify({"error": "Använd /api/tink/connect-mock i mock-läge."}), 400

    client = TinkClient()
    token_payload = client.exchange_link_code_for_user_token(code)
    access_token = token_payload.get("access_token")
    if not access_token:
        return jsonify({"error": "Kunde inte hämta access_token från Tink."}), 502

    accounts = client.fetch_accounts(access_token)
    holdings = normalize_holdings(accounts, use_mock_enrichment=False)
    liquid = sum_liquid_sek_from_accounts(accounts)
    profile = _profile_dict(user)
    buffer = analyze_buffer(profile.get("disposable_income_monthly_sek"), liquid)
    analysis = analyze_holdings(profile, holdings)

    BankConnection.delete().where(BankConnection.user == user).execute()
    BankConnection.create(
        user=user,
        is_mock=False,
        credentials_id=credentials_id or "",
        access_token=access_token,
        token_expires_at=parse_token_expiry(token_payload),
    )
    buffer_accounts = list_liquid_accounts(accounts)
    PortfolioSnapshot.create(
        user=user,
        raw_json=json.dumps(accounts, ensure_ascii=False),
        normalized_json=json.dumps(
            {"holdings": holdings, "buffer": buffer, "analysis": analysis, "buffer_accounts": buffer_accounts},
            ensure_ascii=False,
        ),
    )
    return jsonify({"accounts": accounts, "buffer": buffer, "holdings": holdings, "analysis": analysis})


@bp.get("/snapshot")
def snapshot():
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
    raw = json.loads(snap.raw_json)
    return jsonify(
        {
            "holdings": payload.get("holdings") or [],
            "buffer": payload.get("buffer") or {},
            "analysis": payload.get("analysis") or {},
            "buffer_accounts": payload.get("buffer_accounts") or [],
            "accounts": raw,
        }
    )


@bp.post("/ensure-external-user")
def ensure_external_user():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    if user.tink_external_user_id:
        return jsonify({"external_user_id": user.tink_external_user_id})
    if Config.TINK_USE_MOCK or not (Config.TINK_CLIENT_ID and Config.TINK_CLIENT_SECRET):
        ext = f"valut_mock_{user.id}"
        user.tink_external_user_id = ext
        user.save()
        return jsonify({"external_user_id": ext})

    ext = f"valut_{user.id}_{uuid.uuid4().hex[:10]}"
    client = TinkClient()
    token = client.client_credentials_token("user:create")
    access = token.get("access_token")
    if not access:
        return jsonify({"error": "Kunde inte autentisera mot Tink (user:create)."}), 502
    r = requests.post(
        f"{Config.TINK_API_BASE.rstrip('/')}/api/v1/user/create",
        headers={"Authorization": f"Bearer {access}", "Content-Type": "application/json"},
        json={"external_user_id": ext, "market": "SE", "locale": "sv_SE"},
        timeout=30,
    )
    if not r.ok:
        return jsonify({"error": "Tink user/create misslyckades.", "detail": r.text}), 502
    user.tink_external_user_id = ext
    user.save()
    return jsonify({"external_user_id": ext})
