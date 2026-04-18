from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class FundFact(SQLModel, table=True):
    __tablename__ = "fund_facts"

    isin: str = Field(primary_key=True)
    name: str
    fund_name: Optional[str] = None
    asset_manager: Optional[str] = None
    domicile: Optional[str] = None
    base_currency: Optional[str] = None
    sfdr_classification: Optional[str] = None
    benchmark: Optional[str] = None
    investment_goal: Optional[str] = None
    risk_indicator: Optional[int] = None
    recommended_holding_period_years: Optional[int] = None
    ongoing_fee_pct: Optional[float] = None
    transaction_cost_pct: Optional[float] = None
    entry_cost_pct: Optional[float] = None
    exit_cost_pct: Optional[float] = None
    equity_share: Optional[float] = None
    bond_share: Optional[float] = None
    is_actively_managed: Optional[bool] = None
    esg: Optional[bool] = None
    factsheet_date: Optional[str] = None
    geographic_focus: Optional[str] = None
    registration_country: Optional[str] = None  # full country name from ISIN prefix
    fund_type: Optional[str] = None  # "equity" | "bond" | "mixed"
    # Type-specific fields stored as JSON
    type_specific_json: Optional[str] = None
    # Stored as JSON string
    performance_scenarios_json: Optional[str] = None
    raw_json: Optional[str] = None
    parsed_at: datetime = Field(default_factory=datetime.utcnow)
