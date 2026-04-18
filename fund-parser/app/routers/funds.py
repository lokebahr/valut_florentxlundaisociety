from __future__ import annotations

import json
import re
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlmodel import Session, select

from app.config import settings
from app.countries import isin_to_country
from app.database import get_session
from app.isin import extract_isin
from app.models import FundFact
from app.parser import parse_pdf
from app.schemas import FundFactOut, ParseResponse, PerformanceScenarios

router = APIRouter(prefix="/funds", tags=["funds"])

_ISIN_PATH_RE = re.compile(r"^ISIN_([A-Z]{2}[A-Z0-9]{10})_", re.IGNORECASE)


def _resolve_factsheet_pdf(isin: str) -> Path | None:
    """Pick a factsheet file from ``FUNDS_PDF_DIR`` for this ISIN."""
    d = settings.FUNDS_PDF_DIR
    if not d.is_dir():
        return None
    exact = d / f"ISIN_{isin}_sv_SE_last.pdf"
    if exact.is_file():
        return exact
    matches = sorted(d.glob(f"ISIN_{isin}_*.pdf"))
    if matches:
        return matches[0]
    for p in d.glob("*.pdf"):
        m = _ISIN_PATH_RE.match(p.name)
        if m and m.group(1).upper() == isin:
            return p
    return None


def _commit_parsed_fund(session: Session, parsed: dict, isin: str) -> FundFact:
    data = dict(parsed)
    data["isin"] = isin
    performance = data.pop("performance_scenarios", None)
    type_specific = data.pop("type_specific", None)
    fund = FundFact(
        **{k: v for k, v in data.items() if hasattr(FundFact, k)},
        registration_country=isin_to_country(isin),
        performance_scenarios_json=json.dumps(performance) if performance else None,
        type_specific_json=json.dumps(type_specific) if type_specific else None,
        raw_json=json.dumps(data),
    )
    session.add(fund)
    session.commit()
    session.refresh(fund)
    return fund


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
    ct = (file.content_type or "").lower()
    fname = (file.filename or "").lower()
    if ct not in ("application/pdf", "application/octet-stream", "") and not fname.endswith(".pdf"):
        raise HTTPException(status_code=400, detail=f"Only PDF files are accepted (got content-type: {ct}).")

    pdf_bytes = await file.read()

    # Fast path: extract ISIN from filename before calling Claude
    raw_isin = extract_isin(file.filename or "")
    isin = raw_isin.upper() if raw_isin else None
    if isin:
        existing = session.get(FundFact, isin)
        if existing:
            return ParseResponse(fund=_db_to_out(existing, cached=True), cached=True)

    # Cache miss — call Claude for full parse
    parsed = parse_pdf(pdf_bytes)

    isin_final = (parsed.get("isin") or isin or "").strip().upper() or None
    if not isin_final:
        raise HTTPException(status_code=422, detail="Could not extract ISIN from document.")

    existing = session.get(FundFact, isin_final)
    if existing:
        return ParseResponse(fund=_db_to_out(existing, cached=True), cached=True)

    fund = _commit_parsed_fund(session, parsed, isin_final)
    return ParseResponse(fund=_db_to_out(fund, cached=False), cached=False)


@router.get("/", response_model=List[FundFactOut])
def list_funds(session: Session = Depends(get_session)):
    funds = session.exec(select(FundFact)).all()
    return [_db_to_out(f) for f in funds]


@router.get("/{isin}", response_model=FundFactOut)
def get_fund(isin: str, session: Session = Depends(get_session)):
    isin_key = isin.strip().upper()
    if len(isin_key) != 12 or not isin_key.isalnum():
        raise HTTPException(status_code=400, detail="Invalid ISIN.")

    fund = session.get(FundFact, isin_key)
    if fund:
        return _db_to_out(fund)

    pdf_path = _resolve_factsheet_pdf(isin_key)
    if not pdf_path:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No fund row or factsheet PDF for {isin_key}. "
                f"Add ``ISIN_{isin_key}_*.pdf`` under {settings.FUNDS_PDF_DIR}."
            ),
        )

    try:
        parsed = parse_pdf(pdf_path.read_bytes())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Factsheet parse failed: {e}") from e

    fund = session.get(FundFact, isin_key)
    if fund:
        return _db_to_out(fund)

    fund = _commit_parsed_fund(session, parsed, isin_key)
    return _db_to_out(fund, cached=False)
