import { HeroImage } from './HeroImage'
import { OverviewReengageBanner } from './OverviewReengageBanner'
import { SavingsGoalPanel } from './SavingsGoalPanel'
import { imageAlt, images } from '../content/images'
import type { Overview } from '../types/dashboard'

/** Illustrativ årlig avkastning före avgift (demo — ingen prognos). */
const ILLUSTRATIVE_GROSS_RETURN = 0.045
/** Snittavgift för rekommenderad tvåfondsportfölj i experimentet (LF). */
const RECOMMENDED_BLEND_FEE_PCT = 0.19

const CONFETTI_COLORS = ['#2a4d42', '#4a6fa5', '#e8a838', '#c0392b', '#6b9e90', '#4a7c6c']

function weightedAvgFeePct(holdings: Record<string, unknown>[]): number {
  let t = 0
  let w = 0
  for (const h of holdings) {
    const v = Number(h.value_sek) || 0
    const f = Number(h.ongoing_fee_pct) || 0
    if (v <= 0) continue
    t += v * f
    w += v
  }
  return w > 0 ? t / w : RECOMMENDED_BLEND_FEE_PCT
}

function totalValueSek(holdings: Record<string, unknown>[]): number {
  return holdings.reduce((s, h) => s + (Number(h.value_sek) || 0), 0)
}

function buildFeeProjection(totalStart: number, feeCurrentPct: number, feeTargetPct: number) {
  const years = 11
  const pts: { year: number; withCurrentFees: number; withLowFees: number }[] = []
  let hi = totalStart
  let lo = totalStart
  const dragC = feeCurrentPct / 100
  const dragT = feeTargetPct / 100
  for (let y = 0; y < years; y++) {
    pts.push({ year: y, withCurrentFees: hi, withLowFees: lo })
    hi *= 1 + ILLUSTRATIVE_GROSS_RETURN - dragC
    lo *= 1 + ILLUSTRATIVE_GROSS_RETURN - dragT
  }
  return pts
}

function formatFeePct(pct: number): string {
  return `${pct.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`
}

/** Skillnad i portföljvärde efter sista simulerade året (år 10), lägre avgift minus högre. */
function projectedMoreValueAfter10YearsSek(totalStart: number, feeCurrent: number, feeTarget: number): number {
  const data = buildFeeProjection(Math.max(totalStart, 1), feeCurrent, feeTarget)
  const last = data[data.length - 1]
  return Math.round(last.withLowFees - last.withCurrentFees)
}

function FeeCompareFigures({
  totalSek,
  feeCurrent,
  feeTarget,
}: {
  totalSek: number
  feeCurrent: number
  feeTarget: number
}) {
  const advantageSek = projectedMoreValueAfter10YearsSek(totalSek, feeCurrent, feeTarget)
  const worseChoice = feeCurrent > feeTarget + 0.005

  return (
    <div className="overview-fee-figures">
      <div className="overview-fee-figures__grid">
        <div className="overview-fee-figures__col overview-fee-figures__col--fees">
          <p className="overview-fee-figures__label">Snittavgift i din portfölj</p>
          <p className={`overview-fee-figures__fee-big ${worseChoice ? 'overview-fee-figures__fee-big--warn' : ''}`}>{formatFeePct(feeCurrent)}</p>
          <p className="overview-fee-figures__target muted small">
            Våra rekommenderade fonder: <span className="overview-fee-figures__target-num">{formatFeePct(feeTarget)}</span>
          </p>
        </div>
        <div className="overview-fee-figures__col overview-fee-figures__col--save">
          <p className="overview-fee-figures__save-label">Om du byter till våra fonder</p>
          <p className="overview-fee-figures__save-amount" aria-live="polite">
            ca {advantageSek.toLocaleString('sv-SE')} kr mer värde efter 10 år
          </p>
          <p className="overview-fee-figures__save-note muted small">Illustration: samma antagen avkastning som i demo-modellen — skillnaden beror på avgiften.</p>
        </div>
      </div>
    </div>
  )
}

function OverviewCelebration() {
  return (
    <div className="overview-celebration">
      <div className="overview-confetti" aria-hidden>
        {Array.from({ length: 32 }, (_, i) => (
          <span
            key={i}
            className="overview-confetti__piece"
            style={{
              left: `${(i * 3.1) % 96}%`,
              animationDelay: `${i * 0.05}s`,
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            }}
          />
        ))}
      </div>
      <p className="overview-celebration__emoji" aria-hidden>
        🎉 Grattis! 😊
      </p>
      <h2 className="overview-celebration__title">Bra beslut</h2>
      <p className="overview-celebration__text">
        Du har valt en fördelning som står i linje med beprövad portföljteori: bred riskjustering (Markowitz), tydlig aktie-
        respektive räntedel utifrån din horisont (Merton), och fokus på låga avgifter — något forskningen konsekvent pekar på
        som viktigt för nettoresultatet över tid.
      </p>
      <p className="muted small overview-celebration__foot">Fortsätt gärna det lugna, långsiktiga sparandet.</p>
    </div>
  )
}

