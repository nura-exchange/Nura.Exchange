import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAccount } from 'wagmi'
import { useAppState } from '../context/useAppState'
import { useEthPrice, ETH_TOKEN, USDG } from '../hooks/useMarkets'
import { useTokenBalance, useNativeBalance } from '../hooks/useTokenBalance'
import { useExecuteSwap } from '../hooks/useExecuteSwap'
import { USDG_ADDRESS, robinhoodChain, txUrl } from '../config'
import { getQuote, quoteError, remember, parseUnits, formatUnits } from '../lib/trade'
import { getQuoroQuote, normalizeQuoro, executeQuoroQuote } from '../lib/quoro'
import ChartSvg from './PriceChart'
import { RANGES, fmtPrice, fmtVol } from '../lib/chart'
import { useCandles } from '../hooks/useCandles'
import { marketSession, SESSIONS } from '../lib/session'
import NuraScan from './NuraScan'

const SLIPPAGE = 1
const QUORO = 'https://quoro.exchange'

function fmt(n, d = 4) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(d)
  return n.toFixed(6)
}

function fmtAge(min) {
  if (min == null) return null
  if (min < 60) return `${Math.round(min)}m`
  if (min < 60 * 24) return `${Math.round(min / 60)}h`
  return `${Math.round(min / (60 * 24))}d`
}

/* ------------------------------------------------------------------ */
/* Market-order ticket: ETH/USDG ⇄ token on Robinhood Chain via LI.FI  */
/* ------------------------------------------------------------------ */

