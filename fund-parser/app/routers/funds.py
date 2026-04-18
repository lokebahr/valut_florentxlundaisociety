from __future__ import annotations

import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlmodel import Session, select

from app.countries import isin_to_country
from app.database import get_session
from app.isin import extract_isin
from app.models import FundFact
from app.parser import parse_pdf
from app.schemas import FundFactOut, ParseResponse, PerformanceScenarios

router = APIRouter(prefix="/funds", tags=["funds"])


def _db_to_out(fund: FundFact, cached: bool = False) -> FundFactOut:
    scenarios = None
    if fund.performance_scenarios_json:
        try:
            scenarios = PerformanceScenarios(**json.loads(fund.performance_scenarios_json))
        except Exception:
            pass
    type_specific = None
    if fund.type_specific_json:
        try:
            type_specific = json.loads(fund.type_specific_json)
        except Exception:
            pass
    skip = {"performance_scenarios_json", "raw_json", "type_specific_json"}
    return FundFactOut(
        **{k: v for k, v in fund.model_dump().items() if k not in skip},
        performance_scenarios=scenarios,
        type_specific=type_specific,
        cached=cached,
    )


@router.post("/parse", response_model=ParseResponse)
async def parse_fund(file: UploadFile, session: Session = Depends(get_session)):
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    pdf_bytes = await file.read()

    # Fast path: extract ISIN from filename before calling Claude
    isin = extract_isin(file.filename or "")
    if isin:
        existing = session.get(FundFact, isin)
        if existing:
            return ParseResponse(fund=_db_to_out(existing, cached=True), cached=True)

    # Cache miss — call Claude for full parse
    parsed = parse_pdf(pdf_bytes)

    isin = parsed.get("isin") or isin
    if not isin:
        raise HTTPException(status_code=422, detail="Could not extract ISIN from document.")

    # Check again in case regex missed it but Claude found it
    existing = session.get(FundFact, isin)
    if existing:
        return ParseResponse(fund=_db_to_out(existing, cached=True), cached=True)

    # Build and store new record
    performance = parsed.pop("performance_scenarios", None)
    type_specific = parsed.pop("type_specific", None)
    fund = FundFact(
        **{k: v for k, v in parsed.items() if hasattr(FundFact, k)},
        registration_country=isin_to_country(isin),
        performance_scenarios_json=json.dumps(performance) if performance else None,
        type_specific_json=json.dumps(type_specific) if type_specific else None,
        raw_json=json.dumps(parsed),
    )
    session.add(fund)
    session.commit()
    session.refresh(fund)

    return ParseResponse(fund=_db_to_out(fund, cached=False), cached=False)


@router.get("/", response_model=List[FundFactOut])
def list_funds(session: Session = Depends(get_session)):
    funds = session.exec(select(FundFact)).all()
    return [_db_to_out(f) for f in funds]


@router.get("/{isin}", response_model=FundFactOut)
def get_fund(isin: str, session: Session = Depends(get_session)):
    fund = session.get(FundFact, isin)
    if not fund:
        raise HTTPException(status_code=404, detail=f"Fund {isin} not found.")
    return _db_to_out(fund)
