from __future__ import annotations

import json
from typing import Any

from app.services.mock_portfolio import mock_normalized_holdings


def _sek_from_balance(account: dict[str, Any]) -> float:
    bal = account.get("balances") or {}
    booked = bal.get("booked") or {}
    amt = booked.get("amount") or {}
    val = amt.get("value") or {}
    unscaled = val.get("unscaledValue")
    scale = val.get("scale")
    if unscaled is None:
        return 0.0
    try:
        return float(unscaled) / (10 ** int(scale or "0"))
    except (TypeError, ValueError):
        return 0.0


def normalize_holdings(accounts_payload: dict[str, Any], use_mock_enrichment: bool) -> list[dict[str, Any]]:
    if use_mock_enrichment:
        return mock_normalized_holdings()

    holdings: list[dict[str, Any]] = []
    for acc in accounts_payload.get("accounts") or []:
        acc_type = (acc.get("type") or "").upper()
        if acc_type != "INVESTMENT":
            continue
        value = _sek_from_balance(acc)
        if value <= 0:
            continue
        holdings.append(
            {
                "id": acc.get("id"),
                "account_id": acc.get("id"),
                "name": acc.get("name") or "Investering",
                "vehicle": "UNKNOWN",
                "domicile": "XX",
                "equity_share": 0.6,
                "bond_share": 0.4,
                "global_diversification_score": 0.5,
                "home_bias_equity": 0.5,
                "ongoing_fee_pct": 0.8,
                "benchmark": "Unknown",
                "three_year_excess_vs_benchmark_pct": None,
                "value_sek": value,
                "notes": "Förenklad profil från kontonamn/balans; komplettera med fondfakta för full analys.",
            }
        )
    return holdings


def snapshot_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False)
