from __future__ import annotations

import json

from flask import Blueprint, jsonify, request

from app.api.deps import current_user
from app.models import FundOrder, OnboardingProfile, PortfolioSnapshot, RebalanceAlert
from app.services.portfolio_analysis import analyze_holdings, build_rebalance_alerts

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@bp.get("/overview")
def overview():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    profile = OnboardingProfile.get(OnboardingProfile.user == user)
    snap = (
        PortfolioSnapshot.select()
        .where(PortfolioSnapshot.user == user)
        .order_by(PortfolioSnapshot.created_at.desc())
        .first()
    )
    if not snap:
        return jsonify({"error": "Ingen kopplad bank ännu."}), 404

    payload = json.loads(snap.normalized_json)
    holdings = payload.get("holdings") or []
    buffer = payload.get("buffer")
    analysis = payload.get("analysis")
    eff_risk = profile.adjusted_risk_tolerance or profile.risk_tolerance
    if not analysis:
        analysis = analyze_holdings(
            {
                "risk_tolerance": eff_risk,
                "time_horizon_years": profile.time_horizon_years,
                "savings_purpose": profile.savings_purpose,
            },
            holdings,
        )
        payload["analysis"] = analysis
        snap.normalized_json = json.dumps(payload, ensure_ascii=False)
        snap.save()

    alerts = build_rebalance_alerts(analysis)
    return jsonify(
        {
            "profile": {
                "risk_tolerance": eff_risk,
                "time_horizon_years": profile.time_horizon_years,
                "savings_purpose": profile.savings_purpose,
                "monthly_contribution_sek": profile.monthly_contribution_sek,
            },
            "buffer": buffer,
            "holdings": holdings,
            "analysis": analysis,
            "alerts": alerts,
            "snapshot_at": snap.created_at.isoformat(),
        }
    )


@bp.get("/orders")
def list_orders():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    rows = [
        {
            "id": o.id,
            "from_name": o.from_name,
            "to_name": o.to_name,
            "amount_sek": o.amount_sek,
            "status": o.status,
            "created_at": o.created_at.isoformat(),
        }
        for o in FundOrder.select().where(FundOrder.user == user).order_by(FundOrder.created_at.desc())
    ]
    return jsonify({"orders": rows})


@bp.post("/orders")
def place_order():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    data = request.get_json(silent=True) or {}
    from_name = data.get("from_name") or ""
    to_name = data.get("to_name") or ""
    amount = int(data.get("amount_sek") or 0)
    if amount <= 0 or not from_name or not to_name:
        return jsonify({"error": "Ogiltig order."}), 400
    order = FundOrder.create(
        user=user,
        from_name=from_name,
        to_name=to_name,
        amount_sek=amount,
        status="submitted_to_bank_mock",
    )
    return jsonify(
        {
            "order": {
                "id": order.id,
                "from_name": order.from_name,
                "to_name": order.to_name,
                "amount_sek": order.amount_sek,
                "status": order.status,
                "created_at": order.created_at.isoformat(),
            },
            "message": "Order lagrad (demo). Genomför bytet i din banks fondhandel eller via rådgivare.",
        }
    )


@bp.get("/alerts")
def alerts():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    rows = [
        {"id": a.id, "kind": a.kind, "message": a.message, "severity": a.severity, "created_at": a.created_at.isoformat()}
        for a in RebalanceAlert.select().where(RebalanceAlert.user == user, RebalanceAlert.dismissed == False)  # noqa: E712
    ]
    return jsonify({"alerts": rows})
