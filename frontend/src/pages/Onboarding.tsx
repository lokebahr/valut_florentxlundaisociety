import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { HeroImage } from '../components/HeroImage'
import { Shell } from '../components/Shell'
import { StepProgress } from '../components/StepProgress'
import { imageAlt, images } from '../content/images'

const STEP_LABELS = [
  'Riskvilja',
  'Sparhorisont',
  'Sparmål',
  'Din ekonomi',
  'Bankkoppling',
  'Buffert',
  'Innehav',
  'Justera plan',
  'Byt fond',
  'Klart',
] as const

const TOTAL_STEPS = STEP_LABELS.length

const RISK_OPTIONS = [
  { level: 1 as const, name: 'Trygg', tagline: 'Bevara kapital' },
  { level: 2 as const, name: 'Försiktig', tagline: 'Stabil tillväxt' },
  { level: 3 as const, name: 'Balanserad', tagline: 'Mix aktier & räntor' },
  { level: 4 as const, name: 'Tillväxt', tagline: 'Aktievikt' },
  { level: 5 as const, name: 'Offensiv', tagline: 'Max aktier' },
]

// Pre-computed SVG polyline points for a 580×265 viewBox.
// Plot area x=[50,540], y=[15,235]. Value range 50–300 (100=start/0%).
// Good scenario = steady compounding. Bad scenario = crash yr 2, slow recovery.
const CHART_DATA = {
  1: {
    goodPoints: '50,191 99,187 148,183 197,179 246,175 295,171 344,166 393,162 442,157 491,152 540,143',
    badPoints:  '50,191 99,190 148,197 197,195 246,193 295,191 344,188 393,186 442,183 491,181 540,178',
    goodEndY: 143, badEndY: 178,
    goodEnd: '+55%', badEnd: '+15%', maxDip: '−7%',
  },
  2: {
    goodPoints: '50,191 99,186 148,181 197,176 246,170 295,164 344,158 393,151 442,144 491,136 540,128',
    badPoints:  '50,191 99,189 148,203 197,201 246,199 295,197 344,195 393,192 442,190 491,187 540,185',
    goodEndY: 128, badEndY: 185,
    goodEnd: '+71%', badEnd: '+8%', maxDip: '−13%',
  },
  3: {
    goodPoints: '50,191 99,185 148,178 197,171 246,164 295,155 344,147 393,138 442,128 491,117 540,106',
    badPoints:  '50,191 99,188 148,208 197,207 246,205 295,203 344,201 393,199 442,198 491,196 540,194',
    goodEndY: 106, badEndY: 194,
    goodEnd: '+97%', badEnd: '−2%', maxDip: '−20%',
  },
  4: {
    goodPoints: '50,191 99,183 148,174 197,165 246,155 295,144 344,131 393,118 442,104 491,88 540,71',
    badPoints:  '50,191 99,187 148,214 197,212 246,210 295,209 344,207 393,205 442,203 491,201 540,199',
    goodEndY: 71, badEndY: 199,
    goodEnd: '+137%', badEnd: '−10%', maxDip: '−27%',
  },
  5: {
    goodPoints: '50,191 99,181 148,170 197,159 246,145 295,131 344,114 393,96 442,76 491,54 540,29',
    badPoints:  '50,191 99,185 148,222 197,221 246,219 295,217 344,215 393,213 442,211 491,209 540,207',
    goodEndY: 29, badEndY: 207,
    goodEnd: '+184%', badEnd: '−18%', maxDip: '−36%',
  },
} as const

const SAVINGS_PURPOSES = [
  { value: 'pension', label: 'Pension', desc: 'Lång sikt' },
  { value: 'bostad', label: 'Bostad', desc: 'Bostadsköp' },
  { value: 'buffert', label: 'Buffert', desc: 'Trygghetskudde' },
  { value: 'barn', label: 'Barn', desc: 'Barnens framtid' },
  { value: 'annat', label: 'Annat', desc: 'Eget mål' },
]

