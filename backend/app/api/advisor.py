from __future__ import annotations

import json

import anthropic
from flask import Blueprint, jsonify, request

from app.api.deps import current_user
from app.config import Config
from app.models import OnboardingProfile, PortfolioSnapshot
from app.services.fund_agent import _target_equity
from app.services.mock_portfolio import mock_normalized_holdings

bp = Blueprint("advisor", __name__, url_prefix="/api/advisor")


def _build_system_prompt(profile: dict, holdings: list, recommendations: dict | None) -> str:
    total_sek = sum(float(h.get("value_sek") or 0) for h in holdings) or 0
    risk = profile.get("risk_tolerance")
    horizon = profile.get("time_horizon_years")
    teq = _target_equity(risk, horizon)

    holdings_text = "\n".join(
        f"  - {h.get('name', '?')}: {int(float(h.get('value_sek') or 0)):,} kr"
        f", avgift {h.get('ongoing_fee_pct', '-')}%"
        f", domicil {h.get('domicile', '-')}"
        f", konto {h.get('vehicle', '-')}"
        for h in holdings
    ) or "  Inga innehav"

    reco_text = ""
    if recommendations:
        funds = recommendations.get("recommendations") or []
        rationale = recommendations.get("rationale") or ""
        if funds:
            lines = "\n".join(
                f"  - {f['name']} ({f.get('role', '')}, {f.get('suggested_weight_pct', 0)}%"
                f", avgift {f.get('ongoing_fee_pct', '-')}%): {f.get('rationale', '')}"
                for f in funds
            )
            reco_text = f"\nREKOMMENDERADE FONDER:\nGrund: {rationale}\n{lines}"

    return f"""Du är en personlig AI-rådgivare för en svensk investerare. Svara kortfattat, vänligt och på svenska. Hänvisa till akademiska källor (Markowitz, Fama-French, Bogle, Merton m.fl.) när det är relevant. Förklara enkelt utan finansjargong.

ANVÄNDARENS PORTFÖLJ:
- Total: {int(total_sek):,} kr
- Risknivå: {risk}/5, tidshorisont: {horizon} år, syfte: {profile.get('savings_purpose')}
- Ålder: {profile.get('age')}, månadssparande: {profile.get('monthly_contribution_sek')} kr
- Målallokering: {round(teq * 100)}% aktier / {round((1 - teq) * 100)}% räntor

NUVARANDE INNEHAV:
{holdings_text}
{reco_text}

Du kan förklara varför rekommendationerna gavs, diskutera riskprofilen, jämföra avgifter och svara på frågor om portföljteorin bakom förslagen. Spekulera inte om framtida avkastning med konkreta siffror."""


@bp.post("/chat")
def chat():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401

    data = request.get_json(force=True) or {}
    messages: list[dict] = data.get("messages") or []
    if not messages:
        return jsonify({"error": "Inga meddelanden."}), 400

    api_key = (Config.ANTHROPIC_API_KEY or "").strip()
    if not api_key:
        return jsonify({"reply": "AI-rådgivaren är inte konfigurerad — sätt ANTHROPIC_API_KEY i backend/.env."}), 200

    try:
        profile_row = OnboardingProfile.get(OnboardingProfile.user == user)
    except OnboardingProfile.DoesNotExist:
        return jsonify({"error": "Ingen onboarding-profil hittades."}), 404

    snap = (
        PortfolioSnapshot.select()
        .where(PortfolioSnapshot.user == user)
        .order_by(PortfolioSnapshot.created_at.desc())
        .first()
    )
    holdings = json.loads(snap.normalized_json).get("holdings") or [] if snap else mock_normalized_holdings()

    profile = {
        "risk_tolerance": profile_row.adjusted_risk_tolerance or profile_row.risk_tolerance,
        "time_horizon_years": profile_row.time_horizon_years,
        "savings_purpose": profile_row.savings_purpose,
        "age": profile_row.age,
        "monthly_contribution_sek": profile_row.monthly_contribution_sek,
    }

    rj = getattr(profile_row, "recommendations_json", None)
    recommendations = None
    if rj:
        try:
            recommendations = json.loads(rj)
        except (json.JSONDecodeError, TypeError):
            pass

    system_prompt = _build_system_prompt(profile, holdings, recommendations)

    claude_messages = [
        {"role": m["role"], "content": m["content"]}
        for m in messages
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system_prompt,
        messages=claude_messages,
    )

    reply = "".join(getattr(b, "text", "") for b in response.content).strip()
    return jsonify({"reply": reply})
