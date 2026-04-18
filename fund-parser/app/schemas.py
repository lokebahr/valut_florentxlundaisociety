from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class PerformanceScenarios(BaseModel):
    stress_1y_pct: Optional[float] = None
    stress_5y_ann_pct: Optional[float] = None
    unfavorable_1y_pct: Optional[float] = None
    unfavorable_5y_ann_pct: Optional[float] = None
    moderate_1y_pct: Optional[float] = None
    moderate_5y_ann_pct: Optional[float] = None
    favorable_1y_pct: Optional[float] = None
    favorable_5y_ann_pct: Optional[float] = None


class EquityDetails(BaseModel):
    sector_focus: Optional[str] = None
    market_cap: Optional[str] = None        # large / mid / small / all
    num_holdings: Optional[int] = None
    currency_hedged: Optional[bool] = None
    top_countries: Optional[list[str]] = None


class BondDetails(BaseModel):
    bond_type: Optional[str] = None         # government / corporate / high-yield / investment-grade / mixed
    avg_duration_years: Optional[float] = None
    credit_quality: Optional[str] = None    # investment-grade / high-yield / mixed
    yield_to_maturity_pct: Optional[float] = None
    currency_hedged: Optional[bool] = None


class MixedDetails(BaseModel):
    target_equity_pct: Optional[float] = None
    target_bond_pct: Optional[float] = None
    rebalancing_strategy: Optional[str] = None
    risk_profile: Optional[str] = None      # conservative / balanced / growth


class FundFactOut(BaseModel):
    isin: str
    name: str
    fund_name: Optional[str]
    asset_manager: Optional[str]
    domicile: Optional[str]
    base_currency: Optional[str]
    sfdr_classification: Optional[str]
    benchmark: Optional[str]
    investment_goal: Optional[str]
    risk_indicator: Optional[int]
    recommended_holding_period_years: Optional[int]
    ongoing_fee_pct: Optional[float]
    transaction_cost_pct: Optional[float]
    entry_cost_pct: Optional[float]
    exit_cost_pct: Optional[float]
    equity_share: Optional[float]
    bond_share: Optional[float]
    is_actively_managed: Optional[bool]
    esg: Optional[bool]
    factsheet_date: Optional[str]
    geographic_focus: Optional[str]
    registration_country: Optional[str]
    fund_type: Optional[str]
    type_specific: Optional[dict[str, Any]] = None
    performance_scenarios: Optional[PerformanceScenarios]
    parsed_at: datetime
    cached: bool = False

    model_config = {"from_attributes": True}


class ParseResponse(BaseModel):
    fund: FundFactOut
    cached: bool
