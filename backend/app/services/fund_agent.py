"""
Portfolio assessment agent.

Uses Claude to flag portfolio issues against the user's profile and enriched holdings.
Does not suggest replacement funds — only structured issues + short summary.
"""
from __future__ import annotations

import json
from typing import Any

import anthropic

from app.config import Config
from app.services.fund_enrichment import enrich_holdings

_SYSTEM = """Du är en expert på svenska investeringar och fondanalys. Du utvärderar en användares fondportfölj utifrån ett evidensbaserat ramverk inspirerat av akademisk forskning och Lysas investeringsfilosofi.

VIKTIGT: Du ska ENDAST peka ut problem (issues) och en kort sammanfattning. 
Ge INTE rekommendationer om specifika ersättningsfonder, ISIN eller fondbyten. 
Ge INTE ombalanseringsråd som steg-för-steg-allokering — fokusera på vad som är fel och varför.

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

UTDATAFORMAT — svara med ett enda JSON-objekt (endast dessa nycklar):
{
  "overall_assessment": "2-3 meningar om portföljsituationen specifikt för denna användare",
  "issues": [
    {
      "holding_name": "sträng",
      "severity": "high|medium|low",
      "category": "cost|active_management|risk_alignment|diversification|tax|performance",
      "problem": "kort titel",
      "detail": "specifik förklaring med referens till användarens profil och innehavens fält (avgift, domicil, benchmark, m.m.)",
      "citation": "forskningsreferens"
    }
  ]
}

Om inget är fel: "issues" kan vara en tom lista och overall_assessment kort motiverar det.

Svara ENDAST med det slutliga JSON-objektet. Ingen förklaring utanför JSON."""


def _normalize_agent_payload(data: dict[str, Any]) -> dict[str, Any]:
    """Drop legacy keys if the model returns them anyway."""
    out = dict(data)
    for k in (
        "recommendations",
        "rebalancing_advice",
        "no_alternatives_found",
        "target_allocation",
    ):
        out.pop(k, None)
    return out


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
    api_key = (Config.ANTHROPIC_API_KEY or "").strip()
    if not api_key:
        return {
            "error": "missing_api_key",
            "message": "Sätt ANTHROPIC_API_KEY i backend/.env (eller miljön) för att köra portföljbedömningen.",
            "overall_assessment": "",
            "issues": [],
        }

    client = anthropic.Anthropic(api_key=api_key)

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
1. Bedöm kritiskt varför denna portfölj kan vara suboptimal FÖR DENNA SPECIFIKA ANVÄNDARE.
2. Använd enbart uppgifterna i innehaven (inkl. fält som kommer från faktablad om de finns).
3. Returnera JSON enligt specifikationen — inga fondrekommendationer."""

    messages: list[dict[str, Any]] = [{"role": "user", "content": user_context}]

    for _ in range(3):
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=_SYSTEM,
            messages=messages,
        )

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
                    text = text[start : end + 1]
            if not text:
                continue
            try:
                return _normalize_agent_payload(json.loads(text))
            except json.JSONDecodeError:
                continue

        messages.append({"role": "assistant", "content": response.content})
        messages.append({
            "role": "user",
            "content": "Svara endast med giltigt JSON enligt systeminstruktionen (overall_assessment + issues).",
        })

    return {"error": "Agent did not produce a result."}
