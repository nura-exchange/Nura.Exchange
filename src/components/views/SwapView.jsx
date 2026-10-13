import { useState, useEffect, useRef, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useAppState } from '../../context/useAppState'
import { useStocks, useEthPrice, useChainTokens, USDG, ETH_TOKEN } from '../../hooks/useMarkets'
import { useTokenBalance, useNativeBalance } from '../../hooks/useTokenBalance'
import { useExecuteSwap } from '../../hooks/useExecuteSwap'
import { USDG_ADDRESS, robinhoodChain, NATIVE } from '../../config'
import { getQuote, quoteError, remember, parseUnits, formatUnits, txUrl } from '../../lib/trade'
import { getRelayQuote, RelayError } from '../../services/relay'

const SLIPPAGE = 1

const PAY_CHAINS = [
  { id: robinhoodChain.id, name: 'Robinhood Chain', short: 'Robinhood' },
  { id: 8453, name: 'Base', short: 'Base' },
  { id: 42161, name: 'Arbitrum', short: 'Arbitrum' },
  { id: 1, name: 'Ethereum', short: 'Ethereum' },
  { id: 10, name: 'Optimism', short: 'Optimism' },
]

function fmt(n, d = 4) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(d)
  return n.toFixed(6)
}

// A route is only signable when it stays on the chain we pay from and never
// sends more than the amount entered — the same checks Quoro runs server-side.
function relayRouteOk(q, chainId, amountWei) {
  const d = q?.steps?.[0]?.items?.[0]?.data
  if (!d?.to || !q.toAmount || q.toAmount === '0') return false
  if (d.chainId != null && Number(d.chainId) !== chainId) return false
  try { return BigInt(d.value || '0') <= amountWei } catch { return false }
}

function lifiRouteOk(q, chainId, amountWei) {
  const tx = q?.transactionRequest
  if (!tx?.to || !q?.estimate?.toAmount) return false
  if (tx.chainId != null && Number(tx.chainId) !== chainId) return false
  try { return BigInt(tx.value || '0') <= amountWei } catch { return false }
}

