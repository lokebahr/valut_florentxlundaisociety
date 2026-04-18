"""
Portfolio assessment agent.

Uses Claude with tool use to:
1. Critique the user's current holdings against their onboarding profile
2. Fetch real fund alternatives from the fund-parser microservice
3. Return a structured, personalised assessment + recommendations
"""
from __future__ import annotations

import json
from typing import Any

import anthropic
import requests

from app.config import Config
from app.services.fund_enrichment import enrich_holdings

_TOOLS: list[dict[str, Any]] = [
    {
        "name": "list_funds",
        "description": (
            "Fetch all parsed funds from the fund-parser database, optionally filtered by fund_type. "
            "Returns a list of funds with their key metrics (fee, risk, benchmark, SFDR, etc.)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "fund_type": {
                    "type": "string",
                    "enum": ["equity", "bond", "mixed"],
                    "description": "Filter by fund type. Omit to get all funds.",
                }
            },
            "required": [],
        },
    },
    {
        "name": "get_fund",
        "description": "Fetch full details of a specific fund by ISIN from the fund-parser database.",
        "input_schema": {
            "type": "object",
            "properties": {
                "isin": {"type": "string", "description": "The ISIN code of the fund."}
            },
            "required": ["isin"],
        },
    },
]

_SYSTEM = """Du är en expert på svenska investeringar och fondanalys. Du utvärderar en användares fondportfölj och rekommenderar bättre alternativ baserat på ett evidensbaserat ramverk inspirerat av akademisk forskning och Lysas investeringsfilosofi.

BEDÖMNINGSRAMVERK (tillämpa strikt):

1. KOSTNADER — Viktigaste prediktorn för netttoavkastning
   - Löpande avgift > 0.5%: HÖG allvarlighet. Aktiva fonder returnerar avgifter till investerare som underprestation.
   - Löpande avgift 0.3-0.5%: MEDEL allvarlighet.
   - Mål: under 0.3% för indexfonder.
   - Källa: French (2008), Berk & Green (2004)

2. AKTIV vs PASSIV
   - 65-75% av aktivt förvaltade fonder underpresterar sitt jämförelseindex efter avgifter.
   - Aktiv förvaltning är inte evidensbaserad utan särskild anledning.
   - Källa: Fama (1970), Carhart (1997)

3. RISKANPASSNING — Anpassa till denna användare
   - Beräkna målaktieandel: bas 35% vid risk=1, +10% per risknivå, +10% om horisont >15 år, -15% om horisont <3 år
   - Om faktisk aktieandel avviker >12% från mål: flagga som felplacering
   - Källa: Markowitz (1952), Merton (1969)

4. DIVERSIFIERING
   - Sverige = ~1% av världens börsvärde. Hemmalandsbias >40% i aktier är problematiskt.
   - Lysa tillåter ~20% svensk hemmalandsbias av köpkraftsskäl.
   - Koncentration i ett enda land/sektor: flagga
   - Källa: Solnik (1974), French & Poterba (1991)

5. SKATTEEFFEKTIVITET
   - Luxemburg-domicilierade fonder (domicil=LU) i ISK-konton kan skapa källskatteeffekter.
   - Svensk domicil föredras för ISK när kostnaden är likvärdig.

6. AVKASTNING
   - 3-årig överavkastning vs jämförelseindex < -1%: fonden underpresterar konsekvent.

VID REKOMMENDATIONER:
- Använd list_funds och get_fund för att hitta RIKTIGA fonder från databasen.
- Rekommendera endast fonder som faktiskt finns i databasen.
- En ersättning måste vara strikt bättre på minst 2 kriterier.
- Om inget bra alternativ finns i databasen, säg det ärligt.

UTDATAFORMAT — svara med ett enda JSON-objekt:
{
  "overall_assessment": "2-3 meningar om portföljsituationen specifikt för denna användare",
  "target_allocation": {
    "equity_pct": float,
    "bond_pct": float,
    "rationale": "sträng"
  },
  "issues": [
    {
      "holding_name": "sträng",
      "severity": "high|medium|low",
      "category": "cost|active_management|risk_alignment|diversification|tax|performance",
      "problem": "kort titel",
      "detail": "specifik förklaring med referens till användarens profil",
      "citation": "forskningsreferens"
    }
  ],
  "recommendations": [
    {
      "replaces": "namnet på fonden som ersätts",
      "isin": "ISIN för rekommenderad fond från databasen",
      "name": "fondnamn",
      "rationale": "varför denna fond är bättre för denna specifika användare",
      "improvements": ["lista med konkreta förbättringar jämfört med nuvarande fond"]
    }
  ],
  "rebalancing_advice": "sträng — om aktie/räntefördelningen behöver justeras, förklara hur via bidragsstyrning (inte försäljning).",
  "no_alternatives_found": "sträng — endast om databasen saknar lämpliga alternativ"
}

Svara ENDAST med det slutliga JSON-objektet. Ingen förklaring utanför JSON."""


