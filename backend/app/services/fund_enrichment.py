"""Enrich holdings with real fund data from the fund-parser microservice."""
from __future__ import annotations

import time
from typing import Any

import requests

from app.config import Config

# First GET may trigger PDF→LLM parse in fund-parser; allow time + a few retries on transient errors.
_FUND_PARSER_TIMEOUT_SEC = 120
_FUND_PARSER_ATTEMPTS = 4
_FUND_PARSER_BACKOFF_SEC = 2.0

_ENRICH_FIELDS = (
    "name", "ongoing_fee_pct", "domicile", "benchmark", "equity_share",
    "bond_share", "is_actively_managed", "geographic_focus",
    "sfdr_classification", "risk_indicator", "fund_type",
    "recommended_holding_period_years", "registration_country",
)


def _get_fund_facts(base: str, isin: str) -> dict[str, Any] | None:
    url = f"{base}/funds/{isin}"
    for attempt in range(_FUND_PARSER_ATTEMPTS):
        try:
            resp = requests.get(url, timeout=_FUND_PARSER_TIMEOUT_SEC)
            if resp.status_code == 200:
                return resp.json()
            retryable = resp.status_code in (502, 503, 504)
        except requests.Timeout:
            retryable = True
        except requests.RequestException:
            retryable = True
        if retryable and attempt < _FUND_PARSER_ATTEMPTS - 1:
            time.sleep(_FUND_PARSER_BACKOFF_SEC * (attempt + 1))
            continue
        return None
    return None


def enrich_holdings(holdings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """For each holding with an ISIN, call fund-parser ``GET /funds/{isin}`` and
    merge stored fund facts (fee, domicile, benchmark, etc.) into the holding."""
    base = Config.FUND_PARSER_URL.rstrip("/")
    enriched = []
    for h in holdings:
        isin = h.get("isin")
        if not isin:
            enriched.append(h)
            continue
        fund_data = _get_fund_facts(base, str(isin).strip().upper())
        if fund_data:
            merged = {**h}
            for field in _ENRICH_FIELDS:
                if fund_data.get(field) is not None:
                    merged[field] = fund_data[field]
            enriched.append(merged)
        else:
            enriched.append(h)
    return enriched
