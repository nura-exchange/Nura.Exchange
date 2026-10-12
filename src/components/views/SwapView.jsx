import { useState, useEffect, useRef, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useAppState } from '../../context/useAppState'
import { useStocks, useEthPrice, USDG, ETH_TOKEN } from '../../hooks/useMarkets'
import { useTokenBalance, useNativeBalance } from '../../hooks/useTokenBalance'
import { USDG_ADDRESS, robinhoodChain } from '../../config'
import { getQuote, executeQuote, quoteError, remember, parseUnits, formatUnits, txUrl } from '../../lib/trade'

const SLIPPAGE = 1

function fmt(n, d = 4) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(d)
  return n.toFixed(6)
}

export default function SwapView() {
  const { address, isConnected, connector } = useAccount()
  const { notify, swapPrefill, setSwapPrefill } = useAppState()
  const { stocks } = useStocks()
  const ethPrice = useEthPrice()

  const [fromSel, setFromSel] = useState('ETH')
  const [toToken, setToToken] = useState(null) // token object
  const [toPickerOpen, setToPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [amountIn, setAmountIn] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [quoteErr, setQuoteErr] = useState(null)
  const [phase, setPhase] = useState(null) // null | 'switch' | 'approve' | 'sign' | 'pending' | 'done'
  const [lastHash, setLastHash] = useState(null)
  const pickerRef = useRef(null)
  const reqId = useRef(0)

  const fromToken = fromSel === 'ETH' ? ETH_TOKEN : USDG
  const nativeBal = useNativeBalance()
  const usdgBal = useTokenBalance(USDG_ADDRESS, 6)
  const fromBalance = fromSel === 'ETH' ? nativeBal : usdgBal

  // prefill from Markets
  useEffect(() => {
    if (swapPrefill?.to) {
      setToToken(swapPrefill.to)
      setSwapPrefill(null)
      setQuote(null)
    }
  }, [swapPrefill, setSwapPrefill])

  useEffect(() => {
    if (!toToken) {
      const aapl = stocks.find(s => s.ticker === 'AAPL') || stocks[0]
      if (aapl) setToToken({ ...aapl, address: aapl.ca, decimals: 18 })
    }
  }, [stocks, toToken])

  useEffect(() => {
    function onDocClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setToPickerOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const parsedIn = useMemo(() => {
    try {
      return amountIn ? parseUnits(amountIn, fromToken.decimals) : 0n
    } catch {
      return 0n
    }
  }, [amountIn, fromToken])

  const tooBig = parsedIn > fromBalance.value
  const sameToken = toToken && fromToken.address.toLowerCase() === toToken.address?.toLowerCase()

  // quote (debounced)
  useEffect(() => {
    setQuote(null)
    setQuoteErr(null)
    if (!toToken || parsedIn <= 0n || sameToken) return
    const id = ++reqId.current
    const from = address || '0x000000000000000000000000000000000000dEaD'
    setQuoting(true)
    const t = setTimeout(() => {
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
    }, 550)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountIn, toToken, fromToken, address, sameToken])

  const outAmount = quote?.estimate?.toAmount ? formatUnits(BigInt(quote.estimate.toAmount), toToken?.decimals ?? 18) : null
  const minAmount = quote?.estimate?.toAmountMin ? formatUnits(BigInt(quote.estimate.toAmountMin), toToken?.decimals ?? 18) : null
  const gasUsd = quote?.estimate?.gasCosts?.find(g => g.amountUSD)?.amountUSD
  const routeTool = quote?.toolDetails?.name || quote?.tool
  const impact = quote?.estimate?.priceImpact ?? quote?.impact ?? null

  async function onExecute() {
    if (!isConnected || !connector || !address) {
      notify('Wallet', 'Connect your wallet first', 'error')
      return
    }
    if (!quote || phase === 'switch' || phase === 'approve' || phase === 'sign' || phase === 'pending') return
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
        side: 'swap',
        symbol: toToken.symbol,
        ca: toToken.address,
        name: toToken.name || toToken.symbol,
        inSymbol: fromToken.symbol,
        amountIn,
        out: outAmount ? fmt(parseFloat(outAmount), 6) : null,
        outSymbol: toToken.symbol,
        txHash: hash,
        url: txUrl(hash),
        status: 'done',
      })
      notify('Swap Confirmed', `${amountIn} ${fromToken.symbol} → ~${outAmount ? fmt(parseFloat(outAmount), 6) : '?'} ${toToken.symbol}`, 'success')
      setAmountIn('')
      setQuote(null)
      window.dispatchEvent(new Event('nura:refresh'))
    } catch (e) {
      notify('Swap Failed', quoteError(e), 'error')
    } finally {
      setPhase(null)
    }
  }

  const busy = ['switch', 'approve', 'sign', 'pending'].includes(phase)
  const phaseLabel = {
    switch: 'Switching network…',
    approve: 'Approving token…',
    sign: 'Confirm in wallet…',
    pending: 'Confirming…',
    done: 'Confirmed',
  }[phase] || null

  const toList = useMemo(() => {
    const core = [ETH_TOKEN, USDG].map(t => ({
      ...t,
      logo: t.symbol === 'USDG' ? 'https://s2.coinmarketcap.com/static/img/coins/64x64/33793.png' : null,
      priceUsd: t.symbol === 'ETH' ? ethPrice : 1,
      change24h: null,
      spark: [],
    }))
    const st = stocks.map(s => ({ ...s, address: s.ca, decimals: 18 }))
    const all = [...core.filter(c => c.address.toLowerCase() !== fromToken.address.toLowerCase()), ...st]
    const q = pickerQuery.trim().toLowerCase()
    if (!q) return all
    return all.filter(t =>
      (t.symbol || t.ticker || '').toLowerCase().includes(q) || (t.name || '').toLowerCase().includes(q)
    )
  }, [stocks, ethPrice, fromToken, pickerQuery])

  return (
    <div className="container view split">
      <aside className="split-aside">
        <h1 className="section-heading">Swap</h1>
        <p className="section-note">
          Tokenized stocks, stables and crypto — routed through LI.FI across Robinhood Chain liquidity.
          You sign every transaction yourself.
        </p>
        <ul className="split-meta">
          <li><span>Routing</span><span>LI.FI · best price</span></li>
          <li><span>Custody</span><span>Self — your keys only</span></li>
          <li><span>Slippage</span><span>{SLIPPAGE}%</span></li>
        </ul>
      </aside>

      <div className="split-main">
      <div className="trade-card">
        <div className="field">
          <div className="field-top">
            <span className="label">You pay</span>
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
              {['ETH', 'USDG'].map(sym => (
                <button
                  key={sym}
                  type="button"
                  className={`pill token-pill ${fromSel === sym ? 'active' : ''}`}
                  onClick={() => { setFromSel(sym); setQuote(null) }}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
          {tooBig && <div className="field-note">Insufficient {fromToken.symbol} balance</div>}
        </div>

        <div className="swap-arrow" aria-hidden="true">↓</div>

        <div className="field">
          <div className="field-top">
            <span className="label">You receive</span>
          </div>
          <div className="field-row">
            <div className="amount-output">{quote ? fmt(parseFloat(outAmount || '0'), 6) : <span className="dim">—</span>}</div>
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
                        onClick={() => { setToToken({ ...t, ca: t.ca || t.address }); setToPickerOpen(false); setQuote(null) }}
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
            {quoting && 'Finding best route…'}
            {!quoting && quoteErr && quoteErr}
            {!quoting && !quoteErr && quote && (
              <>1 {fromToken.symbol} ≈ {fmt(parseFloat(outAmount || '0') / parseFloat(amountIn || '1'), 4)} {toToken?.symbol} · route: {routeTool}</>
            )}
          </div>
        </div>

        {quote && !quoteErr && (
          <div className="quote-lines">
            <div className="q-line"><span>Minimum received</span><span>{fmt(parseFloat(minAmount || '0'), 6)} {toToken?.symbol}</span></div>
            <div className="q-line"><span>Network fee</span><span>{gasUsd ? `$${fmt(parseFloat(gasUsd), 2)}` : '—'}</span></div>
            {impact != null && <div className="q-line"><span>Price impact</span><span>{fmt(parseFloat(impact), 2)}%</span></div>}
            <div className="q-line"><span>Slippage</span><span>{SLIPPAGE}%</span></div>
          </div>
        )}

        <button
          type="button"
          className="pill pill-primary trade-cta"
          disabled={busy || quoting || !quote || tooBig || parsedIn <= 0n || sameToken}
          onClick={onExecute}
        >
          {!isConnected ? 'Connect wallet to swap'
            : busy ? phaseLabel
              : !amountIn ? 'Enter an amount'
                : sameToken ? 'Choose another token'
                  : tooBig ? 'Insufficient balance'
                    : quoteErr ? 'No route — try another pair'
                      : !quote ? 'Fetching quote…'
                        : `Swap ${fromToken.symbol} for ${toToken?.symbol}`}
        </button>

        {lastHash && (
          <div className="tx-link-row">
            <a href={txUrl(lastHash)} target="_blank" rel="noreferrer">View transaction on Blockscout ↗</a>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
