import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Shell } from '../components/Shell'

export function BankCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('Kopplar mot banken…')

  useEffect(() => {
    const code = params.get('code')
    const credentialsId = params.get('credentials_id')
    if (!code) {
      setStatus('Saknar kod från banken. Försök igen.')
      return
    }
    ;(async () => {
      try {
        await api('/api/tink/finalize', {
          method: 'POST',
          body: { code, credentials_id: credentialsId },
        })
        navigate('/onboarding?tink=connected')
      } catch (e) {
        setStatus(e instanceof Error ? e.message : 'Bankkopplingen kunde inte slutföras.')
      }
    })()
  }, [params, navigate])

  return (
    <Shell>
      <div className="page narrow">
        <div className="surface step-animate">
          <h1>Bank</h1>
          <p className="muted">
            {status}
            {!status.includes('Saknar') && !status.includes('kunde inte') && (
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
