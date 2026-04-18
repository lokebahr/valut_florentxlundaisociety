from __future__ import annotations

import json

from flask import Blueprint, jsonify, request

from app.api.deps import current_user
from app.models import OnboardingProfile, PortfolioSnapshot
from app.services.fund_agent import assess
from app.services.mock_portfolio import mock_normalized_holdings

bp = Blueprint("agent", __name__, url_prefix="/api/agent")


@bp.post("/assess")
def run_assessment():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401

    try:
        profile_row = OnboardingProfile.get(OnboardingProfile.user == user)
    except OnboardingProfile.DoesNotExist:
        return jsonify({"error": "Ingen onboarding-profil hittades."}), 404

    profile = {
        "risk_tolerance": profile_row.adjusted_risk_tolerance or profile_row.risk_tolerance,
        "time_horizon_years": profile_row.time_horizon_years,
        "savings_purpose": profile_row.savings_purpose,
        "age": profile_row.age,
        "salary_monthly_sek": profile_row.salary_monthly_sek,
        "dependents_count": profile_row.dependents_count,
        "expensive_loans": profile_row.expensive_loans,
        "monthly_contribution_sek": profile_row.monthly_contribution_sek,
    }

    snap = (
        PortfolioSnapshot.select()
        .where(PortfolioSnapshot.user == user)
        .order_by(PortfolioSnapshot.created_at.desc())
        .first()
    )
    if snap:
        payload = json.loads(snap.normalized_json)
        holdings = payload.get("holdings") or []
    else:
        holdings = mock_normalized_holdings()

    result = assess(profile, holdings)
    if result.get("error") == "missing_api_key":
        return jsonify(result), 503
    return jsonify(result)


@bp.post("/debug")
def debug_assessment():
    """No-auth endpoint for local testing — accepts profile + holdings in request body."""
    body = request.get_json(force=True) or {}
    profile = body.get("profile", {})
    holdings = body.get("holdings", mock_normalized_holdings())
    result = assess(profile, holdings)
    if result.get("error") == "missing_api_key":
        return jsonify(result), 503
    return jsonify(result)