const HORIZON_OPTIONS = [
  { years: 3, label: '3 år', category: 'Kortfristig', hint: 'Kapitalskydd prioriteras, aktier begränsas' },
  { years: 5, label: '5 år', category: 'Medelfristig', hint: 'Balanserad mix med försiktig aktieexponering' },
  { years: 10, label: '10 år', category: 'Långsiktig', hint: 'God tillväxtpotential med måttlig risk' },
  { years: 15, label: '15 år', category: 'Långsiktig', hint: 'Aktievikt rekommenderas för god avkastning' },
  { years: 25, label: '25 år', category: 'Mycket långsiktig', hint: 'Pensionssparande med hög aktieandel' },
  { years: 40, label: '40 år', category: 'Generationslång', hint: 'Arv eller generationssparande, max tillväxt' },
]

function targetEquity(risk: number, horizon: number): number {
  const base = 0.35 + (risk - 1) * 0.1
  const adj = horizon < 3 ? base - 0.15 : horizon > 15 ? base + 0.1 : base
  return Math.max(0.15, Math.min(0.95, adj))
}

type ProfileData = { name: string; desc: string; equityPct: number }

function computeProfile(risk: number, horizon: number): ProfileData {
  const equityPct = Math.round(targetEquity(risk, horizon) * 100)
  if (risk <= 1.5) return { name: 'Kapitalbevarare', desc: 'Fokus på kapitalskydd med minimal volatilitet.', equityPct }
  if (risk <= 2.5) return { name: 'Defensiv', desc: 'Stabil tillväxt med begränsad kursrisk.', equityPct }
  if (risk <= 3.5)
    return { name: 'Balanserad', desc: 'Klassisk mix av aktier och räntor för måttlig avkastning.', equityPct }
  if (risk <= 4.5) return { name: 'Tillväxt', desc: 'Tydlig aktievikt för god avkastning över tid.', equityPct }
  return { name: 'Offensiv Tillväxt', desc: 'Maximal aktieexponering för högsta förväntade avkastning.', equityPct }
}

const CHART_GRID = [
  { y: 15,  label: '+200%', isStart: false },
  { y: 103, label: '+100%', isStart: false },
  { y: 147, label:  '+50%', isStart: false },
  { y: 191, label:    '0%', isStart: true  },
  { y: 213, label:  '−25%', isStart: false },
  { y: 235, label:  '−50%', isStart: false },
] as const

