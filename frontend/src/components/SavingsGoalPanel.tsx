import { useEffect, useRef, useState } from 'react'

export type GoalType = 'house' | 'car' | 'travel' | 'education' | 'retirement'

export type SavedGoal = { type: GoalType; targetSek: number }

const GOALS: Record<GoalType, { label: string; svg: React.ReactNode }> = {
  house: {
    label: 'Bostad',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5L12 3l9 7.5V21H15v-6H9v6H3V10.5z" />
      </svg>
    ),
  },
  car: {
    label: 'Bil',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l2-5h10l2 5" />
        <rect x="2" y="12" width="20" height="6" rx="2" />
        <circle cx="7" cy="19" r="1.5" />
        <circle cx="17" cy="19" r="1.5" />
      </svg>
    ),
  },
  travel: {
    label: 'Resa',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.5L14 12V5a2 2 0 00-4 0v7L2 16.5l.5 1.5 7.5-2V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-3l7.5 2 1.5-1.5z" />
      </svg>
    ),
  },
  education: {
    label: 'Utbildning',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3L2 8l10 5 10-5-10-5z" />
        <path d="M2 8v7" />
        <path d="M6 10.5v5.5a6 6 0 0012 0v-5.5" />
      </svg>
    ),
  },
  retirement: {
    label: 'Pension',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
}

type Props = {
  holdings: Record<string, unknown>[]
  monthlySek: number | null
  layout: 'page' | 'bento'
}

