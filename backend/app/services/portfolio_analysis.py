from __future__ import annotations

from typing import Any

from app.config import Config


def _target_equity_share(risk_tolerance: int | None, horizon_years: int | None) -> float:
    r = 3 if risk_tolerance is None else max(1, min(5, risk_tolerance))
    h = 10 if horizon_years is None else max(1, horizon_years)
    base = 0.35 + (r - 1) * 0.1
    if h < 3:
        base -= 0.15
    elif h > 15:
        base += 0.1
    return max(0.15, min(0.95, base))


def analyze_buffer(
    disposable_income_monthly_sek: int | None,
    liquid_buffer_sek: float,
) -> dict[str, Any]:
    monthly = max(1, disposable_income_monthly_sek or 5000)
    target = monthly * Config.BUFFER_MONTHS_EXPENSES
    ratio = liquid_buffer_sek / target if target else 1.0
    ok = ratio >= 1.0
    return {
        "target_buffer_sek": int(target),
        "liquid_buffer_sek": int(liquid_buffer_sek),
        "meets_target": ok,
        "ratio": round(ratio, 2),
        "citations": [
            {
                "label": "Försiktighet och likviditet",
                "detail": "En likvid buffert minskar risken att tvingas sälja riskfyllda tillgångar efter störningar (Carroll, 1992; litteratur om försiktighetssparande).",
            }
        ],
    }


def analyze_holdings(
    profile: dict[str, Any],
    holdings: list[dict[str, Any]],
) -> dict[str, Any]:
    risk = profile.get("risk_tolerance")
    horizon = profile.get("time_horizon_years")
    purpose = (profile.get("savings_purpose") or "").lower()
    target_eq = _target_equity_share(risk, horizon)

    total = sum(float(h.get("value_sek") or 0) for h in holdings) or 1.0
    weighted_eq = sum(float(h.get("equity_share") or 0) * float(h.get("value_sek") or 0) for h in holdings) / total
    weighted_home = sum(
        float(h.get("home_bias_equity") or 0) * float(h.get("equity_share") or 0) * float(h.get("value_sek") or 0)
        for h in holdings
    ) / max(1e-6, sum(float(h.get("equity_share") or 0) * float(h.get("value_sek") or 0) for h in holdings))

    issues: list[dict[str, Any]] = []
    for h in holdings:
        name = h.get("name", "Fond")
        fee = float(h.get("ongoing_fee_pct") or 0)
        dom = (h.get("domicile") or "").upper()
        excess = h.get("three_year_excess_vs_benchmark_pct")
        vehicle = (h.get("vehicle") or "").upper()

        if fee > 0.6:
            issues.append(
                {
                    "holding_id": h.get("id"),
                    "severity": "high",
                    "title": "Höga förvaltningsavgifter",
                    "body": f"{name} har ca {fee:.2f}% i löpande avgift. Höga avgifter är ett robust predikat för lägre nettoavkastning (Berk & Green, 2004; French, 2008).",
                    "citations": [
                        {"label": "Berk & Green (2004)", "detail": "Flöden till fonder och avkastning."},
                        {"label": "French (2008)", "detail": "Kostnaden för aktiv förvaltning."},
                    ],
                }
            )

        if dom == "LU" and vehicle == "ISK":
            issues.append(
                {
                    "holding_id": h.get("id"),
                    "severity": "medium",
                    "title": "Skatte-/domicil för ISK",
                    "body": f"{name} är Luxemburg-domicilerad. För svensk ISK kan utländska fonder skapa effekter via kupongskatt och dubbelbeskattningsregler som skiljer sig från svensk domicil (jfr. svensk kapitalbeskattning via schablon).",
                    "citations": [
                        {
                            "label": "Svensk skatterådgivning rekommenderas",
                            "detail": "Se Skatteverkets vägledning om ISK och utländska värdepapper.",
                        }
                    ],
                }
            )

        if excess is not None and float(excess) < -1.0:
            issues.append(
                {
                    "holding_id": h.get("id"),
                    "severity": "medium",
                    "title": "Underavkastning mot jämförelseindex",
                    "body": f"{name} har underpresterat sitt jämförelseindex med ca {float(excess):.1f} procentenheter per år (3 år).",
                    "citations": [
                        {
                            "label": "Carhart (1997)",
                            "detail": "Uthållighet i fondresultat — svaga fonder tenderar ofta att fortsätta släpa efter kostnader.",
                        }
                    ],
                }
            )

    allocation_note = None
    if abs(weighted_eq - target_eq) > 0.12:
        allocation_note = {
            "severity": "medium",
            "title": "Aktieandel matchar inte målprofilen",
            "body": f"Din portfölj ligger på ca {weighted_eq:.0%} aktier i riskdelen, medan en grov riktlinje för din profil är ca {target_eq:.0%}.",
            "citations": [
                {
                    "label": "Markowitz (1952)",
                    "detail": "Medel-varians-effektivitet — riskandel bör spegla riskvilja och horisont.",
                },
                {
                    "label": "Merton (1969)",
                    "detail": "Portföljval över tid — horisont påverkar lämplig aktieandel.",
                },
            ],
        }

    home_bias_note = None
    if weighted_home > 0.55 and "pension" not in purpose:
        home_bias_note = {
            "severity": "low",
            "title": "Hög hemmarknadsexponering",
            "body": "Sverige är en liten del av världsmarknaden; hög hemma-bias ökar idiosynkratisk risk (Solnik, 1974; litteratur om hemma-bias).",
            "citations": [
                {"label": "Solnik (1974)", "detail": "Internationell diversifiering och hemmamarknadsbias."},
                {"label": "French & Poterba (1991)", "detail": "Sparares diversifiering och internationella aktiemarknader."},
            ],
        }

    suggestions = [
        {
            "name": "Länsförsäkringar Global Indexnära",
            "rationale": "Låg avgift, bred global indexering — minskar kostnadsrisk (French, 2008).",
            "expected_role": "Global kärna med låg avgift",
        },
        {
            "name": "Avanza Global eller motsvarande bred världs-ETF",
            "rationale": "Enkel diversifiering; kombinera med svensk indexfond endast om du medvetet vill ha SE-exponering.",
            "expected_role": "Global kärna",
        },
    ]

    return {
        "profile_targets": {
            "target_equity_share": round(target_eq, 3),
            "actual_equity_share": round(weighted_eq, 3),
            "home_bias_equity_weighted": round(weighted_home, 3),
        },
        "issues": issues,
        "allocation_note": allocation_note,
        "home_bias_note": home_bias_note,
        "suggested_funds": suggestions,
        "citations_global": [
            {"label": "Markowitz (1952)", "detail": "Portföljval."},
            {"label": "Fama & French (1993)", "detail": "Gemensamma riskfaktorer för aktier och räntor — motiv för bred exponering."},
        ],
    }