function fundCard(h: Record<string, unknown>, variant: 'current' | 'target', keySuffix: string) {
  const name = String(h.name ?? 'Fond')
  const v = Number(h.value_sek) || 0
  const fee = Number(h.ongoing_fee_pct)
  const feeStr = Number.isFinite(fee) ? `${fee} %` : '—'
  return (
    <div key={`${name}-${variant}-${keySuffix}`} className={`overview-fund overview-fund--${variant}`}>
      <div className="overview-fund__name">{name}</div>
      <div className="overview-fund__meta muted small">
        {v > 0 ? `${v.toLocaleString('sv-SE')} kr` : 'Målfond'} · avgift ca {feeStr}
      </div>
    </div>
  )
}

function motivationForSwitch(
  holdingName: string,
  issues: { title?: string; body?: string }[],
): string {
  const n = holdingName.toLowerCase()
  for (const i of issues) {
    const body = (i.body || '').toLowerCase()
    if (body.includes(n.slice(0, 12)) || (i.title || '').toLowerCase().includes('avgift')) {
      const t = (i.title || '').trim()
      if (t) return t + ' — se analysen för detaljer.'
    }
  }
  const feeIssue = issues.find((i) => (i.title || '').includes('avgift'))
  if (feeIssue) return `${feeIssue.title}. Indexnära fonder med lägre avgift behåller mer av avkastningen över tid.`
  return 'Byt mot vår enkla målbild sänker kostnader och förenklar risken till aktier + kort ränta enligt din profil.'
}

export type DashboardOverviewProps = {
  data: Overview
  showMontrosePrepare: boolean
  montroseBuyPlan: Overview['montrose_buy_plan']
  montroseConnected: boolean
  montroseBusy: boolean
  montroseConnectBusy: boolean
  montroseError: string | null
  montroseConnectError: string | null
  montroseHint: string | null
  canMontrose: boolean
  onMontroseConnect: () => void
  onMontrosePrepare: () => void
}

