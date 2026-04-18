"""PDF factsheet → structured FundFact via Claude (type-aware)."""
from __future__ import annotations

import base64
import json
from typing import Any

import anthropic

from app.config import settings

_CLIENT = None


def _client() -> anthropic.Anthropic:
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _CLIENT


_SYSTEM = (
    "You are a financial document parser specialising in EU/Swedish fund factsheets (Faktablad / KID). "
    "Return ONLY valid JSON. No markdown, no explanation."
)

_COMMON_SCHEMA = """
{
  "isin": "string",
  "name": "string — full share class name",
  "fund_name": "string — subfund name",
  "asset_manager": "string",
  "domicile": "2-letter country code (LU, SE, IE…)",
  "base_currency": "3-letter code",
  "sfdr_classification": "'Article 6' | 'Article 8' | 'Article 9' | null",
  "benchmark": "string | null",
  "investment_goal": "1-2 sentence objective",
  "risk_indicator": "integer 1-7",
  "recommended_holding_period_years": "integer",
  "ongoing_fee_pct": "float — management + admin fees %",
  "transaction_cost_pct": "float",
  "entry_cost_pct": "float",
  "exit_cost_pct": "float",
  "equity_share": "float 0.0-1.0 — estimated equity allocation",
  "bond_share": "float 0.0-1.0 — estimated bond allocation",
  "is_actively_managed": "boolean",
  "esg": "boolean — true if Article 8/9 or explicit ESG mandate",
  "factsheet_date": "YYYY-MM-DD",
  "geographic_focus": "primary region/country or 'Global' | null",
  "fund_type": "'equity' | 'bond' | 'mixed'",
  "performance_scenarios": {
    "stress_1y_pct": "float",
    "stress_5y_ann_pct": "float",
    "unfavorable_1y_pct": "float",
    "unfavorable_5y_ann_pct": "float",
    "moderate_1y_pct": "float",
    "moderate_5y_ann_pct": "float",
    "favorable_1y_pct": "float",
    "favorable_5y_ann_pct": "float"
  }
}
"""

_TYPE_SCHEMAS = {
    "equity": """
  "type_specific": {
    "sector_focus": "string — primary sector or 'Diversified' | null",
    "market_cap": "'large' | 'mid' | 'small' | 'all' | null",
    "num_holdings": "integer | null",
    "currency_hedged": "boolean | null",
    "top_countries": ["list of up to 5 country names or codes mentioned | null"]
  }
""",
    "bond": """
  "type_specific": {
    "bond_type": "'government' | 'corporate' | 'high-yield' | 'investment-grade' | 'mixed' | null",
    "avg_duration_years": "float | null",
    "credit_quality": "'investment-grade' | 'high-yield' | 'mixed' | null",
    "yield_to_maturity_pct": "float | null",
    "currency_hedged": "boolean | null"
  }
""",
    "mixed": """
  "type_specific": {
    "target_equity_pct": "float — target equity % (0-100) | null",
    "target_bond_pct": "float — target bond % (0-100) | null",
    "rebalancing_strategy": "string | null",
    "risk_profile": "'conservative' | 'balanced' | 'growth' | null"
  }
""",
}


def _build_prompt(fund_type: str | None) -> str:
    type_schema = _TYPE_SCHEMAS.get(fund_type or "", "")
    if type_schema:
        full_schema = _COMMON_SCHEMA.rstrip("\n}") + ",\n" + type_schema + "}"
    else:
        # Unknown type — include all type_specific options, Claude picks
        all_specific = "\n  // Include whichever type_specific block fits: equity, bond, or mixed\n"
        full_schema = _COMMON_SCHEMA.rstrip("\n}") + ",\n" + all_specific + "}"

    return f"""Parse this fund factsheet PDF and return a single JSON object matching this schema exactly:

{full_schema}

Rules:
- fund_type: 'equity' if equity_share ≥ 0.8, 'bond' if bond_share ≥ 0.6, otherwise 'mixed'.
- Use null for any field you cannot find. Never guess numerical values.
- Percentages like -58.1% → store as -58.1 (not -0.581).
- equity_share and bond_share are decimals (0.0–1.0).
- Return ONLY the JSON object."""


def parse_pdf(pdf_bytes: bytes) -> dict[str, Any]:
    client = _client()
    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")

    # Pass 1: quick type detection + full parse in one call (no type hint yet)
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {"type": "base64", "media_type": "application/pdf", "data": pdf_b64},
                    },
                    {"type": "text", "text": _build_prompt(None)},
                ],
            }
        ],
    )

    raw = msg.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    first_pass: dict[str, Any] = json.loads(raw)
    detected_type = first_pass.get("fund_type")

    # If type_specific already populated correctly, we're done
    if first_pass.get("type_specific"):
        return first_pass

    # Pass 2: re-ask with type-specific schema if type_specific is missing
    if detected_type in _TYPE_SCHEMAS:
        msg2 = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {"type": "base64", "media_type": "application/pdf", "data": pdf_b64},
                        },
                        {"type": "text", "text": _build_prompt(detected_type)},
                    ],
                }
            ],
        )
        raw2 = msg2.content[0].text.strip()
        if raw2.startswith("```"):
            raw2 = raw2.split("```")[1]
            if raw2.startswith("json"):
                raw2 = raw2[4:]
            raw2 = raw2.strip()
        return json.loads(raw2)

    return first_pass
