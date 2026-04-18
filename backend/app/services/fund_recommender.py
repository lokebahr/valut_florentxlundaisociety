"""
Fund recommendation agent.

Fetches available funds from fund-parser, combines with known-good index funds,
then uses Claude Haiku to pick the best 2-4 funds for the user's profile.
"""
from __future__ import annotations

import json
from typing import Any

import anthropic
import requests

from app.config import Config

_SYSTEM = """Du är expert på svenska indexfonder. Välj 2-4 bästa ersättningsfonder för användaren ENBART från listan nedan.

Om listan inte innehåller tillräckligt bra alternativ (för lågt antal fonder, fel tillgångsslag eller alla har höga avgifter) — returnera en tom recommendations-lista och förklara varför i rationale.

Hitta INTE på fonder. Använd ENBART de ISIN och namn som finns i listan.

URVALSKRITERIER (strikt prioritet):
1. Avgift så låg som möjligt — helst < 0.3% (passiv förvaltning)
2. Svensk domicil (SE) föredras framför LU i ISK
3. Bred global diversifiering, inte enbart Sverige
4. Portföljvikter ska matcha målallokeringen aktier/räntor exakt

Returnera ENBART detta JSON:
{"target_equity_pct":55,"target_bond_pct":45,"rationale":"1-2 meningar varför dessa passar","recommendations":[{"isin":"","name":"","role":"equity|fixed_income","suggested_weight_pct":55,"ongoing_fee_pct":0.19,"rationale":"En mening kopplad till profil"}]}"""


def _fetch_db_funds() -> list[dict[str, Any]]:
    base = (Config.FUND_PARSER_URL or "").rstrip("/")
    if not base:
        return []
    try:
        resp = requests.get(f"{base}/funds/", timeout=10)
        if resp.status_code == 200:
            return resp.json() or []
    except Exception:
        pass
    return []


def _target_equity(risk: int | None, horizon: int | None) -> float:
    r = max(1, min(5, risk or 3))
    h = max(1, horizon or 10)
    base = 0.35 + (r - 1) * 0.10
    if h < 3:
        base -= 0.15
    elif h > 15:
        base += 0.10
    return round(max(0.15, min(0.95, base)), 2)


def recommend(profile: dict[str, Any], issues: list[dict[str, Any]]) -> dict[str, Any]:
    api_key = (Config.ANTHROPIC_API_KEY or "").strip()
    if not api_key:
        return {"error": "missing_api_key"}

    risk = profile.get("risk_tolerance")
    horizon = profile.get("time_horizon_years")
    target_eq = _target_equity(risk, horizon)
    target_bond = round(1.0 - target_eq, 2)

    all_funds = _fetch_db_funds()
    if not all_funds:
        return {
            "target_equity_pct": round(target_eq * 100),
            "target_bond_pct": round(target_bond * 100),
            "rationale": "Inga fonder finns ännu i databasen. Ladda upp faktablad i fund-parser för att få rekommendationer.",
            "recommendations": [],
        }

    # Keep compact representation for the prompt
    fund_list = [
        {
            "isin": f.get("isin"),
            "name": f.get("fund_name") or f.get("name"),
            "fee": f.get("ongoing_fee_pct"),
            "domicile": f.get("domicile"),
            "equity_share": f.get("equity_share"),
            "description": f.get("description") or f.get("geographic_focus"),
        }
        for f in all_funds
        if f.get("isin") and (f.get("fund_name") or f.get("name"))
    ]

    # Summarise current issues for context
    issue_summary = "; ".join(
        f"{i.get('holding_name','?')}: {i.get('problem','')}" for i in (issues or [])
    ) or "inga specifika problem identifierade"

    user_msg = (
        f"PROFIL: risk {risk}/5, horisont {horizon} år, syfte {profile.get('savings_purpose')}\n"
        f"MÅL: {target_eq:.0%} aktier / {target_bond:.0%} räntor\n"
        f"IDENTIFIERADE PROBLEM: {issue_summary}\n\n"
        f"TILLGÄNGLIGA FONDER:\n{json.dumps(fund_list, ensure_ascii=False)}\n\n"
        f"Välj bästa kombinationen. Vikterna ska summera till 100%."
    )

    client = anthropic.Anthropic(api_key=api_key)

    for attempt in range(2):
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )

        raw = ""
        for block in response.content:
            if hasattr(block, "text"):
                raw = block.text.strip()
                break

        text = raw
        if "```" in text:
            inner = text.split("```")[1]
            text = inner[4:].strip() if inner.startswith("json") else inner.strip()
        if not text.startswith("{"):
            s, e = text.find("{"), text.rfind("}")
            if s != -1 and e != -1:
                text = text[s : e + 1]

        try:
            result = json.loads(text)
            result.setdefault("target_equity_pct", round(target_eq * 100))
            result.setdefault("target_bond_pct", round(target_bond * 100))
            return result
        except json.JSONDecodeError:
            pass

    return {
        "target_equity_pct": round(target_eq * 100),
        "target_bond_pct": round(target_bond * 100),
        "rationale": "Rekommendationsanalysen kunde inte slutföras.",
        "recommendations": [],
    }