function TradeTicket({ token, onClose }) {
  const { address, isConnected, connector } = useAccount()
  const { notify, setSwapPrefill, setActiveTab } = useAppState()
  const ethPrice = useEthPrice()

  const [side, setSide] = useState('buy')
  const [paySel, setPaySel] = useState('ETH')
  const [decimals, setDecimals] = useState(token.decimals ?? 18)
  const [amountIn, setAmountIn] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoro, setQuoro] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [quoteErr, setQuoteErr] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const [qxStatus, setQxStatus] = useState(null)
  const reqId = useRef(0)
  const executingRef = useRef(false)

  const { execute, status, busy, reset: resetSwap } = useExecuteSwap()
  const phase = qxStatus?.phase ?? status?.phase ?? null

  const tokenAddr = token.ca || token.address
  const tokenSym = token.symbol || token.ticker

  // Quoro-sourced tokens carry no decimals — resolve them from LI.FI's token registry.
  useEffect(() => {
    if (!tokenAddr || token.decimals != null) return
    let alive = true
    fetch(`https://li.quest/v1/token?chain=${robinhoodChain.id}&token=${tokenAddr}`)
      .then(r => r.json())
      .then(d => { if (alive && d?.decimals != null) setDecimals(d.decimals) })
      .catch(() => {})
    return () => { alive = false }
  }, [tokenAddr, token.decimals])

  const nativeBal = useNativeBalance(robinhoodChain.id)
  const usdgBal = useTokenBalance(USDG_ADDRESS, 6)
  const tokBal = useTokenBalance(tokenAddr, decimals)

  const fromToken = side === 'buy'
    ? (paySel === 'ETH' ? ETH_TOKEN : USDG)
    : { address: tokenAddr, symbol: tokenSym, decimals, priceUsd: token.priceUsd ?? null }
  const toToken = side === 'buy'
    ? { ...token, address: tokenAddr, decimals }
    : ETH_TOKEN

  const fromBalance = side === 'buy' ? (paySel === 'ETH' ? nativeBal : usdgBal) : tokBal

  const payDecimals = fromToken.decimals
  const parsedIn = useMemo(() => {
    try {
      return amountIn ? parseUnits(amountIn, payDecimals) : 0n
    } catch {
      return 0n
    }
  }, [amountIn, payDecimals])

  const tooBig = parsedIn > fromBalance.value

  function setPct(pct) {
    // keep a small ETH reserve for gas when spending the full native balance
    const reserve = side === 'buy' && paySel === 'ETH' && pct === 1 ? 0.0005 : 0
    const v = Math.max(0, fromBalance.balance * pct - reserve)
    const dec = side === 'sell' ? 6 : paySel === 'ETH' ? 6 : 4
    const f = 10 ** dec
    setAmountIn(v > 0 ? String(Math.floor(v * f) / f) : '')
    setQuote(null)
    setQuoro(null)
    setQuoteErr(null)
  }

  function switchSide(next) {
    if (next === side) return
    setSide(next)
    setAmountIn('')
    setQuote(null)
    setQuoro(null)
    setQuoteErr(null)
    setLastResult(null)
  }

  const amountNum = parseFloat(amountIn)
  const payUsd = Number.isFinite(amountNum) && amountNum > 0
    ? (side === 'sell'
      ? (token.priceUsd != null ? amountNum * token.priceUsd : null)
      : paySel === 'ETH' ? (ethPrice ? amountNum * ethPrice : null) : amountNum)
    : null

  const sameToken = fromToken.address?.toLowerCase() === toToken.address?.toLowerCase()

  // Market quote on Robinhood Chain only — cross-chain lives in the Swap view.
  // Quoro's server knows bonding-curve launches and v4 pools; LI.FI covers everything
  // else — race both and keep the better output.
  useEffect(() => {
    setQuote(null)
    setQuoro(null)
    setQuoteErr(null)
    if (!tokenAddr || parsedIn <= 0n || sameToken) return
    const id = ++reqId.current
    const from = address || '0x000000000000000000000000000000000000dEaD'
    setQuoting(true)
    const t = setTimeout(() => {
      const lifi = getQuote({
        fromChain: robinhoodChain.id,
        toChain: robinhoodChain.id,
        fromToken: fromToken.address,
        toToken: toToken.address,
        fromAmount: parsedIn.toString(),
        fromAddress: from,
        slippage: SLIPPAGE,
      })
        .then(q => ({ ok: true, q }))
        .catch(e => ({ ok: false, e }))
      const canQuoro = side === 'sell' || paySel === 'ETH'
      const qq = canQuoro
        ? getQuoroQuote({ ca: tokenAddr, side, amount: formatUnits(parsedIn, payDecimals), account: address || undefined, slippage: SLIPPAGE })
            .then(q => ({ ok: true, q }))
            .catch(() => ({ ok: false }))
        : Promise.resolve({ skip: true })
      Promise.all([lifi, qq]).then(([l, q]) => {
        if (id !== reqId.current) return
        setQuoting(false)
        if (l.ok) { setQuote(l.q); setQuoteErr(null) } else setQuoteErr(quoteError(l.e))
        if (q.ok) setQuoro(normalizeQuoro(q.q))
      })
    }, 550)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountIn, tokenAddr, fromToken.address, toToken.address, address, sameToken, decimals, side, paySel])

  const lifiOut = quote?.estimate?.toAmount
    ? formatUnits(BigInt(quote.estimate.toAmount), toToken?.decimals ?? 18)
    : null
  const quoroOutN = quoro?.out != null ? parseFloat(quoro.out) : null
  const lifiOutN = lifiOut != null ? parseFloat(lifiOut) : null
  // quoro wins when it is the only route (bonding curve) or returns at least as much
  const useQuoro = quoroOutN != null && (lifiOutN == null || quoroOutN >= lifiOutN)
  const err = useQuoro ? null : quoteErr

  const hasQuote = useQuoro || !!quote
  const outAmount = useQuoro ? quoro.out : lifiOut
  const minAmount = useQuoro
    ? quoro.outMin
    : (quote?.estimate?.toAmountMin ? formatUnits(BigInt(quote.estimate.toAmountMin), toToken?.decimals ?? 18) : null)
  const feeUsd = useQuoro
    ? quoro.feeUsd
    : (quote?.estimate?.gasCosts?.find(g => g.amountUSD)?.amountUSD
      ? parseFloat(quote.estimate.gasCosts.find(g => g.amountUSD).amountUSD)
      : null)
  const impact = useQuoro ? quoro.impactPct : (quote?.estimate?.priceImpact ?? quote?.impact ?? null)
  const routeLabel = useQuoro
    ? (quoro.provider === 'relay' ? 'Relay' : quoro.provider === 'lifi' ? 'LI.FI' : 'Quoro')
    : (quote?.toolDetails?.name || quote?.tool || null)
  const taxPct = useQuoro ? quoro.taxPct : 0

  const qxBusy = qxStatus != null && qxStatus.phase !== 'done'
  const swapBusyLocal = busy || qxBusy || ['switch', 'approve', 'sign', 'pending', 'delivering'].includes(phase)
  const phaseLabel = {
    approve: 'Approving token…',
    sign: 'Confirm in wallet…',
    pending: 'Confirming…',
  }[phase] || 'Working…'

  async function onExecute() {
    if (!isConnected || !connector || !address) {
      notify('Wallet', 'Connect your wallet first', 'error')
      return
    }
    if (executingRef.current || swapBusyLocal || quoting || !hasQuote || tooBig || parsedIn <= 0n || sameToken) return
    executingRef.current = true
    setLastResult(null)
    try {
      let res
      if (useQuoro) {
        // steps are bound to the account and short-lived: re-quote at signing time
        const fresh = await getQuoroQuote({ ca: tokenAddr, side, amount: amountIn, account: address, slippage: SLIPPAGE })
        if (!fresh.signable || !fresh.steps?.length) throw new Error('Quote expired — try again')
        setQxStatus({ phase: 'switch' })
        const hash = await executeQuoroQuote(fresh, { connector, account: address, onStatus: s => setQxStatus(s) })
        res = { txHash: hash, url: txUrl(hash) }
      } else {
        res = await execute({ originChainId: robinhoodChain.id, quote, relayQuote: null })
      }
      remember(address, {
        ts: Date.now(),
        side: 'swap',
        symbol: tokenSym,
        ca: tokenAddr,
        name: token.name || tokenSym,
        inSymbol: fromToken.symbol,
        amountIn,
        out: outAmount ? fmt(parseFloat(outAmount), 6) : null,
        outSymbol: toToken.symbol,
        txHash: res.txHash,
        url: res.url,
        status: 'done',
      })
      const outText = outAmount ? fmt(parseFloat(outAmount), 6) : '?'
      if (side === 'buy') {
        notify('Order Filled', `Bought ~${outText} ${tokenSym} for ${amountIn} ${fromToken.symbol}`, 'success')
      } else {
        notify('Order Filled', `Sold ${amountIn} ${tokenSym} for ~${outText} ETH`, 'success')
      }
      setLastResult({ url: res.url })
      setAmountIn('')
      setQuote(null)
      window.dispatchEvent(new Event('nura:refresh'))
    } catch (e) {
      notify('Trade Failed', quoteError(e), 'error')
    } finally {
      executingRef.current = false
      setQxStatus(null)
      resetSwap()
    }
  }

  function openFullSwap() {
    setSwapPrefill({ to: { ...token, symbol: tokenSym, address: tokenAddr, decimals } })
    setActiveTab('Swap')
    onClose()
  }

  return (
    <div className="tt-ticket">
      <div className="side-toggle">
        <button type="button" className={`side-btn buy ${side === 'buy' ? 'active' : ''}`} onClick={() => switchSide('buy')}>
          Buy
        </button>
        <button type="button" className={`side-btn sell ${side === 'sell' ? 'active' : ''}`} onClick={() => switchSide('sell')}>
          Sell
        </button>
      </div>

      <div className="field">
        <div className="field-top">
          <span className="label">{side === 'buy' ? 'You pay' : `You sell`}</span>
          <span className="balance-line">Balance: {fmt(fromBalance.balance, 4)} {fromToken.symbol}</span>
        </div>
        <div className="field-row">
          <input
            className="amount-input"
            inputMode="decimal"
            placeholder="0.0"
            value={amountIn}
            onChange={e => setAmountIn(e.target.value.replace(/[^0-9.]/g, ''))}
          />
          <div className="token-pills">
            {side === 'buy' ? (
              ['ETH', 'USDG'].map(sym => (
                <button
                  key={sym}
                  type="button"
                  className={`pill token-pill ${paySel === sym ? 'active' : ''}`}
                  onClick={() => { setPaySel(sym); setQuote(null); setQuoro(null); setQuoteErr(null) }}
                >
                  {sym}
                </button>
              ))
            ) : (
              <span className="pill token-pill active">{tokenSym}</span>
            )}
          </div>
        </div>
        <div className="field-sub">
          <span className="field-usd">{payUsd != null ? `≈ $${fmt(payUsd, 2)}` : ' '}</span>
          <span className="quick-amounts">
            {[[0.25, '25%'], [0.5, '50%'], [0.75, '75%'], [1, 'Max']].map(([p, label]) => (
              <button
                key={label}
                type="button"
                className="quick-btn"
                disabled={!isConnected || !(fromBalance.balance > 0)}
                onClick={() => setPct(p)}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
        {tooBig && <div className="field-note">Insufficient {fromToken.symbol} balance</div>}
      </div>

      <div className="swap-arrow" aria-hidden="true">↓</div>

      <div className="field">
        <div className="field-top">
          <span className="label">{side === 'buy' ? `You receive — ${tokenSym}` : 'You receive — ETH'}</span>
        </div>
        <div className="field-row">
          <div className="amount-output">{hasQuote ? fmt(parseFloat(outAmount || '0'), 6) : <span className="dim">—</span>}</div>
          <span className="pill token-pill">{side === 'buy' ? tokenSym : 'ETH'}</span>
        </div>
        <div className="field-note">
          {quoting && 'Finding best price…'}
          {!quoting && err && err}
          {!quoting && !err && hasQuote && (
            <>1 {fromToken.symbol} ≈ {fmt(parseFloat(outAmount || '0') / parseFloat(amountIn || '1'), 4)} {toToken?.symbol} · route: {routeLabel}</>
          )}
        </div>
      </div>

      {hasQuote && !err && (
        <div className="quote-lines">
          <div className="q-line"><span>Minimum received</span><span>{fmt(parseFloat(minAmount || '0'), 6)} {toToken?.symbol}</span></div>
          <div className="q-line"><span>Network fee</span><span>{feeUsd != null ? `$${fmt(feeUsd, 2)}` : '—'}</span></div>
          {taxPct > 0 && <div className="q-line"><span>Creator tax</span><span>{taxPct}%</span></div>}
          {impact != null && <div className="q-line"><span>Price impact</span><span>{fmt(parseFloat(impact), 2)}%</span></div>}
          <div className="q-line"><span>Slippage</span><span>{SLIPPAGE}%</span></div>
        </div>
      )}

      <button
        type="button"
        className="pill pill-primary trade-cta"
        disabled={swapBusyLocal || quoting || !hasQuote || tooBig || parsedIn <= 0n || sameToken}
        onClick={onExecute}
      >
        {!isConnected ? 'Connect wallet to trade'
          : swapBusyLocal ? phaseLabel
            : !amountIn ? (side === 'buy' ? 'Enter an amount' : 'Enter tokens to sell')
              : tooBig ? 'Insufficient balance'
                : err ? 'No route — try again'
                  : !hasQuote ? 'Fetching quote…'
                    : side === 'buy' ? `Buy ${tokenSym} with ${fromToken.symbol}`
                      : `Sell ${tokenSym} for ETH`}
      </button>

      {lastResult?.url && (
        <div className="tx-link-row">
          <a href={lastResult.url} target="_blank" rel="noreferrer">View transaction on explorer ↗</a>
        </div>
      )}

      <button type="button" className="tt-swap-link" onClick={openFullSwap}>
        Need another chain or token? Open full swap ↗
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Security scan — Quoro contract analysis (score, flags, on-chain facts) */
/* ------------------------------------------------------------------ */

function SecurityScan({ token }) {
  const ca = token.ca || token.address
  const [tick, setTick] = useState(0)
  const [state, setState] = useState({ status: 'loading' })
  const [lp, setLp] = useState({ status: 'loading' })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    fetch(`${QUORO}/api/token/${ca}`)
      .then(r => r.json())
      .then(d => {
        if (!alive) return
        if (!d || !d.kind) setState({ status: 'error' })
        else setState({ status: 'ready', data: d })
      })
      .catch(() => { if (alive) setState({ status: 'error' }) })
    return () => { alive = false }
  }, [ca, tick])

  useEffect(() => {
    let alive = true
    setLp({ status: 'loading' })
    fetch(`/api/launchpad?ca=${ca}`)
      .then(r => r.json())
      .then(d => { if (alive) setLp({ status: 'ready', data: d }) })
      .catch(() => { if (alive) setLp({ status: 'error' }) })
    return () => { alive = false }
  }, [ca, tick])

  if (state.status === 'loading') return <div className="chart-skel scan-skel" />
  if (state.status === 'error') {
    return (
      <div className="scan-error">
        Scan unavailable right now.
        <button type="button" className="pill pill-ghost xs" onClick={() => setTick(t => t + 1)}>Retry</button>
      </div>
    )
  }

  const d = state.data
  if (d.kind === 'stock') {
    return (
      <div className="scan-stock">
        <div className="scan-verdict good">Tokenized equity</div>
        <p className="scan-note">
          {d.symbol} is a custodial stock wrapper on Robinhood Chain — Quoro's contract risk scan applies to
          on-chain launches, not equity tokens. Price feeds are backed by Chainlink.
        </p>
        <div className="scan-facts">
          <div className="fact"><span className="fact-k">Type</span><span className="fact-v">Stock / ETF</span></div>
          {d.priceUsd != null && <div className="fact"><span className="fact-k">Price</span><span className="fact-v mono">${fmt(d.priceUsd, 2)}</span></div>}
          {d.change24h != null && <div className="fact"><span className="fact-k">24h</span><span className={`fact-v mono ${d.change24h > 0 ? 'up' : d.change24h < 0 ? 'down' : ''}`}>{d.change24h > 0 ? '+' : ''}{d.change24h.toFixed(2)}%</span></div>}
        </div>
      </div>
    )
  }

  const sc = typeof d.score === 'number' ? { value: d.score, factors: [], flags: [], caps: [] } : (d.score || {})
  const value = sc.value ?? null
  const facts = d.facts || {}
  const factors = Array.isArray(sc.factors) ? sc.factors : []
  const flags = Array.isArray(sc.flags) ? sc.flags : []
  const caps = Array.isArray(sc.caps) ? sc.caps : []
  const appliedCaps = caps.filter(c => c.applied)
  const flagged = Boolean(d.flagged) || appliedCaps.some(c => c.id === 'flag')
  const verdict = flagged || (value != null && value < 4)
    ? { cls: 'bad', text: 'High risk — trade with care' }
    : value != null && value < 7
      ? { cls: 'warn', text: 'Mixed signals — do your own research' }
      : value != null
        ? { cls: 'good', text: 'Looks healthy on-chain' }
        : { cls: 'warn', text: 'Not enough data to score' }

  return (
    <div className="scan-body">
      <div className="scan-headline">
        <div className={`scan-score ${value >= 7 ? 'good' : value >= 4 ? 'mid' : 'low'}`}>
          {value != null ? value : '—'}
          <span>/10</span>
        </div>
        <div className={`scan-verdict ${verdict.cls}`}>{verdict.text}</div>
      </div>

      {factors.length > 0 && (
        <div className="scan-section">
          <div className="scan-title">Score breakdown</div>
          {factors.map(f => (
            <div key={f.id} className="factor-row">
              <span className="factor-k">{f.id}</span>
              <span className="factor-bar">
                <span className="factor-fill" style={{ width: `${Math.round(100 * (f.points / Math.max(1, f.max)))}%` }} />
              </span>
              <span className="factor-v mono">{f.points}/{f.max}</span>
            </div>
          ))}
        </div>
      )}

      {flags.length > 0 && (
        <div className="scan-section">
          <div className="scan-title">Flags</div>
          <ul className="scan-flags">
            {flags.map((f, i) => (
              <li key={f.k || i}>
                <span className="flag-dots mono">−{f.points}</span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {appliedCaps.length > 0 && (
        <div className="scan-section">
          <div className="scan-title">Penalties applied</div>
          <ul className="scan-flags">
            {appliedCaps.map(c => (
              <li key={c.id}><span className="flag-dots mono">cap</span>{c.id} (max {c.limit})</li>
            ))}
          </ul>
        </div>
      )}

      <div className="scan-section">
        <div className="scan-title">On-chain facts</div>
        <div className="scan-facts">
          <div className="fact"><span className="fact-k">Buyers</span><span className="fact-v mono">{facts.buyers ?? '—'}</span></div>
          <div className="fact"><span className="fact-k">Sellers</span><span className="fact-v mono">{facts.sellers ?? '—'}</span></div>
          <div className="fact">
            <span className="fact-k">Dev holding</span>
            <span className={`fact-v mono ${facts.devPct > 5 ? 'bad' : ''}`}>{facts.devPct != null ? `${facts.devPct}%` : '—'}</span>
          </div>
          <div className="fact"><span className="fact-k">Dev burned</span><span className="fact-v">{facts.devBurned ? 'Yes' : 'No'}</span></div>
          <div className="fact">
            <span className="fact-k">Snipers</span>
            <span className={`fact-v mono ${facts.snipersPct > 10 ? 'bad' : ''}`}>{facts.snipersPct != null ? `${facts.snipersPct}%` : '—'}</span>
          </div>
          <div className="fact">
            <span className="fact-k">Buy tax</span>
            <span className={`fact-v mono ${(facts.creatorTaxBps ?? 0) > 500 ? 'bad' : ''}`}>{facts.creatorTaxBps != null ? `${(facts.creatorTaxBps / 100).toFixed(2)}%` : '—'}</span>
          </div>
          <div className="fact"><span className="fact-k">Tax exempt</span><span className="fact-v">{facts.taxExempt ? 'Yes' : 'No'}</span></div>
          <div className="fact"><span className="fact-k">Smart wallets</span><span className="fact-v mono">{facts.smartWallets ?? '—'}</span></div>
          {d.ageMin != null && <div className="fact"><span className="fact-k">Age</span><span className="fact-v mono">{fmtAge(d.ageMin)}</span></div>}
          {d.curvePct != null && <div className="fact"><span className="fact-k">Curve</span><span className="fact-v mono">{d.graduated ? 'Graduated' : `${d.curvePct}%`}</span></div>}
        </div>
      </div>

      <div className="scan-section">
        <div className="scan-title">Launchpad</div>
        {lp.status === 'loading' && <div className="dim">Checking token creator…</div>}
        {lp.status === 'error' && <div className="dim">Creator lookup unavailable.</div>}
        {lp.status === 'ready' && (lp.data?.launchpad ? (
          <>
            <div className="scan-verdict good">Launched via {lp.data.launchpad}</div>
            <div className="scan-facts">
              {lp.data.creator && (
                <div className="fact">
                  <span className="fact-k">Creator</span>
                  <a className="fact-v mono" href={`https://robinhoodchain.blockscout.com/address/${lp.data.creator}`} target="_blank" rel="noreferrer">
                    {lp.data.creator.slice(0, 6)}…{lp.data.creator.slice(-4)} ↗
                  </a>
                </div>
              )}
              {lp.data.factory && (
                <div className="fact">
                  <span className="fact-k">Factory</span>
                  <a className="fact-v mono" href={`https://robinhoodchain.blockscout.com/address/${lp.data.factory}`} target="_blank" rel="noreferrer">
                    {lp.data.factory.slice(0, 6)}…{lp.data.factory.slice(-4)} ↗
                  </a>
                </div>
              )}
              {lp.data.contractName && <div className="fact"><span className="fact-k">Contract</span><span className="fact-v mono">{lp.data.contractName}</span></div>}
            </div>
          </>
        ) : (
          <p className="scan-note">Not created by a known launchpad factory — unknown origin.</p>
        ))}
      </div>

      {d.socials && (d.socials.x || d.socials.site || d.socials.tg) && (
        <div className="scan-section">
          <div className="scan-title">Links</div>
          <div className="scan-links">
            {d.socials.x && <a href={d.socials.x} target="_blank" rel="noreferrer">X ↗</a>}
            {d.socials.site && <a href={d.socials.site} target="_blank" rel="noreferrer">Website ↗</a>}
            {d.socials.tg && <a href={d.socials.tg} target="_blank" rel="noreferrer">Telegram ↗</a>}
          </div>
        </div>
      )}

      <div className="scan-source dim">Source: Quoro token analysis · updated live</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Terminal: chart + order ticket + security scan                      */
/* ------------------------------------------------------------------ */

export default function TradeTerminal({ token, onClose }) {
  const [range, setRange] = useState('1D')
  const [tab, setTab] = useState(token.ticker ? 'trade' : 'scan')
  const ca = token.ca || token.address
  const { status, candles, pool, retry } = useCandles(ca, range)
  const [session, setSession] = useState(() => marketSession())
  const isStock = Boolean(token.ticker)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  useEffect(() => {
    if (!isStock) return
    const i = setInterval(() => setSession(marketSession()), 60000)
    return () => clearInterval(i)
  }, [isStock])

  const symbol = token.symbol || token.ticker
  const change = token.change24h

  return createPortal(
    <div className="chart-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="chart-panel tt-panel" role="dialog" aria-label={`${symbol} trade terminal`}>
        <div className="chart-head">
          {token.logo
            ? <img className="tok-logo" src={token.logo} alt="" />
            : <span className="tok-logo tok-logo-fallback">{symbol.slice(0, 2)}</span>}
          <div className="chart-id">
            <div className="micro-label chart-eyebrow"><span className="live-dot" />Robinhood · 4663</div>
            <div className="chart-name"><strong>{symbol}</strong> <span className="muted">{token.name}</span></div>
            <div className="chart-addr mono dim">{ca.slice(0, 6)}…{ca.slice(-4)}</div>
          </div>
          <div className="chart-quote">
            <span className="chart-price mono">{fmtPrice(token.priceUsd)}</span>
            {change != null && (
              <span className={`chart-chip ${change > 0 ? 'up' : change < 0 ? 'down' : ''}`}>
                {change > 0 ? '+' : ''}{change.toFixed(2)}%
              </span>
            )}
          </div>
          <button type="button" className="pill pill-ghost xs chart-close" onClick={onClose} aria-label="Close terminal">✕</button>
        </div>

        <div className="chart-stats">
          {token.vol24h != null && <span>Vol 24h <b className="mono">{fmtVol(token.vol24h)}</b></span>}
          {token.mcap != null && <span>Mc cap <b className="mono">{fmtVol(token.mcap)}</b></span>}
          {token.ageMin != null && <span>Age <b className="mono">{fmtAge(token.ageMin)}</b></span>}
          {token.score != null && (
            <span>
              Data score{' '}
              <b className={`score-badge ${token.flagged ? 'flagged' : token.score >= 7 ? 'good' : token.score >= 4 ? 'mid' : 'low'}`}>
                {token.score}
              </b>
            </span>
          )}
          {pool && <span className="dim">Pool · {pool}</span>}
          {isStock && <span className={`session-badge sess-${session}`} title="US equity session (ET)">{SESSIONS[session].label}</span>}
        </div>

        <div className="tt-body">
          <div className="tt-chart">
            <div className="range-tabs">
              {RANGES.map(r => (
                <button
                  key={r}
                  type="button"
                  className={`pill xs range-tab ${r === range ? 'active' : ''}`}
                  onClick={() => setRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="chart-stage">
              {status === 'loading' && <div className="chart-skel" />}
              {status === 'error' && (
                <div className="chart-empty">
                  Chart failed to load.{' '}
                  <button type="button" className="pill pill-ghost xs" onClick={retry}>Retry</button>
                </div>
              )}
              {status === 'empty' && (
                <div className="chart-empty">
                  No pool history yet — this token is still on the bonding curve.
                  <br />
                  <span className="dim">Live price only.</span>
                </div>
              )}
              {status === 'ready' && (
                <ChartSvg key={`${range}-${candles.length}`} candles={candles} range={range} />
              )}
            </div>
          </div>

          <aside className="tt-rail">
            <div className="tt-tabs">
              <button
                type="button"
                className={`pill xs tt-tab ${tab === 'trade' ? 'active' : ''}`}
                onClick={() => setTab('trade')}
              >
                Trade
              </button>
              <button
                type="button"
                className={`pill xs tt-tab ${tab === 'scan' ? 'active' : ''}`}
                onClick={() => setTab('scan')}
              >
                Security
              </button>
            </div>
            {tab === 'trade'
              ? (
                <>
                  {!isStock && <NuraScan ca={ca} compact onDetails={() => setTab('scan')} />}
                  <TradeTicket token={token} onClose={onClose} />
                </>
              )
              : (
                <div className="scan-stack">
                  {!isStock && <NuraScan ca={ca} />}
                  <SecurityScan token={token} />
                </div>
              )}
          </aside>
        </div>
      </div>
    </div>,
    document.body
  )
}
