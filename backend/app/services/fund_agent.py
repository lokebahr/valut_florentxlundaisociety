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

_SYSTEM = """Du är expert på svenska investeringar. Analysera varför användarens NUVARANDE fonder är suboptimala för just denna person.

Fokusera ENBART på de fonder användaren äger. Koppla varje problem till ett konkret fondattribut (avgift, domicil, förvaltningstyp osv.) OCH ett specifikt användarattribut (risk, horisont, syfte, beteendeprofil).

REGLER:
- Avgift > 0.5 %: hög allvarlighet (Berk & Green 2004)
- Avgift 0.3–0.5 %: medel allvarlighet
- Aktiv fond som underpresterat benchmark: flagga (Carhart 1997)
- LU-domicil i ISK: källskatteläckage
- Aktieandel avviker > 12 % från mål: riskavvikelse (Markowitz 1952)
- Hemlandsbias > 40 %: diversifieringsproblem (Solnik 1974)

Svara ENBART med detta JSON (inga extra nycklar, ingen text utanför):
{"overall_assessment":"1-2 meningar","issues":[{"holding_name":"","severity":"high|medium|low","category":"cost|active_management|risk_alignment|diversification|tax|performance","problem":"kort titel","detail":"1 mening med konkret fondattribut + användarkontext","citation":"källa"}]}"""


def _normalize_agent_payload(data: dict[str, Any]) -> dict[str, Any]:
    out = dict(data)
    for k in ("recommendations", "rebalancing_advice", "no_alternatives_found", "target_allocation"):
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


def _scenario_summary(scenario_json: str | None) -> str:
    if not scenario_json:
        return ""
    try:
        answers: dict[str, int] = json.loads(scenario_json)
    except (json.JSONDecodeError, TypeError):
        return ""
    if not answers:
        return ""
    label_map = {
        "bull": "uppgång",
        "bear": "nedgång",
        "patience": "sidorörelser",
        "recovery": "krasch+återhämtning",
        "volatile": "volatilitet",
        "bubble": "bubbla",
    }
    parts = [f"{label_map.get(k, k)}: {v}" for k, v in answers.items() if v is not None]
    values = [v for v in answers.values() if v is not None]
    avg = round(sum(values) / len(values), 1) if values else None
    summary = ", ".join(parts)
    if avg is not None:
        summary += f" → genomsnitt {avg}/5"
    return summary


def assess(profile: dict[str, Any], holdings: list[dict[str, Any]]) -> dict[str, Any]:
    api_key = (Config.ANTHROPIC_API_KEY or "").strip()
    if not api_key:
        return {
            "error": "missing_api_key",
            "message": "Sätt ANTHROPIC_API_KEY i backend/.env för att köra portföljbedömningen.",
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

    scenario_line = _scenario_summary(profile.get("scenario_answers_json"))
    behavioral_note = ""
    if scenario_line:
        behavioral_note = f"\n- Beteendescenarier (1–5): {scenario_line}"
        stated = profile.get("stated_risk_tolerance") or risk
        if stated and risk and stated != risk:
            behavioral_note += f"\n- Justerad risk ({risk}) skiljer sig från stated ({stated})"

    user_context = (
        f"PROFIL:\n"
        f"- Risk: {risk}/5, horisont: {horizon} år, syfte: {profile.get('savings_purpose')}\n"
        f"- Ålder: {profile.get('age')}, lön: {profile.get('salary_monthly_sek')} kr/mån\n"
        f"- Beroende: {profile.get('dependents_count')}, dyra lån: {profile.get('expensive_loans')}\n"
        f"- Månadssparande: {profile.get('monthly_contribution_sek')} kr{behavioral_note}\n"
        f"\nMÅL (Markowitz/Merton): aktier {target_eq:.0%} / räntor {target_bond:.0%}\n"
        f"FAKTISK aktieandel: {actual_eq:.0%}\n"
        f"\nINNEHAV ({int(total_sek):,} SEK totalt):\n"
        f"{json.dumps(holdings, ensure_ascii=False, indent=2)}\n"
        f"\nReturnera JSON enligt systeminstruktionen. Inga fondrekommendationer."
    )

    messages: list[dict[str, Any]] = [{"role": "user", "content": user_context}]

    for attempt in range(2):
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1200,
            system=_SYSTEM,
            messages=messages,
        )

        raw_text = ""
        for block in response.content:
            if not hasattr(block, "text"):
                continue
            raw_text = block.text.strip()
            break

        print(f"[fund_agent] attempt={attempt} stop_reason={response.stop_reason} raw={raw_text[:300]!r}")

        if not raw_text:
            continue

        text = raw_text
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

        try:
            return _normalize_agent_payload(json.loads(text))
        except json.JSONDecodeError as exc:
            print(f"[fund_agent] JSON parse error: {exc}")

        messages.append({"role": "assistant", "content": response.content})
        messages.append({
            "role": "user",
            "content": "Svara endast med giltigt JSON (overall_assessment + issues).",
        })

    return {"error": "Agent did not produce a result."}
