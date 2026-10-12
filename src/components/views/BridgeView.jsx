import { useState, useEffect, useMemo, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useAppState } from '../../context/useAppState'
import { SOURCE_CHAINS, robinhoodChain, NATIVE, txUrl } from '../../config'
import { getQuote, executeQuote, quoteError, remember, parseUnits, formatUnits } from '../../lib/trade'

const SLIPPAGE = 0.5
const DEAD = '0x000000000000000000000000000000000000dEaD'

function fmt(n, d = 4) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(d)
  return n.toFixed(6)
}

export default function BridgeView() {
  const { address, isConnected, connector } = useAccount()
  const { notify } = useAppState()
  const [srcKey, setSrcKey] = useState('ethereum')
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [quoteErr, setQuoteErr] = useState(null)
  const [phase, setPhase] = useState(null)
  const [lastHash, setLastHash] = useState(null)
  const reqId = useRef(0)

  const source = useMemo(() => SOURCE_CHAINS.find(s => s.key === srcKey) || SOURCE_CHAINS[0], [srcKey])
  const parsed = amount ? (() => { try { return parseUnits(amount, 18) } catch { return 0n } })() : 0n

  useEffect(() => {
    setQuote(null)
    setQuoteErr(null)
    if (parsed <= 0n) return
    const id = ++reqId.current
    const from = address || DEAD
    setQuoting(true)
    const t = setTimeout(() => {
      getQuote({
        fromChain: source.chain.id,
        toChain: robinhoodChain.id,
        fromToken: NATIVE,
        toToken: NATIVE,
        fromAmount: parsed.toString(),
        fromAddress: from,
        slippage: SLIPPAGE,
      })
        .then(q => { if (id === reqId.current) { setQuote(q); setQuoteErr(null) } })
        .catch(e => { if (id === reqId.current) setQuoteErr(quoteError(e)) })
        .finally(() => { if (id === reqId.current) setQuoting(false) })
    }, 550)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, source, address])

  const outAmount = quote?.estimate?.toAmount ? formatUnits(BigInt(quote.estimate.toAmount), 18) : null
  const gasUsd = quote?.estimate?.gasCosts?.find(g => g.amountUSD)?.amountUSD
  const bridgeFeeUsd = quote?.estimate?.feeCosts?.reduce((s, f) => s + (parseFloat(f.amountUSD) || 0), 0)
  const routeTool = quote?.toolDetails?.name || quote?.tool

  async function onBridge() {
    if (!isConnected || !connector || !address) {
      notify('Wallet', 'Connect your wallet first', 'error')
      return
    }
    if (!quote || phase) return
    setPhase('switch')
    setLastHash(null)
    try {
      const hash = await executeQuote(quote, {
        connector,
        account: address,
        onStatus: (s) => {
          setPhase(s.phase)
          if (s.txHash) setLastHash(s.txHash)
        },
      })
      remember(address, {
        ts: Date.now(),
        side: 'bridge',
        symbol: 'ETH',
        ca: null,
        name: `${source.name} → Robinhood Chain`,
        inSymbol: source.native,
        amountIn: amount,
        out: outAmount ? fmt(parseFloat(outAmount), 6) : null,
        outSymbol: 'ETH',
        txHash: hash,
        url: `${source.explorer}/tx/${hash}`,
        status: 'pending',
      })
      notify('Bridge Initiated', `Funds are on the way — arrival depends on the route (usually under a minute).`, 'success')
      setAmount('')
      setQuote(null)
      window.dispatchEvent(new Event('nura:refresh'))
    } catch (e) {
      notify('Bridge Failed', quoteError(e), 'error')
    } finally {
      setPhase(null)
    }
  }

  const busy = ['switch', 'approve', 'sign', 'pending'].includes(phase)
  const phaseLabel = {
    switch: 'Switching network…',
    approve: 'Approving…',
    sign: 'Confirm in wallet…',
    pending: 'Confirming…',
    done: 'Confirmed',
  }[phase] || null

  return (
    <div className="container view split">
      <aside className="split-aside">
        <h1 className="section-heading">Bridge</h1>
        <p className="section-note">
          Bring funds to Robinhood Chain from {SOURCE_CHAINS.length} networks in a single signed
          transaction — routed by LI.FI, no middleman holds your assets.
        </p>
        <ul className="split-meta">
          <li><span>Sources</span><span>{SOURCE_CHAINS.length} networks</span></li>
          <li><span>Asset</span><span>Native ETH in, ETH out</span></li>
          <li><span>Arrival</span><span>Usually under a minute</span></li>
        </ul>
      </aside>

      <div className="split-main">
      <div className="trade-card">
        <div className="field">
          <div className="field-top">
            <span className="label">From</span>
            <span className="balance-line">You pay in {source.native}</span>
          </div>
          <div className="field-row">
            <input
              className="amount-input"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            />
            <div className="token-picker">
              <select
                className="chain-select"
                value={srcKey}
                onChange={e => { setSrcKey(e.target.value); setQuote(null) }}
              >
                {SOURCE_CHAINS.map(s => (
                  <option key={s.key} value={s.key}>{s.name} ({s.native})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="swap-arrow" aria-hidden="true">↓</div>

        <div className="field">
          <div className="field-top">
            <span className="label">To</span>
          </div>
          <div className="field-row">
            <div className="amount-output">{quote ? fmt(parseFloat(outAmount || '0'), 6) : <span className="dim">—</span>}</div>
            <span className="pill token-pill wide static">Robinhood Chain · ETH</span>
          </div>
          <div className="field-note">
            {quoting && 'Finding best route…'}
            {!quoting && quoteErr && quoteErr}
            {!quoting && !quoteErr && quote && <>Route: {routeTool} · arrives after source-chain finality</>}
          </div>
        </div>

        {quote && !quoteErr && (
          <div className="quote-lines">
            <div className="q-line"><span>Minimum received</span><span>{fmt(parseFloat(minOf(quote) || '0'), 6)} ETH</span></div>
            <div className="q-line"><span>Network fee</span><span>{gasUsd ? `$${fmt(parseFloat(gasUsd), 2)}` : '—'}</span></div>
            {bridgeFeeUsd > 0 && <div className="q-line"><span>Route fee</span><span>${fmt(bridgeFeeUsd, 2)}</span></div>}
            <div className="q-line"><span>Slippage</span><span>{SLIPPAGE}%</span></div>
          </div>
        )}

        <button
          type="button"
          className="pill pill-primary trade-cta"
          disabled={busy || quoting || !quote || parsed <= 0n}
          onClick={onBridge}
        >
          {!isConnected ? 'Connect wallet to bridge'
            : busy ? phaseLabel
              : !amount ? 'Enter an amount'
                : quoteErr ? 'No route from this chain'
                  : !quote ? 'Fetching quote…'
                    : `Bridge ${amount} ${source.native} to Robinhood`}
        </button>

        {lastHash && (
          <div className="tx-link-row">
            <a href={txUrl(lastHash)} target="_blank" rel="noreferrer">View transaction on Blockscout ↗</a>
          </div>
        )}

        <div className="chain-grid">
          {SOURCE_CHAINS.map(s => (
            <button
              key={s.key}
              type="button"
              className={`chain-chip ${srcKey === s.key ? 'active' : ''}`}
              onClick={() => { setSrcKey(s.key); setQuote(null) }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
      </div>
    </div>
  )
}

function minOf(q) {
  try {
    return formatUnits(BigInt(q.estimate.toAmountMin), 18)
  } catch {
    return null
  }
}
