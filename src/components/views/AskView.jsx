import { useEffect, useRef, useState } from 'react'
import { useAppState } from '../../context/useAppState'

const EXAMPLES = [
  'What happened on Robinhood Chain today?',
  'Price of NURA?',
  'Explain the token 0x11a2809ebf14653760c7b1136acdee7cf5c5a9c9',
  'Latest news about tokenized stocks',
]

function SourceList({ sources }) {
  if (!Array.isArray(sources) || !sources.length) return null
  return (
    <ol className="tilik-sources">
      {sources.map(s => (
        <li key={s.id}>
          <a href={s.url} target="_blank" rel="noreferrer">{s.title || s.domain || s.url}</a>
          {s.domain && <span className="dim"> · {s.domain}</span>}
        </li>
      ))}
    </ol>
  )
}

function Msg({ m }) {
  const [showPlan, setShowPlan] = useState(false)
  if (m.role === 'user') {
    return <div className="tilik-msg tilik-user"><div className="tilik-bubble">{m.content}</div></div>
  }
  const grounded = m.data?.grounded !== false
  return (
    <div className="tilik-msg tilik-ai">
      <div className="tilik-ai-head">
        <span className="tilik-badge">TILIK</span>
        {grounded
          ? <span className="dim">cited answer</span>
          : <span className="warn">ungrounded — live data missing</span>}
      </div>
      <div className="tilik-bubble tilik-answer">{m.content}</div>
      <SourceList sources={m.data?.sources} />
      {m.data?.plan?.tools?.length > 0 && (
        <div className="tilik-plan">
          <button type="button" className="tilik-plan-toggle" onClick={() => setShowPlan(v => !v)}>
            {showPlan ? 'Hide' : 'Show'} plan · {m.data.plan.tools.length} tool step{m.data.plan.tools.length > 1 ? 's' : ''}
          </button>
          {showPlan && (
            <ul className="tilik-plan-list">
              {m.data.plan.tools.map((t, i) => (
                <li key={i} className="mono">{t.step} · {t.candidates?.join(' → ') || t.capability}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function AskView() {
  const { notify } = useAppState()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState([])
  const [health, setHealth] = useState(null)
  const scrollRef = useRef(null)
  const reqId = useRef(0)

  useEffect(() => {
    fetch('/api/tilik')
      .then(r => r.json())
      .then(j => setHealth(j))
      .catch(() => setHealth({ ok: false }))
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, busy])

  async function send(text) {
    const message = String(text ?? input).trim()
    if (!message || busy) return
    setInput('')
    const id = ++reqId.current
    const history = msgs.filter(m => m.role === 'user' || m.role === 'assistant').slice(-6)
    setMsgs(prev => [...prev, { role: 'user', content: message }])
    setBusy(true)
    try {
      const r = await fetch('/api/tilik', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, history: history.map(m => ({ role: m.role, content: m.content })) }),
      })
      const j = await r.json()
      if (reqId.current !== id) return
      if (j.error) {
        setMsgs(prev => [...prev, { role: 'assistant', content: `TILIK is unreachable: ${j.error}`, data: { grounded: false } }])
      } else {
        setMsgs(prev => [...prev, { role: 'assistant', content: j.answer || '(no answer)', data: j }])
      }
    } catch (e) {
      if (reqId.current === id) {
        setMsgs(prev => [...prev, { role: 'assistant', content: `Request failed: ${String(e?.message || e)}`, data: { grounded: false } }])
      }
    } finally {
      if (reqId.current === id) setBusy(false)
    }
  }

  const toolsOn = health?.tools ? Object.entries(health.tools).filter(([, v]) => v).length : 0

  return (
    <div className="container view ask-view">
      <div className="ask-head reveal">
        <h1 className="section-heading">Ask TILIK</h1>
        <p className="section-note">
          AI research for Robinhood Chain — every answer cited.{' '}
          {health?.ok
            ? <span className="up">{toolsOn} tools live · {Object.values(health.providers || {}).filter(Boolean).length} LLM providers</span>
            : health
              ? <span className="warn">engine offline</span>
              : <span className="dim">connecting…</span>}
        </p>
      </div>

      <div className="ask-chat reveal reveal-d1" ref={scrollRef}>
        {!msgs.length && (
          <div className="ask-idle">
            <div className="ask-idle-text dim">Ask anything about Robinhood Chain, tokens, markets or the web.</div>
            <div className="ask-examples">
              {EXAMPLES.map(x => (
                <button key={x} type="button" className="pill pill-ghost xs" onClick={() => send(x)}>{x}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => <Msg key={i} m={m} />)}
        {busy && <div className="tilik-msg tilik-ai"><div className="tilik-bubble dim">Thinking…</div></div>}
      </div>

      <form className="ask-bar reveal reveal-d2" onSubmit={e => { e.preventDefault(); send() }}>
        <input
          className="ask-input"
          placeholder="Ask TILIK… (Enter to send)"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={busy}
          autoComplete="off"
        />
        <button type="submit" className="pill pill-primary" disabled={busy || !input.trim()}>
          {busy ? '…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