export default function SwapView() {
  const { address, isConnected, connector } = useAccount()
  const { notify, swapPrefill, setSwapPrefill } = useAppState()
  const { stocks } = useStocks()
  const { chainTokens } = useChainTokens()
  const ethPrice = useEthPrice()

  const [fromSel, setFromSel] = useState('ETH')
  const [payChainId, setPayChainId] = useState(robinhoodChain.id)
  const [chainMenuOpen, setChainMenuOpen] = useState(false)
  const [toToken, setToToken] = useState(null) // token object
  const [toPickerOpen, setToPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [amountIn, setAmountIn] = useState('')
  const [quote, setQuote] = useState(null) // LI.FI quote (local router, or cross-chain race winner)
  const [relayQuote, setRelayQuote] = useState(null) // Relay quote (cross-chain race winner)
  const [quoting, setQuoting] = useState(false)
  const [quoteErr, setQuoteErr] = useState(null)
  const [lastResult, setLastResult] = useState(null) // { url, destTxHash }
  const pickerRef = useRef(null)
  const chainRef = useRef(null)
  const reqId = useRef(0)
  const executingRef = useRef(false)

  const { execute, status: swapStatus, busy: swapBusy, reset: resetSwap } = useExecuteSwap()
  const phase = swapStatus?.phase ?? null

  const isCrossChain = payChainId !== robinhoodChain.id
  const payChain = PAY_CHAINS.find(c => c.id === payChainId)

  const fromToken = fromSel === 'ETH' ? ETH_TOKEN : USDG
  const nativeBal = useNativeBalance(payChainId)
  const usdgBal = useTokenBalance(USDG_ADDRESS, 6)
  const fromBalance = fromSel === 'ETH' ? nativeBal : usdgBal

  // prefill from Markets
  useEffect(() => {
    if (swapPrefill?.to) {
      setToToken(swapPrefill.to)
      setSwapPrefill(null)
      setQuote(null)
      setRelayQuote(null)
    }
  }, [swapPrefill, setSwapPrefill])

  useEffect(() => {
    if (!toToken) {
      const aapl = stocks.find(s => s.ticker === 'AAPL') || stocks[0]
      if (aapl) setToToken({ ...aapl, symbol: aapl.symbol || aapl.ticker, address: aapl.ca, decimals: 18 })
    }
  }, [stocks, toToken])

  // Quoro-sourced tokens carry no decimals — resolve them from LI.FI's token registry.
  useEffect(() => {
    if (!toToken?.address || toToken.decimals != null) return
    let alive = true
    const addr = toToken.address
    fetch(`https://li.quest/v1/token?chain=${robinhoodChain.id}&token=${addr}`)
      .then(r => r.json())
      .then(d => {
        if (alive && d?.decimals != null) {
          setToToken(t => (t && t.address === addr ? { ...t, decimals: d.decimals } : t))
        }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [toToken?.address, toToken?.decimals])

  useEffect(() => {
    function onDocClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setToPickerOpen(false)
      if (chainRef.current && !chainRef.current.contains(e.target)) setChainMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // Cross-chain pays in native ETH only (USDG lives behind Robinhood Chain's address).
  useEffect(() => {
    if (isCrossChain && fromSel !== 'ETH') setFromSel('ETH')
  }, [isCrossChain, fromSel])

  const parsedIn = useMemo(() => {
    try {
      return amountIn ? parseUnits(amountIn, fromToken.decimals) : 0n
    } catch {
      return 0n
    }
  }, [amountIn, fromToken])

  const tooBig = parsedIn > fromBalance.value

  function setPct(pct) {
    // keep a small ETH reserve for gas when spending the full native balance
    const reserve = fromSel === 'ETH' && pct === 1 ? 0.0005 : 0
    const v = Math.max(0, fromBalance.balance * pct - reserve)
    const dec = fromSel === 'ETH' ? 6 : 4
    const f = 10 ** dec
    setAmountIn(v > 0 ? String(Math.floor(v * f) / f) : '')
    setQuote(null)
    setRelayQuote(null)
  }

  const amountNum = parseFloat(amountIn)
  const payUsd = Number.isFinite(amountNum) && amountNum > 0
    ? (fromSel === 'ETH' ? (ethPrice ? amountNum * ethPrice : null) : amountNum)
    : null
  const sameToken = toToken && fromToken.address.toLowerCase() === toToken.address?.toLowerCase()

  // quote (debounced): local router on Robinhood Chain; Relay vs LI.FI race from other chains
  useEffect(() => {
    setQuote(null)
    setRelayQuote(null)
    setQuoteErr(null)
    if (!toToken || parsedIn <= 0n || sameToken) return
    const id = ++reqId.current
    const from = address || '0x000000000000000000000000000000000000dEaD'
    setQuoting(true)
    const t = setTimeout(() => {
      if (!isCrossChain) {
        getQuote({
          fromChain: robinhoodChain.id,
          toChain: robinhoodChain.id,
          fromToken: fromToken.address,
          toToken: toToken.address,
          fromAmount: parsedIn.toString(),
          fromAddress: from,
          slippage: SLIPPAGE,
        })
          .then(q => { if (id === reqId.current) { setQuote(q); setQuoteErr(null) } })
          .catch(e => { if (id === reqId.current) setQuoteErr(quoteError(e)) })
          .finally(() => { if (id === reqId.current) setQuoting(false) })
      } else {
        // Race Relay and LI.FI in parallel and keep the route that delivers more
        // (Quoro's approach); a failure on one side hands the win to the other.
        ;(async () => {
          const [relayRes, lifiRes] = await Promise.allSettled([
            getRelayQuote({
              user: from,
              originChainId: payChainId,
              destinationChainId: robinhoodChain.id,
              originCurrency: NATIVE,
              destinationCurrency: toToken.address,
              amount: parsedIn.toString(),
              tradeType: 'EXACT_INPUT',
            }),
            getQuote({
              fromChain: payChainId,
              toChain: robinhoodChain.id,
              fromToken: NATIVE,
              toToken: toToken.address,
              fromAmount: parsedIn.toString(),
              fromAddress: from,
              slippage: SLIPPAGE,
            }),
          ])
          if (id !== reqId.current) return
          const relayQ = relayRes.status === 'fulfilled' && relayRouteOk(relayRes.value, payChainId, parsedIn)
            ? relayRes.value : null
          const lifiQ = lifiRes.status === 'fulfilled' && lifiRouteOk(lifiRes.value, payChainId, parsedIn)
            ? lifiRes.value : null
          if (relayQ && lifiQ) {
            if (BigInt(relayQ.toAmount) >= BigInt(lifiQ.estimate.toAmount)) {
              setRelayQuote(relayQ); setQuote(null)
            } else {
              setQuote(lifiQ); setRelayQuote(null)
            }
          } else if (relayQ) {
            setRelayQuote(relayQ); setQuote(null)
          } else if (lifiQ) {
            setQuote(lifiQ); setRelayQuote(null)
          } else {
            const relayErr = relayRes.status === 'rejected' ? relayRes.reason : null
            const lifiErr = lifiRes.status === 'rejected' ? lifiRes.reason : null
            // "token not in Relay's registry" is not the interesting error when LI.FI also failed
            const primary = relayErr && !(relayErr instanceof RelayError && relayErr.code === 'unsupported_currency')
              ? relayErr : lifiErr
            setQuoteErr(primary ? (primary instanceof RelayError ? primary.message : quoteError(primary)) : 'No route found')
          }
          setQuoting(false)
        })().catch(() => { if (id === reqId.current) setQuoting(false) })
      }
    }, 550)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountIn, toToken, fromToken, address, sameToken, payChainId, isCrossChain])

  const hasQuote = !!(relayQuote || quote)
  const outAmount = relayQuote
    ? formatUnits(BigInt(relayQuote.toAmount), relayQuote.toDecimals)
    : quote?.estimate?.toAmount
      ? formatUnits(BigInt(quote.estimate.toAmount), toToken?.decimals ?? 18)
      : null
  const minAmount = quote?.estimate?.toAmountMin
    ? formatUnits(BigInt(quote.estimate.toAmountMin), toToken?.decimals ?? 18)
    : null
  const gasUsd = quote?.estimate?.gasCosts?.find(g => g.amountUSD)?.amountUSD
  const feeUsd = relayQuote?.feeUsd ?? (gasUsd ? parseFloat(gasUsd) : null)
  const impact = relayQuote
    ? relayQuote.priceImpact
    : quote?.estimate?.priceImpact ?? quote?.impact ?? null
  // Relay returns slippageTolerance.total in basis points (200 = 2%)
  const slippageTol = relayQuote?.details?.slippageTolerance
  const relaySlippagePct = slippageTol?.total != null && `${slippageTol.total}` !== ''
    ? Number(slippageTol.total) / 100
    : slippageTol?.destination?.percent != null && slippageTol.destination.percent !== ''
      ? parseFloat(slippageTol.destination.percent)
      : null
  const routeLabel = relayQuote
    ? 'Relay (Cross-chain 1-click)'
    : quote?.toolDetails?.name || quote?.tool || null

  async function onExecute() {
    if (!isConnected || !connector || !address) {
      notify('Wallet', 'Connect your wallet first', 'error')
      return
    }
    if (executingRef.current || swapBusy || quoting || !hasQuote || tooBig || parsedIn <= 0n || sameToken) return
    executingRef.current = true
    setLastResult(null)
    try {
      const res = await execute({ originChainId: payChainId, quote, relayQuote })
      remember(address, {
        ts: Date.now(),
        side: 'swap',
        symbol: toToken.symbol,
        ca: toToken.address,
        name: toToken.name || toToken.symbol,
        inSymbol: fromToken.symbol,
        amountIn,
        out: outAmount ? fmt(parseFloat(outAmount), 6) : null,
        outSymbol: toToken.symbol,
        txHash: res.txHash,
        url: res.url,
        status: 'done',
      })
      const outText = outAmount ? fmt(parseFloat(outAmount), 6) : '?'
      if (res.destTxHash) {
        notify('Swap Delivered', `${amountIn} ${fromToken.symbol} → ${outText} ${toToken.symbol} on Robinhood Chain`, 'success')
      } else {
        notify('Swap Confirmed', `${amountIn} ${fromToken.symbol} → ~${outText} ${toToken.symbol}`, 'success')
      }
      setLastResult({ url: res.url, destTxHash: res.destTxHash ? txUrl(res.destTxHash) : null })
      setAmountIn('')
      setQuote(null)
      setRelayQuote(null)
      window.dispatchEvent(new Event('nura:refresh'))
    } catch (e) {
      notify('Swap Failed', e instanceof RelayError ? e.message : quoteError(e), 'error')
    } finally {
      executingRef.current = false
      resetSwap()
    }
  }

  const busy = swapBusy || ['switch', 'approve', 'sign', 'pending', 'delivering'].includes(phase)
  const phaseLabel = {
    switch: 'Switching network…',
    approve: 'Approving token…',
    sign: 'Confirm in wallet…',
    pending: 'Confirming…',
    delivering: swapStatus?.relayStatus === 'submitted' ? 'Delivering on Robinhood Chain…' : 'Bridging to Robinhood Chain…',
    done: 'Delivered',
  }[phase] || null

  const toList = useMemo(() => {
    const core = [ETH_TOKEN, USDG].map(t => ({
      ...t,
      logo: t.symbol === 'USDG' ? 'https://s2.coinmarketcap.com/static/img/coins/64x64/33793.png' : null,
      priceUsd: t.symbol === 'ETH' ? ethPrice : 1,
      change24h: null,
      spark: [],
    }))
    const st = stocks.map(s => ({ ...s, symbol: s.symbol || s.ticker, address: s.ca, decimals: 18 }))
    const seen = new Set(st.map(t => t.address.toLowerCase()))
    const ct = chainTokens
      .filter(t => t.ca && !seen.has(t.ca.toLowerCase()))
      .map(t => ({ ...t, ticker: t.symbol, address: t.ca, decimals: t.decimals ?? null, spark: [] }))
    const all = [...core.filter(c => c.address.toLowerCase() !== fromToken.address.toLowerCase()), ...st, ...ct]
    const q = pickerQuery.trim().toLowerCase()
    if (!q) return all
    return all.filter(t =>
      (t.symbol || t.ticker || '').toLowerCase().includes(q) || (t.name || '').toLowerCase().includes(q)
    )
  }, [stocks, chainTokens, ethPrice, fromToken, pickerQuery])

  return (
    <div className="container view split">
      <aside className="split-aside reveal">
        <h1 className="section-heading">Swap</h1>
        <p className="section-note">
          Tokenized stocks, stables and crypto — routed through LI.FI across Robinhood Chain liquidity.
          Pay from Base, Arbitrum, Ethereum or Optimism and Relay delivers in one click.
        </p>
        <ul className="split-meta">
          <li><span>Routing</span><span>{isCrossChain ? 'Relay · cross-chain 1-click' : 'LI.FI · best price'}</span></li>
          <li><span>Custody</span><span>Self — your keys only</span></li>
          <li><span>Slippage</span><span>{SLIPPAGE}%</span></li>
        </ul>
      </aside>

      <div className="split-main reveal reveal-d1">
      <div className="trade-card">
        <div className="field">
          <div className="field-top">
            <span className="label">You pay{isCrossChain ? ` — from ${payChain?.name}` : ''}</span>
            <span className="balance-line">Balance: {fmt(fromBalance.balance, 4)} {fromToken.symbol}{isCrossChain ? ` · ${payChain?.short}` : ''}</span>
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
              <div className="token-picker" ref={chainRef}>
                <button
                  type="button"
                  className="pill token-pill"
                  onClick={() => setChainMenuOpen(o => !o)}
                >
                  {payChain?.short || 'Chain'}
                  <span className="chev">▾</span>
                </button>
                {chainMenuOpen && (
                  <div className="picker-menu chain-menu">
                    <div className="picker-list">
                      {PAY_CHAINS.map(c => (
                        <button
                          type="button"
                          key={c.id}
                          className={`picker-item ${payChainId === c.id ? 'active' : ''}`}
                          onClick={() => { setPayChainId(c.id); setChainMenuOpen(false); setQuote(null); setRelayQuote(null) }}
                        >
                          <span className="picker-sym">{c.short}</span>
                          <span className="picker-name">{c.id === robinhoodChain.id ? 'Swap locally' : 'Cross-chain via Relay'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {['ETH', 'USDG'].map(sym => (
                <button
                  key={sym}
                  type="button"
                  className={`pill token-pill ${fromSel === sym ? 'active' : ''}`}
                  disabled={isCrossChain && sym !== 'ETH'}
                  onClick={() => { setFromSel(sym); setQuote(null); setRelayQuote(null) }}
                >
                  {sym}
                </button>
              ))}
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
          {tooBig && <div className="field-note">Insufficient {fromToken.symbol} balance{isCrossChain ? ` on ${payChain?.name}` : ''}</div>}
        </div>

        <div className="swap-arrow" aria-hidden="true">↓</div>

        <div className="field">
          <div className="field-top">
            <span className="label">You receive — on Robinhood Chain</span>
          </div>
          <div className="field-row">
            <div className="amount-output">{hasQuote ? fmt(parseFloat(outAmount || '0'), 6) : <span className="dim">—</span>}</div>
            <div className="token-picker" ref={pickerRef}>
              <button type="button" className="pill token-pill wide" onClick={() => setToPickerOpen(o => !o)}>
                {toToken ? toToken.symbol : 'Select'}
                <span className="chev">▾</span>
              </button>
              {toPickerOpen && (
                <div className="picker-menu">
                  <input
                    className="picker-search"
                    placeholder="Search ticker…"
                    value={pickerQuery}
                    onChange={e => setPickerQuery(e.target.value)}
                    autoFocus
                  />
                  <div className="picker-list">
                    {toList.map(t => (
                      <button
                        type="button"
                        key={t.address}
                        className={`picker-item ${toToken?.ca === t.ca && toToken?.address === t.address ? 'active' : ''}`}
                        onClick={() => { setToToken({ ...t, symbol: t.symbol || t.ticker, ca: t.ca || t.address }); setToPickerOpen(false); setQuote(null); setRelayQuote(null) }}
                      >
                        <span className="picker-sym">{t.symbol || t.ticker}</span>
                        <span className="picker-name">{t.name}</span>
                        {t.priceUsd != null && <span className="picker-price">${fmt(t.priceUsd, 2)}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="field-note">
            {quoting && (isCrossChain ? 'Finding cross-chain route…' : 'Finding best route…')}
            {!quoting && quoteErr && quoteErr}
            {!quoting && !quoteErr && hasQuote && (
              <>1 {fromToken.symbol} ≈ {fmt(parseFloat(outAmount || '0') / parseFloat(amountIn || '1'), 4)} {toToken?.symbol} · route: {routeLabel}</>
            )}
          </div>
        </div>

        {hasQuote && !quoteErr && (
          <div className="quote-lines">
            {relayQuote ? (
              <>
                <div className="q-line"><span>Route</span><span>Relay — cross-chain 1-click</span></div>
                <div className="q-line"><span>Network + relay fee</span><span>{feeUsd != null ? `$${fmt(feeUsd, 2)}` : '—'}</span></div>
                {impact != null && <div className="q-line"><span>Price impact</span><span>{fmt(impact, 2)}%</span></div>}
                {relayQuote.timeEstimate != null && (
                  <div className="q-line"><span>Est. delivery</span><span>{relayQuote.timeEstimate >= 60 ? `~${Math.ceil(relayQuote.timeEstimate / 60)} min` : `~${relayQuote.timeEstimate} sec`}</span></div>
                )}
                <div className="q-line"><span>Slippage</span><span>{relaySlippagePct != null ? `${relaySlippagePct}%` : 'Auto'}</span></div>
              </>
            ) : (
              <>
                <div className="q-line"><span>Minimum received</span><span>{fmt(parseFloat(minAmount || '0'), 6)} {toToken?.symbol}</span></div>
                <div className="q-line"><span>Network fee</span><span>{feeUsd != null ? `$${fmt(feeUsd, 2)}` : '—'}</span></div>
                {impact != null && <div className="q-line"><span>Price impact</span><span>{fmt(parseFloat(impact), 2)}%</span></div>}
                <div className="q-line"><span>Slippage</span><span>{SLIPPAGE}%</span></div>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          className="pill pill-primary trade-cta"
          disabled={busy || quoting || !hasQuote || tooBig || parsedIn <= 0n || sameToken}
          onClick={onExecute}
        >
          {!isConnected ? 'Connect wallet to swap'
            : busy ? phaseLabel
              : !amountIn ? 'Enter an amount'
                : sameToken ? 'Choose another token'
                  : tooBig ? 'Insufficient balance'
                    : quoteErr ? 'No route — try another pair'
                      : !hasQuote ? 'Fetching quote…'
                        : isCrossChain ? `Swap ${fromToken.symbol} from ${payChain?.short} for ${toToken?.symbol}`
                          : `Swap ${fromToken.symbol} for ${toToken?.symbol}`}
        </button>

        {lastResult?.url && (
          <div className="tx-link-row">
            <a href={lastResult.url} target="_blank" rel="noreferrer">
              View {lastResult.destTxHash ? 'deposit' : 'transaction'} on explorer ↗
            </a>
            {lastResult.destTxHash && (
              <> · <a href={lastResult.destTxHash} target="_blank" rel="noreferrer">View delivery ↗</a></>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