def _run_tool(name: str, inputs: dict[str, Any]) -> str:
    base = Config.FUND_PARSER_URL.rstrip("/")
    try:
        if name == "list_funds":
            fund_type = inputs.get("fund_type")
            resp = requests.get(f"{base}/funds/", timeout=5)
            resp.raise_for_status()
            funds = resp.json()
            if fund_type:
                funds = [f for f in funds if f.get("fund_type") == fund_type]
            slim = [
                {
                    "isin": f.get("isin"),
                    "name": f.get("name"),
                    "fund_type": f.get("fund_type"),
                    "domicile": f.get("domicile"),
                    "registration_country": f.get("registration_country"),
                    "base_currency": f.get("base_currency"),
                    "ongoing_fee_pct": f.get("ongoing_fee_pct"),
                    "risk_indicator": f.get("risk_indicator"),
                    "benchmark": f.get("benchmark"),
                    "sfdr_classification": f.get("sfdr_classification"),
                    "is_actively_managed": f.get("is_actively_managed"),
                    "esg": f.get("esg"),
                    "equity_share": f.get("equity_share"),
                    "bond_share": f.get("bond_share"),
                    "geographic_focus": f.get("geographic_focus"),
                    "recommended_holding_period_years": f.get("recommended_holding_period_years"),
                }
                for f in funds
            ]
            return json.dumps(slim, ensure_ascii=False)

        if name == "get_fund":
            isin = inputs["isin"]
            resp = requests.get(f"{base}/funds/{isin}", timeout=5)
            if resp.status_code == 404:
                return json.dumps({"error": f"Fund {isin} not found in database."})
            resp.raise_for_status()
            return json.dumps(resp.json(), ensure_ascii=False)

    except requests.RequestException as e:
        return json.dumps({"error": f"Fund parser service unavailable: {e}"})

    return json.dumps({"error": f"Unknown tool: {name}"})


def _target_equity(risk: int | None, horizon: int | None) -> float:
    r = max(1, min(5, risk or 3))
    h = max(1, horizon or 10)
    base = 0.35 + (r - 1) * 0.10
    if h < 3:
        base -= 0.15
    elif h > 15:
        base += 0.10
    return round(max(0.15, min(0.95, base)), 2)


def assess(profile: dict[str, Any], holdings: list[dict[str, Any]]) -> dict[str, Any]:
    client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)

    holdings = enrich_holdings(holdings)
    holdings = [{k: v for k, v in h.items() if k != "notes"} for h in holdings]

    risk = profile.get("risk_tolerance")
    horizon = profile.get("time_horizon_years")
    target_eq = _target_equity(risk, horizon)
    target_bond = round(1.0 - target_eq, 2)

    total_sek = sum(float(h.get("value_sek") or 0) for h in holdings) or 1.0
    actual_eq = round(
        sum(float(h.get("equity_share") or 0) * float(h.get("value_sek") or 0) for h in holdings) / total_sek, 2
    )

    user_context = f"""ANVÄNDARPROFIL:
- Risktolerans: {risk}/5
- Tidshorisont: {horizon} år
- Sparsyfte: {profile.get("savings_purpose")}
- Ålder: {profile.get("age")}
- Månadslön: {profile.get("salary_monthly_sek")} SEK
- Barn/beroende: {profile.get("dependents_count")}
- Har dyra lån: {profile.get("expensive_loans")}
- Månadssparande: {profile.get("monthly_contribution_sek")} SEK

BERÄKNADE MÅL (Markowitz/Merton-ramverk):
- Målaktieandel: {target_eq:.0%}
- Målränteandel: {target_bond:.0%}
- Faktisk aktieandel: {actual_eq:.0%}

NUVARANDE INNEHAV (totalt värde: {int(total_sek):,} SEK):
{json.dumps(holdings, ensure_ascii=False, indent=2)}

Din uppgift:
1. Bedöm kritiskt varför denna portfölj är suboptimal FÖR DENNA SPECIFIKA ANVÄNDARE.
2. Använd list_funds och get_fund för att hitta riktiga alternativ från fonddatabasen.
3. Returnera den strukturerade JSON-bedömningen enligt specifikationen."""

    messages: list[dict[str, Any]] = [{"role": "user", "content": user_context}]

    for _ in range(10):
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=_SYSTEM,
            tools=_TOOLS,
            messages=messages,
        )

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            for block in response.content:
                if not hasattr(block, "text"):
                    continue
                text = block.text.strip()
                if not text:
                    continue
                if "```" in text:
                    inner = text.split("```")[1]
                    if inner.startswith("json"):
                        inner = inner[4:]
                    text = inner.strip()
                if not text.startswith("{"):
                    start = text.find("{")
                    end = text.rfind("}")
                    if start != -1 and end != -1:
                        text = text[start:end + 1]
                if not text:
                    continue
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    continue
            break

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = _run_tool(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })
            messages.append({"role": "user", "content": tool_results})

    return {"error": "Agent did not produce a result."}
