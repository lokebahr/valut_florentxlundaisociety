# Fund Parser

Microservice that parses Swedish/EU fund factsheets (Faktablad / KID) from PDF into structured JSON using Claude, and stores the results in a local SQLite database.

## How it works

1. Upload a PDF factsheet
2. The ISIN is extracted from the filename instantly — if already in the database, the stored data is returned immediately (no Claude call)
3. If not cached, Claude reads the PDF and extracts structured fields based on the fund type (equity, bond, or mixed)
4. The result is stored in `funds.db` for all future requests

## Setup

```bash
cd fund-parser
cp .env.example .env       # add your ANTHROPIC_API_KEY
conda activate valut
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
```

## Test interface

Open in your browser:

```
http://localhost:8000
```

Drag and drop a PDF factsheet to parse it. Use the **Load funds from DB** button on the right to browse all stored funds grouped by type.

## API

Base URL: `http://localhost:8000`

### `POST /funds/parse`
Upload a PDF factsheet. Returns parsed fund data. If the ISIN is already in the database the response is instant.

```bash
curl -X POST http://localhost:8000/funds/parse \
  -F "file=@ISIN_LU0058908533_sv_SE_last.pdf"
```

Response:
```json
{
  "cached": false,
  "fund": {
    "isin": "LU0058908533",
    "name": "JPM India A (dist) - USD",
    "fund_type": "equity",
    "domicile": "LU",
    "registration_country": "Luxembourg",
    "base_currency": "USD",
    "ongoing_fee_pct": 1.80,
    "risk_indicator": 4,
    "benchmark": "MSCI India 10/40 Index (Total Return Net)",
    "sfdr_classification": "Article 8",
    "esg": true,
    "is_actively_managed": true,
    "equity_share": 1.0,
    "bond_share": 0.0,
    "type_specific": {
      "sector_focus": "Diversified",
      "market_cap": "all",
      "geographic_focus": "India",
      "currency_hedged": false
    },
    "performance_scenarios": { ... },
    ...
  }
}
```

### `GET /funds/`
List all stored funds.

```bash
curl http://localhost:8000/funds/
```

### `GET /funds/{isin}`
Fetch a single fund by ISIN.

```bash
curl http://localhost:8000/funds/LU0058908533
```

### `GET /health`
```bash
curl http://localhost:8000/health
# {"status": "ok"}
```

## Fund types and extracted fields

| Field | Equity | Bond | Mixed |
|---|---|---|---|
| Sector focus | ✓ | | |
| Market cap | ✓ | | |
| Number of holdings | ✓ | | |
| Top countries | ✓ | | |
| Bond type | | ✓ | |
| Avg duration | | ✓ | |
| Credit quality | | ✓ | |
| Yield to maturity | | ✓ | |
| Target equity % | | | ✓ |
| Target bond % | | | ✓ |
| Rebalancing strategy | | | ✓ |

All types also include: ISIN, name, asset manager, domicile, registration country, currency, SFDR classification, benchmark, investment goal, risk indicator (1–7), holding period, all cost figures, and performance scenarios.
