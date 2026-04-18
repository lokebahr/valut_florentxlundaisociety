import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Shell } from '../components/Shell'

/** One token exchange per code/state even if React Strict Mode mounts twice. */
const completeByKey = new Map<string, Promise<{ ok: boolean }>>()
const completedKeys = new Set<string>()

export function MontroseCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('Slutför Montrose-inloggning…')

  useEffect(() => {
    const code = params.get('code')
    const state = params.get('state')
    if (!code || !state) {
      setStatus('Saknar code eller state från Montrose. Försök igen.')
      return
    }
    const key = `${state}::${code}`
    if (completedKeys.has(key)) return
    let run = completeByKey.get(key)
    if (!run) {
      run = api<{ ok: boolean }>('/api/montrose/complete', {
        method: 'POST',
        body: { code, state },
      }).finally(() => completeByKey.delete(key))
      completeByKey.set(key, run)
    }
    run
      .then(() => {
        completedKeys.add(key)
        navigate('/dashboard?montrose=connected')
      })
      .catch((e) => setStatus(e instanceof Error ? e.message : 'Montrose misslyckades.'))
  }, [params, navigate])

  return (
    <Shell>
      <div className="page narrow">
        <div className="surface step-animate">
          <h1>Montrose</h1>
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
