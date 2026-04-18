"""Sandbox-style holdings when TINK_USE_MOCK=true or for demos."""

from __future__ import annotations

from typing import Any


def mock_tink_accounts_payload() -> dict[str, Any]:
    return {
        "accounts": [
            {
                "id": "acc-checking-1",
                "name": "Privatkonto",
                "type": "CHECKING",
                "balances": {
                    "booked": {"amount": {"currencyCode": "SEK", "value": {"scale": "2", "unscaledValue": "4250000"}}}
                },
            },
            {
                "id": "acc-savings-buffer",
                "name": "Buffertsparkonto",
                "type": "SAVINGS",
                "balances": {
                    "booked": {"amount": {"currencyCode": "SEK", "value": {"scale": "2", "unscaledValue": "9000000"}}}
                },
            },
            {
                "id": "acc-isk-1",
                "name": "ISK – Europe Small Cap Class A-sek",
                "type": "INVESTMENT",
                "balances": {
                    "booked": {"amount": {"currencyCode": "SEK", "value": {"scale": "2", "unscaledValue": "185000000"}}}
                },
            },
            {
                "id": "acc-isk-2",
                "name": "ISK – Franklin Sustainable Global Growth Fund",
                "type": "INVESTMENT",
                "balances": {
                    "booked": {"amount": {"currencyCode": "SEK", "value": {"scale": "2", "unscaledValue": "72000000"}}}
                },
            },
        ],
        "nextPageToken": None,
    }


def mock_normalized_holdings() -> list[dict[str, Any]]:
    return [
        {
            "id": "h1",
            "account_id": "acc-isk-1",
            "isin": "LU1916064857",
            "name": "Europe Small Cap Class A-sek",
            "vehicle": "ISK",
            "domicile": "LU",
            "equity_share": 0.97,
            "bond_share": 0.03,
            "global_diversification_score": 0.48,
            "home_bias_equity": 0.06,
            "ongoing_fee_pct": 1.72,
            "benchmark": "MSCI Europe Small Cap",
            "three_year_excess_vs_benchmark_pct": -0.6,
            "value_sek": 185_000,
            "notes": "Luxemburg-domicilerad fond i ISK: europeisk småbolagsprofil, högre avgift än indexnära globalfonder.",
        },
        {
            "id": "h2",
            "account_id": "acc-isk-2",
            "isin": "LU0390134368",
            "name": "Franklin Sustainable Global Growth Fund",
            "vehicle": "ISK",
            "domicile": "LU",
            "equity_share": 0.94,
            "bond_share": 0.06,
            "global_diversification_score": 0.74,
            "home_bias_equity": 0.12,
            "ongoing_fee_pct": 1.18,
            "benchmark": "MSCI World",
            "three_year_excess_vs_benchmark_pct": -0.4,
            "value_sek": 72_000,
            "notes": "Global hållbar tillväxtfond (LU); bredare marknad än enbart Sverige men aktiv förvaltning och högre avgift än passiv målbild.",
        },
    ]


def mock_buffer_accounts() -> list[dict[str, Any]]:
    return [
        {"id": "acc-checking-1", "name": "Privatkonto", "liquid_sek": 42_500},
        {"id": "acc-savings-buffer", "name": "Buffertsparkonto", "liquid_sek": 90_000},
    ]