export function SavingsGoalPanel({ holdings, monthlySek, layout }: Props) {
  const [goal, setGoal] = useState<SavedGoal | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('valut_goal') || 'null')
    } catch {
      return null
    }
  })
  const [picking, setPicking] = useState(!goal)
  const [selectedType, setSelectedType] = useState<GoalType>(goal?.type ?? 'house')
  const [targetInput, setTargetInput] = useState(goal ? String(goal.targetSek) : '')
  const fillRef = useRef<HTMLDivElement>(null)

  const totalValue = holdings.reduce((sum, h) => sum + Number(h.value_sek || 0), 0)
  const pct = goal && goal.targetSek > 0 ? Math.min((totalValue / goal.targetSek) * 100, 100) : 0
  const reached = pct >= 100

  useEffect(() => {
    const el = fillRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.style.width = `${pct}%`
    })
  }, [pct])

  function saveGoal() {
    const t = Number(targetInput.replace(/\s/g, '').replace(',', '.'))
    if (!t || t <= 0) return
    const saved: SavedGoal = { type: selectedType, targetSek: t }
    localStorage.setItem('valut_goal', JSON.stringify(saved))
    setGoal(saved)
    setPicking(false)
  }

  const def = GOALS[goal?.type ?? selectedType]
  const bento = layout === 'bento'

  if (picking) {
    const pickInner = (
      <>
        {bento ? (
          <>
            <h2 className="overview-bento__tile-title">Sätt ett sparmål</h2>
            <p className="muted small overview-goal__lede">Välj vad du sparar mot — vi visar hur nära du är med din nuvarande portfölj.</p>
          </>
        ) : (
          <>
            <h1 style={{ margin: '0 0 0.35rem' }}>Välj ditt mål</h1>
            <p className="muted small">Vad sparar du mot? Vi visar hur nära du är.</p>
          </>
        )}
        <div className={`goal-picker${bento ? ' goal-picker--bento' : ''}`}>
          {(Object.keys(GOALS) as GoalType[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`goal-option${selectedType === k ? ' goal-option--selected' : ''}${bento ? ' goal-option--bento' : ''}`}
              onClick={() => setSelectedType(k)}
            >
              {GOALS[k].svg}
              {GOALS[k].label}
            </button>
          ))}
        </div>
        <div className={`goal-setup-row${bento ? ' goal-setup-row--bento' : ''}`}>
          <label className="goal-setup-label">
            Målbelopp (kr)
            <input
              type="number"
              min="1000"
              step="10000"
              placeholder="t.ex. 3 000 000"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="goal-setup-input"
            />
          </label>
          <button type="button" className="btn-primary" disabled={!targetInput || Number(targetInput) <= 0} onClick={saveGoal}>
            Spara mål
          </button>
        </div>
        {bento && goal && (
          <button type="button" className="btn-ghost overview-goal__cancel" onClick={() => setPicking(false)}>
            Avbryt
          </button>
        )}
      </>
    )
    if (bento) {
      return <div className="overview-goal overview-goal--pick">{pickInner}</div>
    }
    return pickInner
  }

  const progress = (
    <>
      <div className={`row${bento ? ' overview-goal__progress-head' : ''}`} style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          {bento ? (
            <>
              <h2 className="overview-bento__tile-title">Ditt sparmål</h2>
              <p className="muted small">
                <strong>{def.label}</strong> · {goal!.targetSek.toLocaleString('sv-SE')} kr
              </p>
            </>
          ) : (
            <>
              <h1 style={{ margin: '0 0 0.2rem' }}>Tracker</h1>
              <p className="muted small">
                Mål: <strong>{def.label}</strong> · {goal!.targetSek.toLocaleString('sv-SE')} kr
              </p>
            </>
          )}
        </div>
        <button type="button" className="btn-ghost" onClick={() => setPicking(true)}>
          Byt mål
        </button>
      </div>

      <div className={`goal-progress${bento ? ' goal-progress--bento' : ''}`}>
        <div className="goal-progress__pct-row">
          <span className="goal-progress__pct">{Math.floor(pct)} %</span>
          {reached && <span className="goal-progress__reached">Målet nått!</span>}
        </div>

        <div className="goal-progress__track-wrap">
          <div className="goal-progress__track">
            <div ref={fillRef} className={`goal-progress__fill${reached ? ' goal-progress__fill--done' : ''}`} style={{ width: '0%' }} />
            {[25, 50, 75].map((m) => (
              <div
                key={m}
                className={`goal-progress__milestone${pct >= m ? ' goal-progress__milestone--passed' : ''}`}
                style={{ left: `${m}%` }}
                title={`${m} %`}
              />
            ))}
          </div>
          <div className={`goal-progress__icon${reached ? ' goal-progress__icon--reached' : ''}`}>{def.svg}</div>
        </div>

        <div className="goal-progress__labels">
          <div>
            <div className="goal-progress__label-val">{totalValue.toLocaleString('sv-SE')} kr</div>
            <div className="goal-progress__label-sub muted small">Nuvarande portfölj</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="goal-progress__label-val">{goal!.targetSek.toLocaleString('sv-SE')} kr</div>
            <div className="goal-progress__label-sub muted small">{def.label}</div>
          </div>
        </div>

        {!reached &&
          (() => {
            const remaining = goal!.targetSek - totalValue
            if (monthlySek && monthlySek > 0 && remaining > 0) {
              const months = Math.ceil(remaining / monthlySek)
              const years = Math.floor(months / 12)
              const mo = months % 12
              const timeStr = years > 0 ? `${years} år${mo > 0 ? ` ${mo} mån` : ''}` : `${months} mån`
              return (
                <div className="goal-eta">
                  <span className="goal-eta__val">{timeStr}</span>
                  <span className="goal-eta__label muted small">kvar vid {monthlySek.toLocaleString('sv-SE')} kr/mån</span>
                  <span className="goal-eta__remaining muted small">{remaining.toLocaleString('sv-SE')} kr kvar</span>
                </div>
              )
            }
            return (
              <p className="muted small" style={{ marginTop: '0.75rem' }}>
                Sätt ett månadsspar under Profil för att se tid till målet.
              </p>
            )
          })()}
      </div>
    </>
  )

  if (bento) {
    return <div className="overview-goal overview-goal--active">{progress}</div>
  }

  return <>{progress}</>
}
