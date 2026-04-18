import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'

type TinkLinkInfo = { mode: 'mock' | 'tink'; url?: string }

function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

export function Home() {
  const { token, setToken } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(!!token)
  const [scrolled, setScrolled] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const me = await api<{ onboarding_completed: boolean }>('/api/auth/me')
        navigate(me.onboarding_completed ? '/dashboard' : '/onboarding')
      } catch {
        // Token invalid/expired — let the normal page render, user can log in again
      } finally {
        setLoading(false)
      }
    })()
  }, [token, navigate])

  async function handleDinSida() {
    if (token) {
      navigate('/dashboard')
      return
    }
    setAuthBusy(true)
    try {
      const info = await api<TinkLinkInfo>('/api/tink/link')
      if (info.mode === 'mock') {
        const res = await api<{ token: string }>('/api/auth/mock', { method: 'POST' })
        setToken(res.token)
        navigate('/onboarding', { replace: true })
      } else if (info.url) {
        window.location.assign(info.url)
      }
    } catch {
      navigate('/register')
    } finally {
      setAuthBusy(false)
    }
  }

  if (token && loading) {
    return (
      <div className="lp-loading">
        <p className="muted">Laddar…</p>
      </div>
    )
  }

  return (
    <div className="lp">
      <header className={`lp-nav${scrolled ? ' lp-nav--solid' : ''}`}>
        <Link to="/" className="lp-nav__logo">Valut</Link>
        <nav className="lp-nav__actions">
          <button
            type="button"
            className={`lp-pill${scrolled ? ' lp-pill--accent' : ' lp-pill--white'}`}
            onClick={handleDinSida}
            disabled={authBusy}
          >
            {authBusy ? '…' : 'Din sida'}
          </button>
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-hero__bg" aria-hidden></div>
        <div className="lp-hero__inner">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow__dot" />
            Investeringsrådgivning
          </div>
          <h1 className="lp-hero__h1">
            Investeringar som<br />faktiskt passar dig
          </h1>
          <p className="lp-hero__lead">
            Vi analyserar din portfölj och ger konkreta råd —
            baserat på dina mål, din risktolerans och din ekonomi.
          </p>
          <div className="lp-hero__ctas">
            <button
              type="button"
              className="lp-pill lp-pill--white lp-pill--lg"
              onClick={handleDinSida}
              disabled={authBusy}
            >
              {authBusy ? 'Laddar…' : 'Din sida →'}
            </button>
          </div>
        </div>
        <div className="lp-hero__scroll" aria-hidden><span /></div>
      </section>

      <FeaturesSection />
      <HowItWorksSection />
      <VanSection onCta={handleDinSida} busy={authBusy} />
      <LifestyleSection />
      <StatsSection />
      <TestimonialsSection />
      <CtaSection onCta={handleDinSida} busy={authBusy} />

      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <span className="lp-footer__logo">Valut</span>
          <span>© 2025 Valut · Sparande som följer dina mål</span>
        </div>
      </footer>
    </div>
  )
}