def build_rebalance_alerts(analysis: dict[str, Any]) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    if analysis.get("allocation_note"):
        a = analysis["allocation_note"]
        alerts.append({"kind": "allocation", "severity": a["severity"], "message": a["title"] + ": " + a["body"]})
    if analysis.get("home_bias_note"):
        h = analysis["home_bias_note"]
        alerts.append({"kind": "home_bias", "severity": h["severity"], "message": h["title"] + ": " + h["body"]})
    return alerts


def list_liquid_accounts(accounts_payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for acc in accounts_payload.get("accounts") or []:
        acc_type = (acc.get("type") or "").upper()
        name = (acc.get("name") or "").lower()
        if acc_type not in ("CHECKING", "SAVINGS") and "buffert" not in name and "sparkonto" not in name:
            continue
        liquid = 0.0
        bal = acc.get("balances") or {}
        booked = bal.get("booked") or {}
        amt = booked.get("amount") or {}
        val = amt.get("value") or {}
        unscaled = val.get("unscaledValue")
        scale = val.get("scale")
        if unscaled is not None:
            try:
                liquid = float(unscaled) / (10 ** int(scale or "0"))
            except (TypeError, ValueError):
                liquid = 0.0
        rows.append({"id": acc.get("id"), "name": acc.get("name"), "liquid_sek": int(liquid)})
    return rows


def sum_liquid_sek_from_accounts(accounts_payload: dict[str, Any]) -> float:
    return float(sum(a["liquid_sek"] for a in list_liquid_accounts(accounts_payload)))
