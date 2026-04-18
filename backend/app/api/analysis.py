from __future__ import annotations

import json

from flask import Blueprint, jsonify

from app.api.deps import current_user
from app.models import OnboardingProfile, PortfolioSnapshot
from app.services.mock_portfolio import mock_tink_accounts_payload
from app.services.normalize import normalize_holdings
from app.services.portfolio_analysis import analyze_holdings

bp = Blueprint("analysis", __name__, url_prefix="/api/analysis")


@bp.post("/run")
def run_analysis():
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
        return jsonify({"error": "Ingen portfölj hittades. Anslut bank först."}), 400

    payload = json.loads(snap.normalized_json)
    holdings = payload.get("holdings") or []
    p = OnboardingProfile.get(OnboardingProfile.user == user)
    eff_risk = p.adjusted_risk_tolerance or p.risk_tolerance
    profile = {
        "risk_tolerance": eff_risk,
        "time_horizon_years": p.time_horizon_years,
        "savings_purpose": p.savings_purpose,
    }
    analysis = analyze_holdings(profile, holdings)
    payload["analysis"] = analysis
    snap.normalized_json = json.dumps(payload, ensure_ascii=False)
    snap.save()
    return jsonify({"analysis": analysis})


@bp.get("/demo")
def demo_without_bank():
    """Offline demo analysis using mock holdings."""
    accounts = mock_tink_accounts_payload()
    holdings = normalize_holdings(accounts, use_mock_enrichment=True)
    profile = {"risk_tolerance": 3, "time_horizon_years": 12, "savings_purpose": "pension"}
    return jsonify({"holdings": holdings, "analysis": analyze_holdings(profile, holdings)})