function FeaturesSection() {
  const { ref, visible } = useReveal()
  const features = [
    {
      n: '01',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
        </svg>
      ),
      title: 'Personlig analys',
      body: 'Vi kopplar till din bank och analyserar dina nuvarande innehav mot dina mål och risktolerans.',
    },
    {
      n: '02',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      ),
      title: 'Konkreta råd',
      body: 'Inga vaga råd. Du får tydliga rekommendationer: vad du ska behålla, sälja eller köpa.',
    },
    {
      n: '03',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 20V10M12 20V4M6 20v-6" />
        </svg>
      ),
      title: 'Löpande uppföljning',
      body: 'Din ekonomi förändras. Vi håller koll och meddelar dig när din portfölj behöver justeras.',
    },
  ]
  return (
    <div ref={ref} className={`lp-section lp-section--light lp-reveal${visible ? ' lp-reveal--in' : ''}`}>
      <div className="lp-wrap">
        <div className="lp-eyebrow lp-eyebrow--green">Vad vi erbjuder</div>
        <h2 className="lp-h2">Allt du behöver för ett<br />smartare sparande</h2>
        <div className="lp-grid-3">
          {features.map((f, i) => (
            <div
              className="lp-card"
              key={f.n}
              style={{ '--lp-delay': `${i * 0.11}s` } as CSSProperties}
            >
              <div className="lp-card__icon">{f.icon}</div>
              <h3 className="lp-card__title">{f.title}</h3>
              <p className="lp-card__body">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function HowItWorksSection() {
  const { ref, visible } = useReveal()
  const steps = [
    {
      title: 'Skapa konto',
      body: 'Det tar under en minut att registrera sig. Inget kreditkort behövs.',
    },
    {
      title: 'Koppla din bank',
      body: 'Vi använder säker open banking för att läsa in dina innehav automatiskt.',
    },
    {
      title: 'Få din analys',
      body: 'Inom sekunder får du en personlig genomgång av din portfölj och vad du kan göra bättre.',
    },
  ]
  return (
    <div ref={ref} className={`lp-section lp-section--dark lp-reveal${visible ? ' lp-reveal--in' : ''}`}>
      <div className="lp-wrap">
        <div className="lp-eyebrow">Hur det fungerar</div>
        <h2 className="lp-h2 lp-h2--light">Tre steg till ett<br />bättre sparande</h2>
        <div className="lp-steps">
          {steps.map((s, i) => (
            <div
              className="lp-step"
              key={i}
              style={{ '--lp-delay': `${i * 0.13}s` } as CSSProperties}
            >
              <div className="lp-step__num">{i + 1}</div>
              <div>
                <h3 className="lp-step__title">{s.title}</h3>
                <p className="lp-step__body">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function VanSection({ onCta, busy }: { onCta: () => void; busy: boolean }) {
  const { ref, visible } = useReveal(0.05)
  return (
    <div ref={ref} className={`lp-split lp-reveal${visible ? ' lp-reveal--in' : ''}`}>
      <div className="lp-split__img"></div>
      <div className="lp-split__content">
        <div className="lp-eyebrow">Frihet att välja</div>
        <h2 className="lp-split__h2">
          Öppna dörren<br />mot livet du<br />vill leva
        </h2>
        <p className="lp-split__body">
          Bakom varje sparad krona döljer sig en möjlighet — en resa, ett hem, en känsla av frihet.
          Valut hjälper dig att nå dit snabbare.
        </p>
        <button type="button" className="lp-pill lp-pill--white" onClick={onCta} disabled={busy}>
          {busy ? 'Laddar…' : 'Din sida →'}
        </button>
      </div>
    </div>
  )
}

function LifestyleSection() {
  const { ref, visible } = useReveal()
  const items = [
    { alt: 'Person med skateboard', label: 'Dina intressen' },
    { alt: 'Vänner skålar', label: 'Dina upplevelser' },
    { alt: 'Familj med barn', label: 'Din familj' },
  ]
  return (
    <div ref={ref} className={`lp-section lp-section--cream lp-reveal${visible ? ' lp-reveal--in' : ''}`}>
      <div className="lp-wrap">
        <div className="lp-eyebrow lp-eyebrow--green">Investera i livet du vill leva</div>
        <h2 className="lp-h2">Sparande med ett syfte</h2>
        <div className="lp-lifestyle">
          {items.map((item, i) => (
            <div
              className="lp-lifestyle__item"
              key={item.label}
              style={{ '--lp-delay': `${i * 0.12}s` } as CSSProperties}
            >
              <div className="lp-lifestyle__img"></div>
              <span className="lp-lifestyle__label">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function useCountUp(target: number, active: boolean, duration = 1600) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setCount(Math.floor(ease * target))
      if (t < 1) requestAnimationFrame(tick)
      else setCount(target)
    }
    requestAnimationFrame(tick)
  }, [target, active, duration])
  return count
}

function AnimatedStat({ value, label, delay, active }: { value: string; label: string; delay: number; active: boolean }) {
  const numeric = parseInt(value.replace(/\D/g, ''), 10)
  const suffix = value.replace(/[\d\s]/g, '')
  const count = useCountUp(isNaN(numeric) ? 0 : numeric, active)
  const display = isNaN(numeric) ? value : `${count.toLocaleString('sv-SE')}${suffix}`
  return (
    <div className="lp-stat" style={{ '--lp-delay': `${delay}s` } as CSSProperties}>
      <div className="lp-stat__value">{display}</div>
      <div className="lp-stat__label">{label}</div>
    </div>
  )
}

function StatsSection() {
  const { ref, visible } = useReveal()
  const stats = [
    { value: '14000+', label: 'Analyserade portföljer' },
    { value: '98%', label: 'Nöjda användare' },
    { value: '2 min', label: 'Till din första analys' },
    { value: '100%', label: 'Oberoende rådgivning' },
  ]
  return (
    <div ref={ref} className={`lp-section lp-section--cream lp-reveal${visible ? ' lp-reveal--in' : ''}`}>
      <div className="lp-wrap">
        <div className="lp-stats">
          {stats.map((s, i) => (
            <AnimatedStat key={s.label} value={s.value} label={s.label} delay={i * 0.1} active={visible} />
          ))}
        </div>
      </div>
    </div>
  )
}

function TestimonialsSection() {
  const { ref, visible } = useReveal()
  const quotes = [
    {
      quote: 'Jag visste inte att mina fonder överlappade varandra så mycket. Valut visade mig det på sekunder.',
      name: 'Anna K.',
      role: 'Lärare, 38 år',
    },
    {
      quote: 'Enkelt, tydligt och utan säljsnack. Exakt vad jag letat efter.',
      name: 'Marcus L.',
      role: 'Ingenjör, 45 år',
    },
    {
      quote: 'Fick äntligen ordning på mitt pensionssparande. Rekommenderar varmt.',
      name: 'Sofia E.',
      role: 'Egenföretagare, 52 år',
    },
  ]
  return (
    <div ref={ref} className={`lp-section lp-section--light lp-reveal${visible ? ' lp-reveal--in' : ''}`}>
      <div className="lp-wrap">
        <div className="lp-eyebrow lp-eyebrow--green">Vad användare säger</div>
        <h2 className="lp-h2">Riktiga råd.<br />Riktiga resultat.</h2>
        <div className="lp-grid-3">
          {quotes.map((q, i) => (
            <div
              className="lp-testimonial"
              key={i}
              style={{ '--lp-delay': `${i * 0.1}s` } as CSSProperties}
            >
              <div className="lp-testimonial__stars" aria-label="5 stjärnor">{'★★★★★'}</div>
              <p className="lp-testimonial__quote">{q.quote}</p>
              <div className="lp-testimonial__author">
                <strong>{q.name}</strong>
                <span>{q.role}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CtaSection({ onCta, busy }: { onCta: () => void; busy: boolean }) {
  const { ref, visible } = useReveal()
  return (
    <div ref={ref} className={`lp-section lp-section--accent lp-reveal${visible ? ' lp-reveal--in' : ''}`}>
      <div className="lp-wrap lp-wrap--center">
        <h2 className="lp-h2 lp-h2--light lp-h2--center">
          Redo att ta kontroll<br />över ditt sparande?
        </h2>
        <p className="lp-cta-lead">
          Kom igång gratis på under två minuter. Inget kreditkort krävs.
        </p>
        <button type="button" className="lp-pill lp-pill--white lp-pill--lg" onClick={onCta} disabled={busy}>
          {busy ? 'Laddar…' : 'Din sida →'}
        </button>
      </div>
    </div>
  )
}