// ── Animation helpers ──────────────────────────────────────────────────────
function parsePts(s: string): [number, number][] {
  return s.trim().split(' ').map((p) => p.split(',').map(Number) as [number, number])
}
function ptsToStr(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(' ')
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function easeOut(t: number) { return 1 - (1 - t) ** 3 }
const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function PortfolioChart({ riskLevel }: { riskLevel: number }) {
  const target = CHART_DATA[riskLevel as keyof typeof CHART_DATA]
  const font = 'DM Sans, system-ui, sans-serif'

  const [goodPts, setGoodPts] = useState(() => parsePts(target.goodPoints))
  const [badPts,  setBadPts]  = useState(() => parsePts(target.badPoints))
  const [goodEndY, setGoodEndY] = useState(target.goodEndY)
  const [badEndY,  setBadEndY]  = useState(target.badEndY)

  // Refs track the *current* animated position so mid-flight interruptions are smooth
  const curGood   = useRef(parsePts(target.goodPoints))
  const curBad    = useRef(parsePts(target.badPoints))
  const curGoodEY = useRef(target.goodEndY)
  const curBadEY  = useRef(target.badEndY)
  const rafRef    = useRef<number | null>(null)

  useEffect(() => {
    const toGood   = parsePts(target.goodPoints)
    const toBad    = parsePts(target.badPoints)
    const fromGood = curGood.current
    const fromBad  = curBad.current
    const fromGEY  = curGoodEY.current
    const fromBEY  = curBadEY.current

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)

    if (reducedMotion) {
      setGoodPts(toGood); setBadPts(toBad)
      setGoodEndY(target.goodEndY); setBadEndY(target.badEndY)
      curGood.current = toGood; curBad.current = toBad
      curGoodEY.current = target.goodEndY; curBadEY.current = target.badEndY
      return
    }

    const DURATION = 520
    const t0 = performance.now()

    function tick(now: number) {
      const raw = Math.min((now - t0) / DURATION, 1)
      const t   = easeOut(raw)

      const ng = fromGood.map(([fx, fy], i) => [lerp(fx, toGood[i][0], t), lerp(fy, toGood[i][1], t)] as [number, number])
      const nb = fromBad.map( ([fx, fy], i) => [lerp(fx, toBad[i][0],  t), lerp(fy, toBad[i][1],  t)] as [number, number])
      const nge = lerp(fromGEY, target.goodEndY, t)
      const nbe = lerp(fromBEY, target.badEndY,  t)

      setGoodPts(ng); setBadPts(nb)
      setGoodEndY(nge); setBadEndY(nbe)
      curGood.current = ng; curBad.current = nb
      curGoodEY.current = nge; curBadEY.current = nbe

      if (raw < 1) rafRef.current = requestAnimationFrame(tick)
      else rafRef.current = null
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [riskLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  const goodStr  = ptsToStr(goodPts)
  const badStr   = ptsToStr(badPts)
  const goodArea = `${goodStr} 540,235 50,235`
  const badArea  = `${badStr} 540,235 50,235`

  return (
    <div className="portfolio-chart">
      <svg viewBox="0 0 580 265" className="portfolio-chart__svg" aria-label="Scenariojämförelse">
        <defs>
          <clipPath id="pcClip">
            <rect x="50" y="15" width="490" height="220" />
          </clipPath>
        </defs>

        <rect x="50" y="15" width="490" height="220" fill="#f8f7f4" rx="3" />

        {CHART_GRID.map(({ y, label, isStart }) => (
          <g key={y}>
            <line
              x1="50" y1={y} x2="540" y2={y}
              stroke={isStart ? '#b0bbc8' : '#e4e0d8'}
              strokeWidth={isStart ? 1.5 : 1}
              strokeDasharray={isStart ? '5 4' : undefined}
            />
            <text x="44" y={y + 4} textAnchor="end" fontSize="10" fill="#8a9aaa" fontFamily={font}>
              {label}
            </text>
          </g>
        ))}

        {([0, 2, 4, 6, 8, 10] as const).map((yr) => (
          <text key={yr} x={50 + (yr / 10) * 490} y="253" textAnchor="middle" fontSize="10" fill="#8a9aaa" fontFamily={font}>
            {yr}
          </text>
        ))}
        <text x="295" y="265" textAnchor="middle" fontSize="9" fill="#aab5c2" fontFamily={font}>År</text>

        <g clipPath="url(#pcClip)">
          <polygon points={goodArea} fill="#2a4d42" fillOpacity="0.07" />
          <polygon points={badArea}  fill="#c0392b" fillOpacity="0.05" />
        </g>

        <polyline points={badStr}  fill="none" stroke="#d95555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={goodStr} fill="none" stroke="#2a4d42" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        <circle cx="540" cy={goodEndY} r="4.5" fill="#2a4d42" />
        <circle cx="540" cy={badEndY}  r="4.5" fill="#d95555" />

        <text x="548" y={goodEndY + 4} fontSize="10.5" fontWeight="600" fill="#2a4d42" fontFamily={font}>{target.goodEnd}</text>
        <text x="548" y={badEndY  + 4} fontSize="10.5" fontWeight="600" fill="#d95555" fontFamily={font}>{target.badEnd}</text>
      </svg>

      <div className="portfolio-chart__legend">
        <span className="portfolio-chart__legend-item">
          <span className="portfolio-chart__legend-dot portfolio-chart__legend-dot--good" />
          Bra scenario
        </span>
        <span className="portfolio-chart__legend-item">
          <span className="portfolio-chart__legend-dot portfolio-chart__legend-dot--bad" />
          Utmanande scenario
        </span>
      </div>

      <div key={riskLevel} className="portfolio-chart__stats step-animate">
        <div className="portfolio-chart__stat portfolio-chart__stat--good">
          <span className="portfolio-chart__stat-label">Bra scenario (10 år)</span>
          <span className="portfolio-chart__stat-value">{target.goodEnd}</span>
        </div>
        <div className="portfolio-chart__stat portfolio-chart__stat--bad">
          <span className="portfolio-chart__stat-label">Utmanande scenario (10 år)</span>
          <span className="portfolio-chart__stat-value">{target.badEnd}</span>
        </div>
        <div className="portfolio-chart__stat">
          <span className="portfolio-chart__stat-label">Djupaste dipp</span>
          <span className="portfolio-chart__stat-value portfolio-chart__stat-value--dip">{target.maxDip}</span>
        </div>
      </div>
    </div>
  )
}

function ProfileCard({ profile, horizon, purpose }: { profile: ProfileData; horizon: number; purpose: string }) {
  const purposeLabel = SAVINGS_PURPOSES.find((p) => p.value === purpose)?.label ?? purpose
  return (
    <div className="profile-preview">
      <p className="profile-preview__label">Din investeringsprofil</p>
      <p className="profile-preview__name">{profile.name}</p>
      <p className="profile-preview__desc">{profile.desc}</p>
      <div className="profile-preview__metrics">
        <div className="profile-preview__metric">
          <div className="profile-preview__metric-label">Aktieandel</div>
          <div className="profile-preview__metric-value">{profile.equityPct}%</div>
        </div>
        <div className="profile-preview__metric">
          <div className="profile-preview__metric-label">Räntor / Stabila</div>
          <div className="profile-preview__metric-value">{100 - profile.equityPct}%</div>
        </div>
        <div className="profile-preview__metric">
          <div className="profile-preview__metric-label">Sparhorisont</div>
          <div className="profile-preview__metric-value">{horizon} år</div>
        </div>
        <div className="profile-preview__metric">
          <div className="profile-preview__metric-label">Mål</div>
          <div className="profile-preview__metric-value">{purposeLabel}</div>
        </div>
      </div>
    </div>
  )
}

type TinkLinkInfo = { mode: 'mock' | 'tink'; url?: string; message?: string; redirect_uri?: string }

type ConnectPayload = {
  buffer: Record<string, unknown>
  holdings: Record<string, unknown>[]
  analysis: Record<string, unknown>
  buffer_accounts?: { id?: string; name: string; liquid_sek: number }[]
}

type SnapshotResponse = ConnectPayload & {
  accounts?: unknown
  tink_debug?: Record<string, unknown>
  tink_oauth_token?: unknown
  tink_transactions?: unknown
  tink_transactions_error?: string
  credentials_id?: string
}

export function Onboarding() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const [step, setStep] = useState(0)
  const [riskTolerance, setRiskTolerance] = useState(3)
  const [timeHorizonYears, setTimeHorizonYears] = useState(10)
  const [savingsPurpose, setSavingsPurpose] = useState('pension')
  const [dependentsCount, setDependentsCount] = useState(0)
  const [salaryMonthlySek, setSalaryMonthlySek] = useState(45_000)
  const [age, setAge] = useState(35)
  const [disposableIncomeMonthlySek, setDisposableIncomeMonthlySek] = useState(8_000)
  const [expensiveLoans, setExpensiveLoans] = useState(false)
  const [adjustedRisk, setAdjustedRisk] = useState<number | null>(null)
  const [monthlyContributionSek, setMonthlyContributionSek] = useState<number | null>(null)
  const [tinkInfo, setTinkInfo] = useState<TinkLinkInfo | null>(null)
  const [connectData, setConnectData] = useState<ConnectPayload | null>(null)
  const [orderFrom, setOrderFrom] = useState('Nordea Global Climate Impact')
  const [orderTo, setOrderTo] = useState('Länsförsäkringar Global Indexnära')
  const [orderAmount, setOrderAmount] = useState(50_000)
  const [error, setError] = useState<string | null>(null)
  const [tinkDebug, setTinkDebug] = useState<unknown>(null)

  useEffect(() => {
    if (search.get('tink') !== 'connected') return
    ;(async () => {
      try {
        const snap = await api<SnapshotResponse>('/api/tink/snapshot')
        setConnectData({
          buffer: snap.buffer as ConnectPayload['buffer'],
          holdings: snap.holdings as ConnectPayload['holdings'],
          analysis: snap.analysis as ConnectPayload['analysis'],
          buffer_accounts: snap.buffer_accounts,
        })
        const hasServerTinkDump =
          (snap.tink_debug != null && typeof snap.tink_debug === 'object') ||
          snap.tink_oauth_token != null ||
          snap.tink_transactions != null ||
          snap.tink_transactions_error != null
        const fromServer = hasServerTinkDump
          ? snap.tink_debug != null && typeof snap.tink_debug === 'object'
            ? {
                ...snap.tink_debug,
                accounts: snap.accounts,
                _source: 'server_snapshot',
              }
            : {
                tink_oauth_token: snap.tink_oauth_token,
                accounts: snap.accounts,
                tink_transactions: snap.tink_transactions,
                ...(snap.tink_transactions_error != null
                  ? { tink_transactions_error: snap.tink_transactions_error }
                  : {}),
                ...(snap.credentials_id != null && snap.credentials_id !== ''
                  ? { credentials_id: snap.credentials_id }
                  : {}),
                _source: 'server_snapshot',
              }
          : null
        setTinkDebug(
          fromServer ?? {
            _note:
              'Ingen sparad Tink-debug i denna snapshot (äldre koppling eller tom Tink-respons). Visar endast sparade konton.',
            accounts: snap.accounts,
          },
        )
        setStep(5)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunde inte läsa bankdata.')
      }
    })()
  }, [search])

  useEffect(() => {
    api<TinkLinkInfo>('/api/tink/link')
      .then(setTinkInfo)
      .catch((e) => setError(e instanceof Error ? e.message : 'Kunde inte hämta Tink-länk.'))
  }, [])

  const baseProfile = useMemo(() => computeProfile(riskTolerance, timeHorizonYears), [riskTolerance, timeHorizonYears])
  const adjustedProfile = useMemo(
    () => computeProfile(adjustedRisk ?? riskTolerance, timeHorizonYears),
    [adjustedRisk, riskTolerance, timeHorizonYears],
  )

  const profilePayload = useMemo(
    () => ({
      risk_tolerance: riskTolerance,
      time_horizon_years: timeHorizonYears,
      savings_purpose: savingsPurpose,
      dependents_count: dependentsCount,
      salary_monthly_sek: salaryMonthlySek,
      age,
      disposable_income_monthly_sek: disposableIncomeMonthlySek,
      expensive_loans: expensiveLoans,
      adjusted_risk_tolerance: adjustedRisk,
      monthly_contribution_sek: monthlyContributionSek,
      current_step: step,
    }),
    [
      age,
      dependentsCount,
      disposableIncomeMonthlySek,
      expensiveLoans,
      monthlyContributionSek,
      adjustedRisk,
      riskTolerance,
      salaryMonthlySek,
      savingsPurpose,
      step,
      timeHorizonYears,
    ],
  )

  async function persistProfile(extra?: Record<string, unknown>) {
    await api('/api/onboarding/profile', {
      method: 'PUT',
      body: { ...profilePayload, ...extra },
    })
  }

  async function next() {
    setError(null)
    try {
      await persistProfile()
      setStep((s) => s + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte spara.')
    }
  }

  async function connectMock() {
    setError(null)
    try {
      await persistProfile()
      const res = await api<ConnectPayload>('/api/tink/connect-mock', { method: 'POST' })
      setConnectData(res)
      setStep(5)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anslutningen misslyckades.')
    }
  }

  async function finishOnboarding(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await persistProfile({ onboarding_completed: true, current_step: step })
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte slutföra.')
    }
  }

  async function submitOrder(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api('/api/dashboard/orders', {
        method: 'POST',
        body: { from_name: orderFrom, to_name: orderTo, amount_sek: orderAmount },
      })
      setStep(9)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ordern kunde inte läggas.')
    }
  }

  return (
    <Shell>
      <div className="page page--wide">
        <div className="stack" style={{ marginBottom: '1.5rem' }}>
          <Link to="/dashboard" className="muted small">
            Till översikt
          </Link>
          <StepProgress current={step} total={TOTAL_STEPS} label={STEP_LABELS[step] ?? ''} />
        </div>

        {error && (
          <p className="error step-animate" role="alert">
            {error}
          </p>
        )}

        {/* Step 0 — Risk */}
        {step === 0 && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Hur mycket risk är du bekväm med?</h2>
              <p className="muted">
                Välj en strategi nedan — diagrammet uppdateras direkt och visar hur 100 kr kan växa eller sjunka
                under ett bra respektive ett utmanande marknadsläge över 10 år.
              </p>
            </div>
            <div className="risk-selector">
              {RISK_OPTIONS.map((opt) => (
                <button
                  key={opt.level}
                  type="button"
                  className={`risk-selector-card${riskTolerance === opt.level ? ' risk-selector-card--selected' : ''}`}
                  onClick={() => setRiskTolerance(opt.level)}
                >
                  <span className="risk-selector-card__num">{opt.level}</span>
                  <span className="risk-selector-card__name">{opt.name}</span>
                  <span className="risk-selector-card__tagline">{opt.tagline}</span>
                </button>
              ))}
            </div>
            <PortfolioChart riskLevel={riskTolerance} />
            <button type="button" className="btn-primary" onClick={next}>
              Nästa
            </button>
          </section>
        )}

        {/* Step 1 — Horizon */}
        {step === 1 && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Hur länge vill du spara?</h2>
              <p className="muted">
                Tidshorisonten styr hur mycket risk du kan ta. Längre tid ger mer utrymme för aktier och högre
                förväntad avkastning.
              </p>
            </div>
            <div className="horizon-options">
              {HORIZON_OPTIONS.map((opt) => (
                <button
                  key={opt.years}
                  type="button"
                  className={`horizon-option${timeHorizonYears === opt.years ? ' horizon-option--selected' : ''}`}
                  onClick={() => setTimeHorizonYears(opt.years)}
                >
                  <span className="horizon-option__years">{opt.label}</span>
                  <span className="horizon-option__category">{opt.category}</span>
                  <span className="horizon-option__hint">{opt.hint}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn-primary" onClick={next}>
              Nästa
            </button>
          </section>
        )}

        {/* Step 2 — Savings purpose */}
        {step === 2 && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Vad sparar du till?</h2>
              <p className="muted">
                Syftet påverkar hur vi tolkar din profil och vilka rekommendationer vi ger.
              </p>
            </div>
            <div className="purpose-cards">
              {SAVINGS_PURPOSES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`purpose-card${savingsPurpose === p.value ? ' purpose-card--selected' : ''}`}
                  onClick={() => setSavingsPurpose(p.value)}
                >
                  <span className="purpose-card__label">{p.label}</span>
                  <span className="purpose-card__desc">{p.desc}</span>
                </button>
              ))}
            </div>
            <label>
              Antal försörjningsberoende
              <input
                type="number"
                min={0}
                value={dependentsCount}
                onChange={(e) => setDependentsCount(Number(e.target.value))}
              />
              <span className="field-hint">Partner, barn eller andra du försörjer ekonomiskt</span>
            </label>
            <ProfileCard profile={baseProfile} horizon={timeHorizonYears} purpose={savingsPurpose} />
            <button type="button" className="btn-primary" onClick={next}>
              Nästa
            </button>
          </section>
        )}

        {/* Step 3 — Finances */}
        {step === 3 && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Din ekonomi</h2>
              <p className="muted">
                Siffrorna hjälper oss beräkna ett realistiskt buffertmål och hur mycket du kan spara varje månad.
              </p>
            </div>
            <label>
              Ålder
              <input type="number" min={18} max={100} value={age} onChange={(e) => setAge(Number(e.target.value))} />
              <span className="field-hint">Påverkar hur lång aktiv sparhorisont du har kvar till pension</span>
            </label>
            <label>
              Bruttolön per månad (kr)
              <input
                type="number"
                min={0}
                value={salaryMonthlySek}
                onChange={(e) => setSalaryMonthlySek(Number(e.target.value))}
              />
              <span className="field-hint">Används för att bedöma skatteeffekter och totalt sparutrymme</span>
            </label>
            <label>
              Kvar efter vanlig månad (kr)
              <input
                type="number"
                min={0}
                value={disposableIncomeMonthlySek}
                onChange={(e) => setDisposableIncomeMonthlySek(Number(e.target.value))}
              />
              <span className="field-hint">
                Det du har kvar när räkningar och levnadskostnader är betalda — din sparpotential
              </span>
            </label>
            <label className="row" style={{ alignItems: 'flex-start', gap: '0.65rem' }}>
              <input
                type="checkbox"
                checked={expensiveLoans}
                onChange={(e) => setExpensiveLoans(e.target.checked)}
                style={{ marginTop: '0.25rem' }}
              />
              <span>
                Jag har dyra lån (kreditkort eller konsumtionslån med hög ränta)
                <span className="field-hint" style={{ display: 'block', marginTop: '0.2rem' }}>
                  Dessa bör prioriteras och amorteras ned innan nytt sparande ökas
                </span>
              </span>
            </label>
            <button type="button" className="btn-primary" onClick={next}>
              Nästa
            </button>
          </section>
        )}

        {/* Step 4 — Bank connection */}
        {step === 4 && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Bankkoppling</h2>
              <p className="muted">
                Vi läser konton via öppen bankkoppling. Med riktiga nycklar kan du testa Tinks testmiljö med demobank.
                Lokalt kan du använda demonstrationsdata som liknar svenska konton och fonder.
              </p>
            </div>
            {tinkInfo?.mode === 'mock' && (
              <div className="callout stack stack--tight">
                <p className="small">
                  Appen körs i demoläge. Klicka nedan för att hämta demonstrationsdata med svenska fondinnehav.
                </p>
                <button type="button" className="btn-primary" onClick={connectMock}>
                  Använd demonstrationsdata
                </button>
              </div>
            )}
            {tinkInfo?.mode === 'tink' && tinkInfo.url && (
              <div className="callout stack stack--tight">
                <p className="small">
                  Öppna bankkopplingen i ett nytt fönster, logga in med demobanken och kom sedan tillbaka hit.
                </p>
                <a className="btn-link" href={tinkInfo.url}>
                  Öppna Tink
                </a>
                {tinkInfo.redirect_uri && (
                  <p className="muted small">Återhoppsadress: {tinkInfo.redirect_uri}</p>
                )}
              </div>
            )}
            <button type="button" className="btn-ghost" onClick={next}>
              Hoppa över
            </button>
          </section>
        )}

        {/* Step 5 — Buffer */}
        {step === 5 && connectData && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Buffert</h2>
              <p className="muted">En likvid buffert minskar risken att behöva sälja placerat kapital i otid.</p>
            </div>
            {tinkDebug != null && (
              <details className="callout stack stack--tight">
                <summary className="small" style={{ cursor: 'pointer' }}>
                  Rådata från Tink (JSON)
                </summary>
                <p className="muted small" style={{ marginBottom: 0 }}>
                  OAuth-svar visar kortade token-värden. Konton och transaktioner är oförändrade svar från Tinks API.
                </p>
                <pre
                  className="small"
                  style={{
                    overflow: 'auto',
                    maxHeight: 'min(70vh, 36rem)',
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    background: 'var(--color-surface-elevated, #f4f4f5)',
                    borderRadius: '8px',
                  }}
                >
                  {JSON.stringify(tinkDebug, null, 2)}
                </pre>
              </details>
            )}
            <p>
              Mål: cirka{' '}
              {(connectData.buffer as { target_buffer_sek?: number }).target_buffer_sek?.toLocaleString('sv-SE')} kronor
              ·{' '}
              {(connectData.buffer as { meets_target?: boolean }).meets_target ? 'du når målet' : 'under målet'}.
            </p>
            <ul className="plain muted small">
              {connectData.buffer_accounts?.map((b) => (
                <li key={b.name}>
                  {b.name}: {b.liquid_sek.toLocaleString('sv-SE')} kr
                </li>
              ))}
            </ul>
            <button type="button" className="btn-primary" onClick={() => setStep(6)}>
              Nästa
            </button>
          </section>
        )}

        {/* Step 6 — Holdings */}
        {step === 6 && connectData && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Dina innehav</h2>
              <p className="muted">Här är en förenklad analys utifrån dina konton.</p>
            </div>
            <div className="holdings">
              {connectData.holdings.map((h) => (
                <article key={String(h.id)} className="holding">
                  <h3>{String(h.name)}</h3>
                  <p className="muted small">{String(h.notes || '')}</p>
                  <p className="small">
                    Värde: {Number(h.value_sek).toLocaleString('sv-SE')} kr · Avgift: {String(h.ongoing_fee_pct)} % ·
                    Domicil: {String(h.domicile)} · Konto: {String(h.vehicle)}
                  </p>
                </article>
              ))}
            </div>
            <h3 className="muted" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.95rem', fontWeight: 600 }}>
              Viktigt att veta
            </h3>
            <ul className="issues">
              {((connectData.analysis as { issues?: { title: string; body: string }[] }).issues || []).map((i) => (
                <li key={i.title}>
                  <strong>{i.title}</strong>
                  <div className="muted small" style={{ marginTop: '0.35rem' }}>
                    {i.body}
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-primary" onClick={() => setStep(7)}>
              Nästa
            </button>
          </section>
        )}

        {/* Step 7 — Adjust plan */}
        {step === 7 && connectData && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Justera plan</h2>
              <p className="muted">Din nuvarande profil visas nedan. Justera risknivån om din situation har ändrats.</p>
            </div>

            <ProfileCard profile={baseProfile} horizon={timeHorizonYears} purpose={savingsPurpose} />

            <div className="stack stack--tight">
              <p className="field-label">Justera risk (valfritt)</p>
              <div className="risk-selector">
                {RISK_OPTIONS.map((opt) => (
                  <button
                    key={opt.level}
                    type="button"
                    className={`risk-selector-card${(adjustedRisk ?? riskTolerance) === opt.level ? ' risk-selector-card--selected' : ''}`}
                    onClick={() => setAdjustedRisk(opt.level === riskTolerance ? null : opt.level)}
                  >
                    <span className="risk-selector-card__num">{opt.level}</span>
                    <span className="risk-selector-card__name">{opt.name}</span>
                    <span className="risk-selector-card__tagline">{opt.tagline}</span>
                  </button>
                ))}
              </div>
              <PortfolioChart riskLevel={adjustedRisk ?? riskTolerance} />
              {adjustedRisk !== null && adjustedRisk !== riskTolerance && (
                <ProfileCard profile={adjustedProfile} horizon={timeHorizonYears} purpose={savingsPurpose} />
              )}
            </div>

            <label>
              Extra månadssparande (kr)
              <input
                type="number"
                min={0}
                value={monthlyContributionSek ?? ''}
                placeholder="Valfritt"
                onChange={(e) => setMonthlyContributionSek(e.target.value ? Number(e.target.value) : null)}
              />
              <span className="field-hint">Läggs till ditt befintliga sparande varje månad</span>
            </label>

            <div>
              <p className="field-label">Föreslagna fonder</p>
              <ul className="plain">
                {(
                  (connectData.analysis as { suggested_funds?: { name: string; rationale: string }[] })
                    .suggested_funds || []
                ).map((s) => (
                  <li key={s.name} style={{ marginBottom: '0.5rem' }}>
                    <strong>{s.name}</strong>
                    <div className="muted small">{s.rationale}</div>
                  </li>
                ))}
              </ul>
            </div>

            <button type="button" className="btn-primary" onClick={next}>
              Gå vidare till order
            </button>
          </section>
        )}

        {/* Step 8 — Fund swap */}
        {step === 8 && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Byt fond (övning)</h2>
              <p className="muted">Detta är en intern övning. För riktiga byten använder du din bank eller rådgivare.</p>
            </div>
            <form className="stack stack--tight" onSubmit={submitOrder}>
              <label>
                Från fond
                <input value={orderFrom} onChange={(e) => setOrderFrom(e.target.value)} />
              </label>
              <label>
                Till fond
                <input value={orderTo} onChange={(e) => setOrderTo(e.target.value)} />
              </label>
              <label>
                Belopp (kronor)
                <input
                  type="number"
                  min={1000}
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(Number(e.target.value))}
                />
              </label>
              <button type="submit" className="btn-primary">
                Lägg order (övning)
              </button>
            </form>
          </section>
        )}

        {/* Step 9 — Done */}
        {step === 9 && (
          <section key={step} className="surface step-animate stack">
            <HeroImage className="hero-image--compact" src={images.forestLight} alt={imageAlt.forestLight} />
            <div>
              <h2>Du är redo</h2>
              <p className="muted">
                Din profil och ett snapshot av portföljen är sparade. På översikten följer vi avstämning över tid.
              </p>
            </div>
            <form onSubmit={finishOnboarding}>
              <button type="submit" className="btn-primary">
                Öppna översikt
              </button>
            </form>
          </section>
        )}
      </div>
    </Shell>
  )
}
