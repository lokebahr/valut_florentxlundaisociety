type Props = {
  current: number
  total: number
  label: string
}

export function StepProgress({ current, total, label }: Props) {
  const pct = Math.min(100, Math.round(((current + 1) / total) * 100))
  return (
    <div className="step-progress" aria-live="polite">
      <div className="step-progress__meta">
        <span className="step-progress__step">
          Steg {current + 1} av {total}
        </span>
        <span className="step-progress__name">{label}</span>
      </div>
      <div className="step-progress__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="step-progress__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
