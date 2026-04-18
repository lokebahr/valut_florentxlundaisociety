import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { Shell } from '../components/Shell'

/** One OAuth exchange per code even if React Strict Mode mounts twice. */
const signInByCode = new Map<string, Promise<{ token: string }>>()
const completedCodes = new Set<string>()

export function BankCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setToken } = useAuth()
  const [status, setStatus] = useState('Skapar konto och hämtar bankdata…')

  useEffect(() => {
    const code = params.get('code')
    const credentialsId = params.get('credentials_id')
    if (!code) {
      setStatus('Saknar kod från Tink. Försök igen.')
      return
    }
    const dedupeKey = `${credentialsId ?? ''}::${code}`
    if (completedCodes.has(dedupeKey)) return
    let run = signInByCode.get(dedupeKey)
    if (!run) {
      run = api<{ token: string }>('/api/auth/tink', {
        method: 'POST',
        body: { code, credentials_id: credentialsId },
      }).finally(() => signInByCode.delete(dedupeKey))
      signInByCode.set(dedupeKey, run)
    }
    run
      .then((res) => {
        completedCodes.add(dedupeKey)
        setToken(res.token)
        navigate('/onboarding?tink=connected')
      })
      .catch((e) => setStatus(e instanceof Error ? e.message : 'Tink-inloggningen misslyckades.'))
  }, [params, navigate, setToken])

  return (
    <Shell>
      <div className="page narrow">
        <div className="surface step-animate">
          <h1>Tink</h1>
          <p className="muted">
            {status}
            {!status.includes('Saknar') && !status.includes('misslyckades') && (
              <span className="loading-dots" aria-hidden>
                <span />
                <span />
                <span />
              </span>
            )}
          </p>
        </div>
      </div>
    </Shell>
  )
}
