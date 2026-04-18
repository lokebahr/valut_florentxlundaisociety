from __future__ import annotations

import json

from flask import Blueprint, jsonify, request

from app.api.deps import current_user
from app.models import OnboardingProfile, PortfolioSnapshot
from app.services.fund_agent import assess, _target_equity
from app.services.fund_recommender import recommend
from app.services.mock_portfolio import mock_normalized_holdings

bp = Blueprint("agent", __name__, url_prefix="/api/agent")


def _build_profile(profile_row: OnboardingProfile) -> dict:
    return {
        "risk_tolerance": profile_row.adjusted_risk_tolerance or profile_row.risk_tolerance,
        "stated_risk_tolerance": profile_row.risk_tolerance,
        "time_horizon_years": profile_row.time_horizon_years,
        "savings_purpose": profile_row.savings_purpose,
        "age": profile_row.age,
        "salary_monthly_sek": profile_row.salary_monthly_sek,
        "disposable_income_monthly_sek": getattr(profile_row, "disposable_income_monthly_sek", None),
        "dependents_count": profile_row.dependents_count,
        "expensive_loans": profile_row.expensive_loans,
        "monthly_contribution_sek": profile_row.monthly_contribution_sek,
        "scenario_answers_json": getattr(profile_row, "scenario_answers_json", None),
    }


@bp.post("/assess")
def run_assessment():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401

    try:
        profile_row = OnboardingProfile.get(OnboardingProfile.user == user)
    except OnboardingProfile.DoesNotExist:
        return jsonify({"error": "Ingen onboarding-profil hittades."}), 404

    profile = _build_profile(profile_row)

    snap = (
        PortfolioSnapshot.select()
        .where(PortfolioSnapshot.user == user)
        .order_by(PortfolioSnapshot.created_at.desc())
        .first()
    )
    holdings = json.loads(snap.normalized_json).get("holdings") or [] if snap else mock_normalized_holdings()

    result = assess(profile, holdings)
    if result.get("error") == "missing_api_key":
        return jsonify(result), 503

    # Append target allocation so the frontend can display it directly
    risk = profile.get("risk_tolerance")
    horizon = profile.get("time_horizon_years")
    teq = _target_equity(risk, horizon)
    result.setdefault("target_equity_pct", round(teq * 100))
    result.setdefault("target_bond_pct", round((1.0 - teq) * 100))

    return jsonify(result)


@bp.post("/recommend")
def run_recommendation():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401

    try:
        profile_row = OnboardingProfile.get(OnboardingProfile.user == user)
    except OnboardingProfile.DoesNotExist:
        return jsonify({"error": "Ingen onboarding-profil hittades."}), 404

    profile = _build_profile(profile_row)

    # Use stored agent issues if available, otherwise empty list
    snap = (
        PortfolioSnapshot.select()
        .where(PortfolioSnapshot.user == user)
        .order_by(PortfolioSnapshot.created_at.desc())
        .first()
    )
    holdings = json.loads(snap.normalized_json).get("holdings") or [] if snap else mock_normalized_holdings()

    # Run portfolio assess to get current issues for context (uses cached enrichment)
    assess_result = assess(profile, holdings)
    issues = assess_result.get("issues") or []

    result = recommend(profile, issues)
    if result.get("error") == "missing_api_key":
        return jsonify(result), 503

    # Persist so the dashboard can serve it without re-running
    profile_row.recommendations_json = json.dumps(result)
    profile_row.save()

    return jsonify(result)


@bp.get("/recommendations")
def get_recommendations():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401

    try:
        profile_row = OnboardingProfile.get(OnboardingProfile.user == user)
    except OnboardingProfile.DoesNotExist:
        return jsonify({"error": "Ingen onboarding-profil hittades."}), 404

    rj = getattr(profile_row, "recommendations_json", None)
    if not rj:
        return jsonify({"recommendations": None})

    try:
        return jsonify(json.loads(rj))
    except json.JSONDecodeError:
        return jsonify({"recommendations": None})


@bp.post("/debug")
def debug_assessment():
    body = request.get_json(force=True) or {}
    profile = body.get("profile", {})
    holdings = body.get("holdings", mock_normalized_holdings())
    result = assess(profile, holdings)
    if result.get("error") == "missing_api_key":
        return jsonify(result), 503
    return jsonify(result)
