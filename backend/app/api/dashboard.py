from __future__ import annotations

import json
from typing import Any

from flask import Blueprint, jsonify, request

from app.api.deps import current_user
from app.config import Config
from app.models import FundOrder, MontroseConnection, OnboardingProfile, PortfolioSnapshot, RebalanceAlert
from app.services.montrose_mcp import McpError, McpToolError, MontroseMcpClient, MontroseMcpConfig
from app.services.montrose_oauth import MontroseAuthError, get_valid_montrose_access_token
from app.services.portfolio_analysis import (
    analyze_holdings,
    build_montrose_buy_plan,
    build_rebalance_alerts,
    holdings_aligned_with_suggestions,
)

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
    eff_risk = profile.adjusted_risk_tolerance or profile.risk_tolerance
    analysis = analyze_holdings(
        {
            "risk_tolerance": eff_risk,
            "time_horizon_years": profile.time_horizon_years,
            "savings_purpose": profile.savings_purpose,
        },
        holdings,
    )

    alerts = build_rebalance_alerts(analysis)
    montrose_row = MontroseConnection.get_or_none(MontroseConnection.user == user)
    connected = montrose_row is not None and bool((montrose_row.access_token or "").strip())
    suggested = analysis.get("suggested_funds") or []
    holdings_match_recos = holdings_aligned_with_suggestions(holdings, suggested)
    show_montrose = not holdings_match_recos
    teq = (analysis.get("profile_targets") or {}).get("target_equity_share")
    buy_plan = (
        build_montrose_buy_plan(holdings, suggested, target_equity_share=float(teq) if teq is not None else None)
        if show_montrose
        else None
    )
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
            "montrose_client_configured": True,
            "montrose_connected": connected,
            "montrose_enabled": connected,
            "montrose_show_prepare_switch": show_montrose,
            "montrose_buy_plan": buy_plan,
        }
    )


@bp.post("/montrose/prepare-switch")
def montrose_prepare_switch():
    """
    Prepare a **Buy** ticket in Montrose from :func:`build_montrose_buy_plan` (holdings vs recommendations).
    Request body may include optional ``account_id`` only.
    """
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    try:
        token = get_valid_montrose_access_token(user)
    except MontroseAuthError as exc:
        return jsonify({"error": str(exc)}), 401

    snap = (
        PortfolioSnapshot.select()
        .where(PortfolioSnapshot.user == user)
        .order_by(PortfolioSnapshot.created_at.desc())
        .first()
    )
    if not snap:
        return jsonify({"error": "Ingen kopplad bank ännu."}), 404
    profile = OnboardingProfile.get(OnboardingProfile.user == user)
    payload = json.loads(snap.normalized_json)
    holdings = payload.get("holdings") or []
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
    suggested = analysis.get("suggested_funds") or []
    if holdings_aligned_with_suggestions(holdings, suggested):
        return jsonify(
            {"error": "Dina innehav följer redan rekommendationerna. Köporder via Montrose behövs inte."}
        ), 400

    teq = (analysis.get("profile_targets") or {}).get("target_equity_share")
    plan = build_montrose_buy_plan(
        holdings, suggested, target_equity_share=float(teq) if teq is not None else None
    )
    if not plan or int(plan.get("amount_sek") or 0) <= 0:
        return jsonify(
            {"error": "Inget köp att förbereda: inga innehav som behöver flyttas till rekommenderad fond."}
        ), 400

    data = request.get_json(silent=True) or {}
    account_id = (data.get("account_id") or "").strip() or None

    client = MontroseMcpClient(
        MontroseMcpConfig(
            base_url=Config.MONTROSE_MCP_BASE_URL,
            timeout=Config.MONTROSE_MCP_TIMEOUT,
        )
    )
    results: list[dict[str, Any]] = []
    try:
        for line in plan.get("buy_lines") or []:
            buy_name = str(line["target_fund_name"]).strip()
            amount = float(line["amount_sek"])
            ob = line.get("montrose_orderbook_id")
            buy_raw = client.create_trade_ticket(
                "Buy",
                name=buy_name,
                amount=amount,
                orderbook_id=int(ob) if ob is not None else None,
                account_id=account_id,
                access_token=token,
            )
            results.append(
                {
                    "name": buy_name,
                    "amount_sek": amount,
                    "montrose_orderbook_id": ob,
                    "raw": buy_raw,
                    "decoded": MontroseMcpClient.decode_tool_text_result(buy_raw),
                }
            )
    except McpToolError as exc:
        return jsonify(
            {
                "error": "Montrose kunde inte skapa köpbiljett (kontrollera fondnamn, ticker eller orderbookId).",
                "detail": str(exc),
            }
        ), 422
    except McpError as exc:
        return jsonify({"error": "Montrose MCP misslyckades.", "detail": str(exc)}), 502

    return jsonify(
        {
            "plan": {
                "amount_sek": plan["amount_sek"],
                "target_equity_share": plan["target_equity_share"],
                "buy_lines": plan["buy_lines"],
                "source_holdings": plan["source_holdings"],
            },
            "buys": results,
            "message": "Köpbiljett(er) skapade i Montrose. Slutför i Montrose / din bank enligt deras flöde.",
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
