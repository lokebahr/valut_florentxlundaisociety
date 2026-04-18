import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import { api } from '../api'

marked.use({ breaks: true, gfm: true })

type Message = {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Varför rekommenderas dessa fonder?',
  'Vad innebär min risknivå?',
  'Hur påverkar avgiften min avkastning?',
  'Vad är skillnaden mellan aktier och räntor?',
]

export function AdvisorChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: 'Hej! Jag är din AI-rådgivare. Jag har tillgång till din portfölj och rekommendationer och kan förklara varför vi föreslår dessa fonder, diskutera din riskprofil eller svara på frågor om investeringsteori. Vad undrar du?',
        },
      ])
    }
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const next: Message[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await api<{ reply: string }>('/api/advisor/chat', {
        method: 'POST',
        body: { messages: next },
      })
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel.')
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        type="button"
        className={`advisor-fab${open ? ' advisor-fab--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Stäng rådgivare' : 'Öppna AI-rådgivare'}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.08 2 11c0 2.5 1.03 4.77 2.7 6.43L4 22l4.57-.7A9.94 9.94 0 0012 22c5.52 0 10-4.08 10-9s-4.48-9-10-9z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <circle cx="8.5" cy="11" r="1.2" fill="currentColor"/>
            <circle cx="12" cy="11" r="1.2" fill="currentColor"/>
            <circle cx="15.5" cy="11" r="1.2" fill="currentColor"/>
          </svg>
        )}
        {!open && <span className="advisor-fab__label">Fråga rådgivaren</span>}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="advisor-panel step-animate">
          <div className="advisor-panel__header">
            <div className="advisor-panel__header-info">
              <div className="advisor-panel__avatar">AI</div>
              <div>
                <p className="advisor-panel__title">AI-rådgivare</p>
                <p className="advisor-panel__subtitle">Fråga om din portfölj</p>
              </div>
            </div>
            <button
              type="button"
              className="advisor-panel__close"
              onClick={() => setOpen(false)}
              aria-label="Stäng"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className="advisor-panel__messages">
            {messages.map((m, i) => (
              <div key={i} className={`advisor-msg advisor-msg--${m.role}`}>
                {m.role === 'assistant' ? (
                  <div
                    className="advisor-msg__md"
                    dangerouslySetInnerHTML={{ __html: marked.parse(m.content) as string }}
                  />
                ) : (
                  <p className="advisor-msg__text">{m.content}</p>
                )}
              </div>
            ))}

            {loading && (
              <div className="advisor-msg advisor-msg--assistant">
                <div className="advisor-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {error && (
              <p className="advisor-error">{error}</p>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Suggestion chips (only before first user message) */}
          {messages.length <= 1 && !loading && (
            <div className="advisor-panel__suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="advisor-chip"
                  onClick={() => void send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="advisor-panel__input-row">
            <textarea
              ref={inputRef}
              className="advisor-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Skriv en fråga… (Enter för att skicka)"
              rows={1}
              disabled={loading}
            />
            <button
              type="button"
              className="advisor-send"
              onClick={() => void send()}
              disabled={!input.trim() || loading}
              aria-label="Skicka"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 12l18-9-9 18V12H3z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
