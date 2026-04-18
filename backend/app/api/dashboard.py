from __future__ import annotations

import json

from flask import Blueprint, jsonify, request

from app.api.deps import current_user
from app.config import Config
from app.models import FundOrder, MontroseConnection, OnboardingProfile, PortfolioSnapshot, RebalanceAlert
from app.services.montrose_mcp import McpError, McpToolError, MontroseMcpClient, MontroseMcpConfig
from app.services.montrose_oauth import MontroseAuthError, get_valid_montrose_access_token
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
    montrose_row = MontroseConnection.get_or_none(MontroseConnection.user == user)
    connected = montrose_row is not None and bool((montrose_row.access_token or "").strip())
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
        }
    )


@bp.post("/montrose/prepare-switch")
def montrose_prepare_switch():
    """
    Prepare two Montrose trade tickets (Sell old fund, Buy new fund) for the end user to execute.
    Uses the logged-in user's stored Montrose OAuth access token (refreshed if needed).
    """
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    try:
        token = get_valid_montrose_access_token(user)
    except MontroseAuthError as exc:
        return jsonify({"error": str(exc)}), 401

    data = request.get_json(silent=True) or {}
    sell_name = (data.get("sell_name") or "").strip()
    buy_name = (data.get("buy_name") or "").strip()
    amount_sek = data.get("amount_sek")
    account_id = (data.get("account_id") or "").strip() or None

    if not sell_name or not buy_name:
        return jsonify({"error": "Ange sell_name och buy_name (fondnamn som Montrose känner igen)."}), 400
    try:
        amount = float(amount_sek)
    except (TypeError, ValueError):
        return jsonify({"error": "Ogiltigt amount_sek."}), 400
    if amount <= 0:
        return jsonify({"error": "amount_sek måste vara > 0."}), 400

    client = MontroseMcpClient(
        MontroseMcpConfig(
            base_url=Config.MONTROSE_MCP_BASE_URL,
            timeout=Config.MONTROSE_MCP_TIMEOUT,
        )
    )
    try:
        sell_raw = client.create_trade_ticket(
            "Sell",
            name=sell_name,
            amount=amount,
            account_id=account_id,
            access_token=token,
        )
        buy_raw = client.create_trade_ticket(
            "Buy",
            name=buy_name,
            amount=amount,
            account_id=account_id,
            access_token=token,
        )
    except McpToolError as exc:
        return jsonify(
            {
                "error": "Montrose kunde inte skapa biljett (kontrollera fondnamn, ticker eller orderbookId).",
                "detail": str(exc),
            }
        ), 422
    except McpError as exc:
        return jsonify({"error": "Montrose MCP misslyckades.", "detail": str(exc)}), 502

    return jsonify(
        {
            "sell": {
                "raw": sell_raw,
                "decoded": MontroseMcpClient.decode_tool_text_result(sell_raw),
            },
            "buy": {
                "raw": buy_raw,
                "decoded": MontroseMcpClient.decode_tool_text_result(buy_raw),
            },
            "message": "Biljetter skapade i Montrose. Slutför i Montrose / din bank enligt deras flöde.",
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
