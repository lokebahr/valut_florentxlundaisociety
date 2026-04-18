import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { HeroImage } from '../components/HeroImage'
import { Shell } from '../components/Shell'
import { StepProgress } from '../components/StepProgress'
import { imageAlt, images } from '../content/images'

const STEP_LABELS = [
  'Mål och risk',
  'Din ekonomi',
  'Bankkoppling',
  'Buffert',
  'Innehav',
  'Justera plan',
  'Byt fond',
  'Klart',
] as const

const TOTAL_STEPS = STEP_LABELS.length

type TinkLinkInfo = { url: string; redirect_uri: string }

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
        setStep(3)
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
      setStep(7)
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

        {step === 0 && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Mål och risk</h2>
              <p className="muted">Här fångar vi hur du tänker kring risk och tid.</p>
            </div>
            <label>
              Riskvilja (1 = mycket försiktig, 5 = högre risk)
              <div className="row" style={{ gap: '1rem' }}>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={riskTolerance}
                  onChange={(e) => setRiskTolerance(Number(e.target.value))}
                />
                <span className="pill">{riskTolerance}</span>
              </div>
            </label>
            <label>
              Placeringshorisont (år)
              <input
                type="number"
                min={1}
                max={50}
                value={timeHorizonYears}
                onChange={(e) => setTimeHorizonYears(Number(e.target.value))}
              />
            </label>
            <label>
              Syfte med sparandet
              <select value={savingsPurpose} onChange={(e) => setSavingsPurpose(e.target.value)}>
                <option value="pension">Pension</option>
                <option value="bostad">Bostad</option>
                <option value="buffert">Buffert</option>
                <option value="barn">Barn</option>
                <option value="annat">Annat</option>
              </select>
            </label>
            <label>
              Antal försörjningsberoende
              <input
                type="number"
                min={0}
                value={dependentsCount}
                onChange={(e) => setDependentsCount(Number(e.target.value))}
              />
            </label>
            <button type="button" className="btn-primary" onClick={next}>
              Nästa
            </button>
          </section>
        )}

        {step === 1 && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Din ekonomi</h2>
              <p className="muted">Siffrorna används för att sätta rimliga buffertmål och sparutrymme.</p>
            </div>
            <label>
              Ålder
              <input type="number" min={18} max={100} value={age} onChange={(e) => setAge(Number(e.target.value))} />
            </label>
            <label>
              Bruttolön per månad (kronor)
              <input
                type="number"
                min={0}
                value={salaryMonthlySek}
                onChange={(e) => setSalaryMonthlySek(Number(e.target.value))}
              />
            </label>
            <label>
              Kvar efter vanlig månad (kronor)
              <input
                type="number"
                min={0}
                value={disposableIncomeMonthlySek}
                onChange={(e) => setDisposableIncomeMonthlySek(Number(e.target.value))}
              />
            </label>
            <label className="row" style={{ alignItems: 'flex-start', gap: '0.65rem' }}>
              <input
                type="checkbox"
                checked={expensiveLoans}
                onChange={(e) => setExpensiveLoans(e.target.checked)}
                style={{ marginTop: '0.25rem' }}
              />
              <span>Jag har dyra lån (till exempel kreditkort eller konsumtionslån med hög ränta)</span>
            </label>
            <button type="button" className="btn-primary" onClick={next}>
              Nästa
            </button>
          </section>
        )}

        {step === 2 && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Bankkoppling</h2>
              <p className="muted">
                Du loggade in med Tink på startsidan — då skapades ditt konto och vi hämtade dina konton. Vill du uppdatera
                kopplingen öppnar du Tink igen.
              </p>
            </div>
            {tinkInfo && (
              <div className="callout stack stack--tight">
                <a className="btn-link" href={tinkInfo.url} target="_blank" rel="noreferrer">
                  Öppna Tink igen
                </a>
                <p className="muted small">Återhoppsadress: {tinkInfo.redirect_uri}</p>
              </div>
            )}
            <button type="button" className="btn-primary" onClick={next}>
              Nästa
            </button>
          </section>
        )}

        {step === 3 && connectData && (
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
              {(connectData.buffer as { target_buffer_sek?: number }).target_buffer_sek?.toLocaleString('sv-SE')} kronor ·{' '}
              {(connectData.buffer as { meets_target?: boolean }).meets_target ? 'du når målet' : 'under målet'}.
            </p>
            <ul className="plain muted small">
              {connectData.buffer_accounts?.map((b) => (
                <li key={b.name}>
                  {b.name}: {b.liquid_sek.toLocaleString('sv-SE')} kr
                </li>
              ))}
            </ul>
            <button type="button" className="btn-primary" onClick={() => setStep(4)}>
              Nästa
            </button>
          </section>
        )}

        {step === 4 && connectData && (
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
                    Värde: {Number(h.value_sek).toLocaleString('sv-SE')} kr · Avgift: {String(h.ongoing_fee_pct)} % ·{' '}
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
            <button type="button" className="btn-primary" onClick={() => setStep(5)}>
              Nästa
            </button>
          </section>
        )}

        {step === 5 && connectData && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Justera plan</h2>
              <p className="muted">Du kan justera risk och sparbelopp om din vardag ändrats.</p>
            </div>
            <label>
              Justerad risk (valfritt)
              <input
                type="number"
                min={1}
                max={5}
                value={adjustedRisk ?? ''}
                placeholder="Lämna tom för samma som tidigare"
                onChange={(e) => setAdjustedRisk(e.target.value ? Number(e.target.value) : null)}
              />
            </label>
            <label>
              Extra månadssparande (kronor)
              <input
                type="number"
                min={0}
                value={monthlyContributionSek ?? ''}
                placeholder="Valfritt"
                onChange={(e) => setMonthlyContributionSek(e.target.value ? Number(e.target.value) : null)}
              />
            </label>
            <h3 className="muted" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.95rem', fontWeight: 600 }}>
              Förslag
            </h3>
            <ul className="plain">
              {(
                (connectData.analysis as { suggested_funds?: { name: string; rationale: string }[] }).suggested_funds || []
              ).map((s) => (
                <li key={s.name} style={{ marginBottom: '0.5rem' }}>
                  <strong>{s.name}</strong>
                  <div className="muted small">{s.rationale}</div>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-primary" onClick={() => setStep(6)}>
              Gå vidare till order
            </button>
          </section>
        )}

        {step === 6 && (
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
                <input type="number" min={1000} value={orderAmount} onChange={(e) => setOrderAmount(Number(e.target.value))} />
              </label>
              <button type="submit" className="btn-primary">
                Lägg order (övning)
              </button>
            </form>
          </section>
        )}

        {step === 7 && (
          <section key={step} className="surface step-animate stack">
            <HeroImage className="hero-image--compact" src={images.forestLight} alt={imageAlt.forestLight} />
            <div>
              <h2>Du är redo</h2>
              <p className="muted">Din profil och ett snapshot av portföljen är sparade. På översikten följer vi avstämning över tid.</p>
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
