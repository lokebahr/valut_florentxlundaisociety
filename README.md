# Valut

A Swedish investment portfolio analysis tool that connects to your bank, builds an investor profile through a guided onboarding, and delivers personalised fund recommendations backed by academic citations.

---

## Problem statement

According to an article by Finansinstituten, the majority of Swedish people invest their money incorrectly and not in a way that matches their actual goals. People choose funds that are misaligned with their savings horizon, risk tolerance, and financial situation, often without ever realising it.

This is a core reason why Valut should exist. Generic robo-advisors give one-size-fits-all advice, traditional banks lock recommendations behind expensive advisory meetings, and high fees silently erode returns over time. The gap between how people invest and how they should invest is large, well-documented, and largely unsolved for everyday Swedish investors.

## Solution

Valut closes that gap through a structured onboarding that:

1. Connects their bank account via open banking (Tink) to read existing holdings.
2. Measures risk tolerance through self-assessment and six behavioural market scenarios.
3. Collects savings horizon, goal, and financial context.
4. Runs a portfolio analysis engine that flags high fees, regulatory mismatches, underperformance, allocation drift, and home bias.
5. Delivers an AI-powered assessment (Claude) with specific fund-swap recommendations backed by academic citations.

A full demo mode using mock bank data means the app works entirely offline without any bank credentials.

## Technical approach

| Layer | Technology |
| --- | --- |
| Frontend | React 19 + TypeScript, Vite, hand-written CSS |
| Backend | Python / Flask, Peewee ORM, SQLite |
| Auth | JWT stored in localStorage, decoded on every protected endpoint |
| Open banking | Tink Link OAuth2; TINK_USE_MOCK=true (default) bypasses all real calls |
| AI analysis | Anthropic Claude — returns structured issues and fund recommendations |
| Fund data | Separate fund-parser FastAPI microservice that parses fund fact sheets |

**Request flow:** Vite dev server proxies `/api/*` to Flask on `:5123`. The `api<T>()` helper in `frontend/src/api.ts` is the single call-site for all API requests.

**Portfolio analysis** (`backend/app/services/portfolio_analysis.py`) flags issues with severity levels and attaches citations (Markowitz, Fama-French, etc.). The equity-share formula `0.35 + (risk−1) × 0.1` is mirrored in the frontend so the live profile card stays in sync without a round-trip.

**Database** is SQLite via Peewee. Tables are created automatically on startup — no migration scripts. Drop `valut.db` to reset.

## How to run

### Prerequisites

- Node.js 18+
- Python 3.11+

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python run.py
```

Edit `SECRET_KEY` in `.env` — that is the only required change for local development. `TINK_USE_MOCK=true` is on by default so no real bank credentials are needed.

To enable the AI portfolio assessment, add your Anthropic API key to `.env`:

```text
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on [http://localhost:5173](http://localhost:5173). The dev server proxies `/api` to the Flask backend automatically.

### 3. Fund parser

Required only for live fund fact-sheet data in the AI analysis:

```bash
cd fund-parser
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --port 8000
```

Then add `FUND_PARSER_URL=http://localhost:8000` to `backend/.env`.

### Frontend scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server with HMR on :5173 |
| `npm run build` | Type-check + production build |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |
