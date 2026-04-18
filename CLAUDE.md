# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Valut is a Swedish investment portfolio analysis tool. Users connect their bank via Tink (open banking), answer a risk/goal questionnaire, and receive an investment profile with fund recommendations backed by academic citations. The default mode uses mock bank data so the app works fully offline.

## Commands

### Frontend (`frontend/`)
```bash
npm run dev        # dev server on :5173 (proxies /api → :5123)
npm run build      # tsc + vite build
npm run lint       # eslint
npm run preview    # preview production build
```

### Backend (`backend/`)
```bash
python run.py      # starts Flask on :5123 (or $PORT)
```

### Environment
Copy `.env.example` to `.env` in `backend/`. The only required key for local development is `SECRET_KEY`; everything else has safe defaults. `TINK_USE_MOCK=true` (the default) bypasses all real bank calls.

## Architecture

### Request flow
The Vite dev server proxies `/api/*` to the Flask backend. The `api<T>()` helper in `frontend/src/api.ts` is the single call-site — it attaches the JWT from `localStorage` (`valut_token`) and deserialises JSON. Auth context lives in `frontend/src/auth.tsx`.

On the backend, `app/api/deps.py::current_user()` decodes the JWT and returns the Peewee `User` model. All protected endpoints call this to get the current user.

### Data flow for portfolio analysis
1. User completes the onboarding questionnaire → `PUT /api/onboarding/profile` persists an `OnboardingProfile` row.
2. Bank connection: either `POST /api/tink/connect-mock` (mock) or Tink OAuth callback → `POST /api/tink/finalize`. Both paths call `normalize.py` and `portfolio_analysis.py`, then write a `PortfolioSnapshot` row with `raw_json` + `normalized_json`.
3. `POST /api/analysis/run` re-runs analysis against the latest snapshot, writing `RebalanceAlert` rows.
4. `GET /api/dashboard/overview` surfaces the snapshot + alerts to the frontend.

### Portfolio analysis engine (`backend/app/services/portfolio_analysis.py`)
- `_target_equity_share(risk, horizon)` — base formula is `0.35 + (risk-1)*0.1`, adjusted ±15%/+10% for short/long horizons, clamped 15–95%.
- `analyze_holdings()` flags: high fees (>0.6%), LU-domicile in ISK, underperformance vs. benchmark (<−1%/yr), allocation drift (>12% from target), home bias (>55%).
- Issues carry `severity` ("low"/"medium"/"high") and `citations` referencing Markowitz, Fama-French, etc.
- The frontend mirrors the same equity-share formula in `computeProfile()` in `Onboarding.tsx` so the live profile card stays in sync without an API call.

### Onboarding (9 steps)
Steps 1–2 collect the investor profile (risk cards, horizon, purpose, finances). Steps 3–6 connect the bank and surface analysis. Step 7 is a fund-swap exercise. All state is accumulated in React and flushed to the backend via `persistProfile()` on each `next()` call.

### Database
SQLite via Peewee ORM. Tables are created automatically on startup (`app/database.py`). There are no migration scripts — schema changes require dropping and recreating `valut.db`.

### Mock vs. real Tink
`TINK_USE_MOCK=true` causes `/api/tink/link` to return `{mode:"mock"}` and `/api/tink/connect-mock` to synthesise two mock ISK holdings (Europe Small Cap Class A-sek LU1916064857 + Franklin Sustainable Global Growth Fund LU0390134368) with realistic metadata. The real Tink path requires `TINK_CLIENT_ID` + `TINK_CLIENT_SECRET` and uses the Tink Link OAuth2 flow with a redirect to `/onboarding/bank-callback`.

### Styling
All CSS is hand-written in `frontend/src/index.css` — no utility framework. Design tokens live in `:root` (colors, radius, font families, shadows). The two font families are `DM Sans` (body) and `Fraunces` (display/headings). Add new component styles at the bottom of `index.css` following the existing pattern.
