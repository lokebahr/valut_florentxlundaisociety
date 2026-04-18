import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'

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
  const { token } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(!!token)
  const [scrolled, setScrolled] = useState(false)

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
        navigate('/login')
      } finally {
        setLoading(false)
      }
    })()
  }, [token, navigate])

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
          <Link to="/login" className="lp-nav__link">Logga in</Link>
          <Link
            to="/register"
            className={`lp-pill${scrolled ? ' lp-pill--accent' : ' lp-pill--white'}`}
          >
            Kom igång
          </Link>
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-hero__inner">
          <div className="lp-eyebrow">Investeringsrådgivning</div>
          <h1 className="lp-hero__h1">
            Investeringar som<br />faktiskt passar dig
          </h1>
          <p className="lp-hero__lead">
            Vi analyserar din portfölj och ger konkreta råd —
            baserat på dina mål, din risktolerans och din ekonomi.
          </p>
          <div className="lp-hero__ctas">
            <Link to="/register" className="lp-pill lp-pill--white lp-pill--lg">Kom igång gratis</Link>
            <Link to="/login" className="lp-pill lp-pill--ghost lp-pill--lg">Logga in</Link>
          </div>
        </div>
        <div className="lp-hero__scroll" aria-hidden><span /></div>
      </section>

      <FeaturesSection />
      <HowItWorksSection />
      <StatsSection />
      <TestimonialsSection />
      <CtaSection />

      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <span className="lp-footer__logo">Valut</span>
          <span>© 2025 Valut · Sparande som följer dina mål</span>
          <div className="lp-footer__links">
            <Link to="/login">Logga in</Link>
            <Link to="/register">Registrera</Link>
          </div>
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
      title: 'Personlig analys',
      body: 'Vi kopplar till din bank och analyserar dina nuvarande innehav mot dina mål och risktolerans.',
    },
    {
      n: '02',
      title: 'Konkreta råd',
      body: 'Inga vaga råd. Du får tydliga rekommendationer: vad du ska behålla, sälja eller köpa.',
    },
    {
      n: '03',
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
              <div className="lp-card__num">{f.n}</div>
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

function StatsSection() {
  const { ref, visible } = useReveal()
  const stats = [
    { value: '14 000+', label: 'Analyserade portföljer' },
    { value: '4,8 / 5', label: 'Genomsnittligt betyg' },
    { value: '2 min', label: 'Till din första analys' },
    { value: '100 %', label: 'Oberoende rådgivning' },
  ]
  return (
    <div ref={ref} className={`lp-section lp-section--cream lp-reveal${visible ? ' lp-reveal--in' : ''}`}>
      <div className="lp-wrap">
        <div className="lp-stats">
          {stats.map((s, i) => (
            <div
              className="lp-stat"
              key={s.label}
              style={{ '--lp-delay': `${i * 0.1}s` } as CSSProperties}
            >
              <div className="lp-stat__value">{s.value}</div>
              <div className="lp-stat__label">{s.label}</div>
            </div>
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
      quote:
        'Jag visste inte att mina fonder överlappade varandra så mycket. Valut visade mig det på sekunder.',
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
              <p className="lp-testimonial__quote">"{q.quote}"</p>
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

function CtaSection() {
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
        <Link to="/register" className="lp-pill lp-pill--white lp-pill--lg">
          Skapa konto gratis
        </Link>
      </div>
    </div>
  )
}
