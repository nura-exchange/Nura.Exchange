import { useState } from 'react'
import { useAppState } from '../context/useAppState'
import { useLaunches, scoreClass } from '../hooks/useQuoro'
import TokenCheck from './TokenCheck'

const TABS = [['recent', 'New'], ['trending', 'Trending']]

function age(min) {
  if (min == null) return '—'
  if (min < 60) return `${min}m`
  if (min < 1440) return `${Math.floor(min / 60)}h`
  return `${Math.floor(min / 1440)}d`
}

export default function LaunchesFeed() {
  const { setActiveTab, setSwapPrefill } = useAppState()
  const [sort, setSort] = useState('recent')
  const [checking, setChecking] = useState(null)
  const { rows, loading } = useLaunches(sort, 8)

  function trade(r) {
    setSwapPrefill({ to: { symbol: r.symbol, name: r.name, address: r.ca, ca: r.ca, decimals: 18 } })
    setActiveTab('Swap')
  }

  if (!loading && !rows.length) return null

  return (
    <section className="container launches reveal" aria-label="Scored launches">
      {checking && <TokenCheck address={checking} onClose={() => setChecking(null)} />}
      <div className="movers-head">
        <div>
          <h2 className="subheading">Every new launch, scored.</h2>
          <p className="section-note">Fresh Robinhood Chain tokens with a Data score from 1 to 10. Open one to see the flags behind it.</p>
        </div>
        <div className="seg" role="group" aria-label="Launch list">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" className={`seg-btn ${sort === k ? 'active' : ''}`} aria-pressed={sort === k} onClick={() => setSort(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="editorial-table">
          <thead>
            <tr>
              <th>Token</th>
              <th className="num">Score</th>
              <th className="num hide-sm">Age</th>
              <th className="num hide-sm">Buyers</th>
              <th className="num hide-sm">24h</th>
              <th></th>
            </tr>
          </thead>
          <tbody key={sort}>
            {rows.map((r, i) => (
              <tr key={r.ca} className="row-link" style={{ '--i': i }} onClick={e => { if (!e.target.closest('button')) setChecking(r.ca) }}>
                <td>
                  <span className="ticker-cell">
                    {r.logo
                      ? <img src={r.logo.startsWith('/') ? `https://quoro.exchange${r.logo}` : r.logo} alt="" className="tok-logo" loading="lazy" />
                      : <span className="tok-logo tok-logo-fallback">{(r.symbol || '?').slice(0, 2)}</span>}
                    <strong>{r.symbol}</strong>
                    <span className="muted launch-name">{r.name}</span>
                  </span>
                </td>
                <td className="num">
                  {r.score != null
                    ? <span className={`score-badge ${scoreClass(r.score, r.flagged)}`} title={r.flagged ? 'Data score — red flag' : 'Data score'}>{r.score}</span>
                    : <span className="dim" title="Scoring in progress">…</span>}
                </td>
                <td className="num mono hide-sm dim">{age(r.ageMin)}</td>
                <td className="num mono hide-sm">{r.buyers ?? '—'}</td>
                <td className={`num mono hide-sm ${r.change24h > 0 ? 'up' : r.change24h < 0 ? 'down' : ''}`}>
                  {r.change24h == null ? '—' : `${r.change24h > 0 ? '+' : ''}${r.change24h.toFixed(1)}%`}
                </td>
                <td className="num">
                  <button type="button" className="pill pill-ghost xs" onClick={() => setChecking(r.ca)}>Check</button>{' '}
                  <button type="button" className="pill pill-ghost xs launch-trade" onClick={() => trade(r)}>Trade</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tc-legal">Data scores by Quoro. They describe the launch and how it trades, not the future price. Not financial advice.</p>
    </section>
  )
}
