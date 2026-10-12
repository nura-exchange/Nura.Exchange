import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { getHistory } from '../../lib/trade'

function fmtTime(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function HistoryView() {
  const { address, isConnected } = useAccount()
  const [items, setItems] = useState([])

  useEffect(() => {
    if (address) setItems(getHistory(address))
    else setItems([])
    const h = () => address && setItems(getHistory(address))
    window.addEventListener('nura:refresh', h)
    return () => window.removeEventListener('nura:refresh', h)
  }, [address])

  if (!isConnected) {
    return (
      <div className="container view">
        <div className="view-head">
          <h1 className="section-heading">History</h1>
          <p className="section-note">Connect your wallet to see your swaps and bridges. History lives in this browser only.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container view">
      <div className="view-head reveal">
        <h1 className="section-heading">History</h1>
        <p className="section-note">Your recent swaps and bridges, kept in this browser only — nothing is stored on a server.</p>
      </div>

      <div className="table-wrap reveal reveal-d1">
        <table className="editorial-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th className="num">Paid</th>
              <th className="num hide-sm">Received</th>
              <th className="num">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={(it.txHash || '') + i}>
                <td className="muted">{fmtTime(it.ts)}</td>
                <td>
                  <span className="side-tag">{it.side === 'bridge' ? 'Bridge' : 'Swap'}</span>{' '}
                  <strong>{it.side === 'bridge' ? it.name : `${it.inSymbol} → ${it.outSymbol}`}</strong>
                </td>
                <td className="num mono">{it.amountIn} {it.inSymbol}</td>
                <td className="num mono hide-sm">{it.out != null ? `${it.out} ${it.outSymbol}` : '—'}</td>
                <td className="num">
                  {it.url
                    ? <a className="inline-link" href={it.url} target="_blank" rel="noreferrer">{it.status} ↗</a>
                    : <span className="muted">{it.status}</span>}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={5} className="empty-cell">No activity yet — your swaps and bridges will appear here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