export function DashboardOverview({
  data,
  showMontrosePrepare,
  montroseBuyPlan,
  montroseConnected,
  montroseBusy,
  montroseConnectBusy,
  montroseError,
  montroseConnectError,
  montroseHint,
  canMontrose,
  onMontroseConnect,
  onMontrosePrepare,
}: DashboardOverviewProps) {
  const holdings = data.holdings || []
  const analysis = data.analysis as {
    issues?: { title?: string; body?: string }[]
    suggested_funds?: { name: string; rationale: string; target_weight?: number }[]
    profile_targets?: { target_equity_share?: number }
  }
  const issues = analysis.issues || []
  const suggested = analysis.suggested_funds || []
  const feeW = weightedAvgFeePct(holdings)
  const total = totalValueSek(holdings)
  const followsAdvice = !showMontrosePrepare

  const aiRecs = data.recommendations?.recommendations ?? null
  const recommendedPreview: { name: string; value_sek: number; ongoing_fee_pct: number }[] =
    aiRecs?.length
      ? aiRecs.map((r) => ({
          name: r.name,
          value_sek: Math.round((r.suggested_weight_pct / 100) * total),
          ongoing_fee_pct: r.ongoing_fee_pct ?? 0,
        }))
      : montroseBuyPlan?.buy_lines?.map((line) => ({
          name: line.target_fund_name,
          value_sek: line.amount_sek,
          ongoing_fee_pct: line.target_fund_name.toLowerCase().includes('ränte') ? 0.10 : 0.19,
        })) ??
        suggested.map((s) => ({
          name: s.name,
          value_sek: Math.round((s.target_weight ?? 0) * total),
          ongoing_fee_pct: s.name.toLowerCase().includes('ränte') ? 0.10 : 0.19,
        }))

  const bentoClass = followsAdvice ? 'overview-bento overview-bento--aligned' : 'overview-bento overview-bento--drift'

  return (
    <div className="overview-simple step-animate">
      <div className="overview-hero">
        <div className="overview-hero__main">
          <div className={bentoClass}>
            <div className="overview-bento__cell overview-bento__cell--head overview-bento__cell--span-2">
              <h1 className="overview-simple__h1">Din ekonomi</h1>
              <p className="muted small overview-bento__stamp">Portfölj uppdaterad {new Date(data.snapshot_at).toLocaleString('sv-SE')}</p>
            </div>

            {followsAdvice && (
              <div className="overview-bento__cell overview-bento__cell--span-2 overview-bento__cell--flush">
                <OverviewCelebration />
              </div>
            )}

            {showMontrosePrepare && (
              <div className="overview-bento__cell overview-bento__cell--span-2 overview-bento__cell--action">
                <section className="overview-switch overview-switch--bento">
                  <h2 className="overview-bento__tile-title">Genomför bytet</h2>
                  <p className="muted small overview-bento__lede">
                    Vi förbereder köp utifrån din profil. Du slutför i <strong>din banks</strong> fondhandel.
                  </p>
                  {!montroseConnected && (
                    <div className="overview-bento__actions">
                      <button type="button" className="btn-primary overview-bento__btn-full" disabled={montroseConnectBusy} onClick={onMontroseConnect}>
                        {montroseConnectBusy ? 'Ansluter till din bank…' : 'Anslut din bank'}
                      </button>
                      {montroseConnectError && (
                        <p className="error small" role="alert">
                          {montroseConnectError}
                        </p>
                      )}
                    </div>
                  )}
                  {montroseConnected && montroseBuyPlan && (
                    <div className="overview-bento__actions">
                      <p className="small">
                        Köp totalt <strong>{montroseBuyPlan.amount_sek.toLocaleString('sv-SE')} kr</strong> · målprofil{' '}
                        {Math.round(montroseBuyPlan.target_equity_share * 100)}&nbsp;% aktier.
                      </p>
                      <button type="button" className="btn-primary overview-bento__btn-full" disabled={!canMontrose || montroseBusy} onClick={onMontrosePrepare}>
                        {montroseBusy ? 'Öppnar din bank…' : 'Byt till den här fördelningen'}
                      </button>
                    </div>
                  )}
                  {montroseConnected && !montroseBuyPlan && <p className="muted small">Inga köp att förbereda utifrån aktuell data.</p>}
                  {montroseHint && (
                    <p className="muted small" role="status">
                      {montroseHint}
                    </p>
                  )}
                  {montroseError && (
                    <p className="error small" role="alert">
                      {montroseError}
                    </p>
                  )}
                </section>
              </div>
            )}

            {followsAdvice && (
              <div className="overview-bento__cell overview-bento__cell--span-2 overview-bento__cell--funds-block">
                <h2 className="overview-bento__tile-title">Dina fonder</h2>
                <div className="overview-fund-grid overview-fund-grid--bento">{holdings.map((h, i) => fundCard(h, 'current', String(h.id ?? i)))}</div>
              </div>
            )}

            {followsAdvice && (
              <div className="overview-bento__cell overview-bento__cell--span-2 overview-bento__cell--goals">
                <SavingsGoalPanel
                  holdings={holdings}
                  monthlySek={data.profile.monthly_contribution_sek ?? null}
                  layout="bento"
                />
              </div>
            )}

            {!followsAdvice && (
              <>
                <div className="overview-bento__cell overview-bento__cell--funds-block">
                  <h3 className="overview-bento__tile-title overview-bento__tile-title--sub">Idag</h3>
                  <div className="overview-fund-grid overview-fund-grid--bento">{holdings.map((h, i) => fundCard(h, 'current', String(h.id ?? i)))}</div>
                </div>
                <div className="overview-bento__cell overview-bento__cell--funds-block">
                  <h3 className="overview-bento__tile-title overview-bento__tile-title--sub">Rekommenderat</h3>
                  <div className="overview-fund-grid overview-fund-grid--bento">{recommendedPreview.map((h, i) => fundCard(h, 'target', `t-${i}`))}</div>
                </div>
                <div className="overview-bento__cell overview-bento__cell--span-2 overview-bento__cell--fee-figures">
                  <FeeCompareFigures
                    totalSek={total}
                    feeCurrent={feeW}
                    feeTarget={
                      aiRecs?.length
                        ? aiRecs.reduce((s, r) => s + (r.ongoing_fee_pct ?? 0) * (r.suggested_weight_pct / 100), 0)
                        : RECOMMENDED_BLEND_FEE_PCT
                    }
                  />
                </div>
                <div className="overview-bento__cell overview-bento__cell--span-2 overview-bento__cell--advice">
                  <section className="overview-advice overview-advice--bento">
                    <h2 className="overview-bento__tile-title">Vår rådgivning</h2>
                    <p className="overview-advice__lead overview-advice__lead--bento">Byt från utvalda innehav till målbilden:</p>
                    <ul className="overview-switch-list overview-switch-list--bento">
                      {(montroseBuyPlan?.source_holdings?.length
                        ? montroseBuyPlan.source_holdings
                        : holdings.map((h) => ({ name: String(h.name), value_sek: Number(h.value_sek) || 0 }))
                      ).map((row, i) => (
                        <li key={`${row.name}-${i}`}>
                          <strong>{row.name}</strong>
                          <span className="muted"> ({row.value_sek.toLocaleString('sv-SE')} kr)</span>
                          <p className="small muted overview-switch-list__why">{motivationForSwitch(row.name, issues)}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="overview-hero__visual">
          <HeroImage className="overview-hero__img" src={images.forestLight} alt={imageAlt.forestLight} />
          <p className="muted small overview-hero__caption">Långsiktigt sparande handlar om enkelhet och tålamod.</p>
        </aside>
      </div>
      <OverviewReengageBanner />
    </div>
  )
}
