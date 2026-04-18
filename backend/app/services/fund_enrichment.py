"""Enrich holdings with real fund data from the fund-parser microservice."""
from __future__ import annotations

from typing import Any

import requests

from app.config import Config

_ENRICH_FIELDS = (
    "name", "ongoing_fee_pct", "domicile", "benchmark", "equity_share",
    "bond_share", "is_actively_managed", "geographic_focus",
    "sfdr_classification", "risk_indicator", "fund_type",
    "recommended_holding_period_years", "registration_country",
)


def enrich_holdings(holdings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """For each holding with an ISIN, call the fund-parser ingest endpoint and
    merge real fund data (fee, domicile, benchmark, etc.) into the holding."""
    base = Config.FUND_PARSER_URL.rstrip("/")
    enriched = []
    for h in holdings:
        isin = h.get("isin")
        if not isin:
            enriched.append(h)
            continue
        try:
            resp = requests.get(f"{base}/funds/ingest/{isin}", timeout=30)
            if resp.status_code == 200:
                fund_data = resp.json().get("fund", {})
                merged = {**h}
                for field in _ENRICH_FIELDS:
                    if fund_data.get(field) is not None:
                        merged[field] = fund_data[field]
                enriched.append(merged)
            else:
                enriched.append(h)
        except requests.RequestException:
            enriched.append(h)
    return enriched
