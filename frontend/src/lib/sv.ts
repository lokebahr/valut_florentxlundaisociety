/** Visningsetiketter — håller gränssnittet på svenska. */
export function severitySv(severity: string): string {
  const m: Record<string, string> = {
    high: 'Hög',
    medium: 'Medel',
    low: 'Låg',
  }
  return m[severity] ?? severity
}

export function savingsPurposeSv(purpose: string | null | undefined): string {
  const m: Record<string, string> = {
    pension: 'Pension',
    bostad: 'Bostad',
    buffert: 'Buffert',
    barn: 'Barn',
    annat: 'Annat',
  }
  if (!purpose) return '—'
  return m[purpose] ?? purpose
}
