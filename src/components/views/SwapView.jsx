import { useState, useEffect, useRef, useMemo } from 'react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { useUsdcBalance } from '../../hooks/useUsdcBalance'
import { useEurcBalance } from '../../hooks/useEurcBalance'
import { useRouterLiquidity } from '../../hooks/useRouterLiquidity'
import { usePythRate } from '../../hooks/usePythRate'
import { useTokenBalance } from '../../hooks/useTokenBalance'
import { parseUnits, maxUint256, formatUnits, parseGwei } from 'viem'
import { ANCHOR_FX_ROUTER_ADDRESS, ANCHOR_FX_ROUTER_ABI, USDC_ADDRESS, EURC_ADDRESS, USYC_ADDRESS } from '../../config'
import { ERC20_ABI } from '../../abis'
import { useAppState } from '../../context/useAppState'
import TokenSelect from '../TokenSelect'

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1, 3]
const DEADLINE_MINUTES = 30

const TOKENS = {
  USDC: { address: USDC_ADDRESS, decimals: 6, label: 'USDC' },
  EURC: { address: EURC_ADDRESS, decimals: 6, label: 'EURC' },
  USYC: { address: USYC_ADDRESS, decimals: 6, label: 'USYC' },
}

export default function SwapView() {
  const { address } = useAccount()
  const { notify } = useAppState()
  const [amountIn, setAmountIn] = useState('')
  const [rate, setRate] = useState('0.924700')
  const [slippage, setSlippage] = useState(0.5)
  const [approveConfirmed, setApproveConfirmed] = useState(false)
  const actionRef = useRef(null)
  const pendingSwapRef = useRef(null)
  const pyth = usePythRate()

  const { balance: usdcBalance } = useUsdcBalance()
  const { balance: eurcBalance } = useEurcBalance()
  const { balance: usycBalance } = useTokenBalance(USYC_ADDRESS, 6)
  const routerLiq = useRouterLiquidity()
  const [depositToken, setDepositToken] = useState('EURC')
  const [depositAmount, setDepositAmount] = useState('')
  const [tokenInSel, setTokenInSel] = useState('USDC')
  const [tokenOutSel, setTokenOutSel] = useState('EURC')

  const tokenIn = TOKENS[tokenInSel].address
  const tokenOut = TOKENS[tokenOutSel].address
  const inSymbol = TOKENS[tokenInSel].label
  const outSymbol = TOKENS[tokenOutSel].label
  const inDecimals = TOKENS[tokenInSel].decimals
  const outDecimals = TOKENS[tokenOutSel].decimals
  const balances = { USDC: usdcBalance, EURC: eurcBalance, USYC: usycBalance }
  const balanceIn = balances[tokenInSel] || 0
  const balanceOut = balances[tokenOutSel] || 0

  useEffect(() => {
    const usdIn = tokenInSel === 'EURC' ? pyth.eurUsd : 1
    const usdOut = tokenOutSel === 'EURC' ? pyth.eurUsd : 1
    const r = tokenInSel === tokenOutSel ? 1 : usdIn / usdOut
    setRate(r.toFixed(6))
  }, [tokenInSel, tokenOutSel, pyth.eurUsd])

  const { data: writeResult, writeContract, isPending, isSuccess, error } = useWriteContract()
  const { data: receipt } = useWaitForTransactionReceipt({ hash: writeResult })
  const { data: allowance } = useReadContract({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, ANCHOR_FX_ROUTER_ADDRESS] : undefined,
    query: { enabled: !!address },
  })

  const parsedAmount = amountIn ? parseUnits(amountIn, inDecimals) : 0n
  const amountTooBig = parsedAmount > 0n && parseFloat(amountIn) > balanceIn
  const allowanceOk = allowance !== undefined && parsedAmount > 0n && allowance >= parsedAmount
  const needsApprove = !approveConfirmed && !allowanceOk

  const amountOut = useMemo(() => {
    if (!amountIn) return '0'
    const out = parseFloat(amountIn) * parseFloat(rate)
    const fee = out * 0.0005
    return (out - fee).toFixed(outDecimals === 6 ? 2 : 6)
  }, [amountIn, rate, outDecimals])

  const protocolFee = useMemo(() => {
    if (!amountIn) return '0'
    return (parseFloat(amountIn) * 0.0005).toFixed(inDecimals === 6 ? 2 : 6)
  }, [amountIn, inDecimals])

  const minOutParsed = useMemo(() => {
    if (!amountIn || !rate) return 0n
    const raw = parseFloat(amountIn) * parseFloat(rate)
    const fee = raw * 0.0005
    const afterSlippage = (raw - fee) * (1 - slippage / 100)
    return parseUnits(afterSlippage.toFixed(outDecimals), outDecimals)
  }, [amountIn, rate, slippage, outDecimals])

  useEffect(() => {
    if (!receipt) return
    if (actionRef.current === 'approve') {
      if (receipt.status === 'success') {
        setApproveConfirmed(true)
        window.dispatchEvent(new Event('anchorfx:refresh'))
        notify('Approval Confirmed', `${inSymbol} approved for AnchorFX Router`, 'success')
      } else {
        pendingSwapRef.current = null
        notify('Approval Failed', 'Transaction reverted on-chain', 'error')
      }
    }
    if (actionRef.current === 'swap') {
      if (receipt.status === 'success') {
        const trade = {
          time: new Date().toLocaleString(),
          type: `${inSymbol} → ${outSymbol}`,
          amount: amountIn,
          rate,
          status: 'Confirmed',
          hash: receipt.transactionHash,
        }
        const existing = JSON.parse(localStorage.getItem('anchorfx_trades') || '[]')
        existing.unshift(trade)
        localStorage.setItem('anchorfx_trades', JSON.stringify(existing))
        setAmountIn('')
        window.dispatchEvent(new Event('anchorfx:refresh'))
        notify('Swap Confirmed', `Swapped ${amountIn} ${inSymbol} → ${amountOut} ${outSymbol}`, 'success')
      } else {
        notify('Swap Failed', 'Transaction reverted on-chain. Check balance and try again.', 'error')
      }
    }
    actionRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt])

  // Auto-fire swap right after approval confirms
  useEffect(() => {
    if (approveConfirmed && pendingSwapRef.current) {
      actionRef.current = 'swap'
      const cfg = pendingSwapRef.current
      pendingSwapRef.current = null
      writeContract(cfg)
      notify('Swap Submitted', 'Executing swap automatically…', 'info')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveConfirmed])

  function buildSwapArgs() {
    return {
      address: ANCHOR_FX_ROUTER_ADDRESS,
      abi: ANCHOR_FX_ROUTER_ABI,
      functionName: 'swapFX',
      args: [tokenIn, tokenOut, parsedAmount, minOutParsed, parseUnits(rate, 18)],
      gas: 300000n,
      maxFeePerGas: parseGwei('20'),
      maxPriorityFeePerGas: parseGwei('1'),
    }
  }

  function handleApprove() {
    if (!amountIn || !address) return
    actionRef.current = 'approve'
    pendingSwapRef.current = buildSwapArgs()
      writeContract({
        address: tokenIn,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [ANCHOR_FX_ROUTER_ADDRESS, maxUint256],
        gas: 200000n,
        maxFeePerGas: parseGwei('20'),
        maxPriorityFeePerGas: parseGwei('1'),
      })
    notify('Approve Submitted', `Approving ${inSymbol} spend...`, 'info')
  }

  function handleSwap() {
    if (!amountIn) return
    actionRef.current = 'swap'
      writeContract(buildSwapArgs())
    notify('Swap Submitted', `${amountIn} ${inSymbol} → ~${amountOut} ${outSymbol}`, 'info')
  }

  function flipDirection() {
    setTokenInSel(tokenOutSel)
    setTokenOutSel(tokenInSel)
    setAmountIn('')
    setApproveConfirmed(false)
    pendingSwapRef.current = null
  }

  if (!address) {
    return (
      <div className="view-section swap-view-centered">
        <div className="view-head">
          <h2>Swap</h2>
          <span className="view-sub">Instant stablecoin exchange on Arc Network</span>
        </div>
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text3)' }}>
          <p style={{ fontSize: 15 }}>Connect your wallet to start swapping</p>
        </div>
      </div>
    )
  }

  return (
    <div className="view-section swap-view-centered">
      <div className="view-head">
        <h2>Swap</h2>
        <span className="view-sub">USDC ↔ EURC • 0.05% fee • &lt;0.4s settlement</span>
      </div>

      <div className="anchor-card">
        <div className="anchor-card-header">
          <span className="anchor-card-label">Exchange</span>
          <span className="anchor-settlement" style={{ color: pyth.error ? 'var(--red)' : 'var(--green)' }}>
            {pyth.error ? '● Oracle Offline' : '● Pyth Oracle'}
          </span>
        </div>

        <div className="anchor-swap-form">
          <div className="anchor-input-box">
            <div className="anchor-input-row">
              <span className="anchor-input-label">You Pay</span>
              <span className="anchor-balance">
                Balance: {balanceIn.toFixed(inDecimals === 6 ? 2 : 6)} {inSymbol}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className="anchor-input"
                type="number"
                placeholder="0.0"
                value={amountIn}
                onChange={e => { setAmountIn(e.target.value); pendingSwapRef.current = null }}
                style={{ flex: 1 }}
              />
              <TokenSelect
                value={tokenInSel}
                tokens={Object.keys(TOKENS)}
                onChange={e => {
                  setTokenInSel(e)
                  if (e === tokenOutSel) setTokenOutSel(tokenInSel)
                  setAmountIn('')
                  setApproveConfirmed(false)
                }}
              />
              <button
                onClick={() => setAmountIn(balanceIn > 0 ? balanceIn.toFixed(inDecimals === 6 ? 2 : 6) : '')}
                style={{
                  background: 'var(--s2)',
                  border: '0.5px solid var(--border)',
                  color: 'var(--accent)',
                  borderRadius: 8,
                  padding: '0 12px',
                  cursor: 'pointer',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                }}
              >MAX</button>
            </div>
            <span className="anchor-input-hint">{inSymbol} (Arc Network)</span>
          </div>

          <button
            onClick={flipDirection}
            style={{
              display: 'block',
              margin: '0.25rem auto',
              background: 'var(--s2)',
              border: '0.5px solid var(--border)',
              color: 'var(--text2)',
              borderRadius: '50%',
              width: 36,
              height: 36,
              fontSize: 16,
              cursor: 'pointer',
              lineHeight: '36px',
              textAlign: 'center',
            }}
          >↓↑</button>

          <div className="anchor-input-box" style={{ opacity: 0.9 }}>
            <div className="anchor-input-row">
              <span className="anchor-input-label">You Receive</span>
              <span className="anchor-balance">
                Balance: {balanceOut.toFixed(outDecimals === 6 ? 2 : 6)} {outSymbol}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className="anchor-input"
                type="text"
                readOnly
                value={amountOut}
                style={{ background: 'var(--s1)', flex: 1 }}
              />
              <TokenSelect
                value={tokenOutSel}
                tokens={Object.keys(TOKENS)}
                onChange={e => {
                  setTokenOutSel(e)
                  if (e === tokenInSel) setTokenInSel(tokenOutSel)
                  setAmountIn('')
                  setApproveConfirmed(false)
                }}
              />
            </div>
            <span className="anchor-input-hint">{outSymbol} (estimated)</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Rate</span>
            <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>
              1 {inSymbol} = {rate} {outSymbol}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Fee</span>
            <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--text2)' }}>
              {protocolFee} {inSymbol} (0.05%)
            </span>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Slippage Tolerance</span>
              <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--accent)' }}>{slippage}%</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {SLIPPAGE_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setSlippage(s)}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                    background: slippage === s ? 'var(--accent)' : 'var(--s2)',
                    color: slippage === s ? 'var(--bg)' : 'var(--text2)',
                    border: slippage === s ? 'none' : '0.5px solid var(--border)',
                    fontWeight: slippage === s ? 600 : 400,
                  }}
                >{s}%</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Min received</span>
            <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--text3)' }}>
              {minOutParsed > 0n ? formatUnits(minOutParsed, outDecimals) : '0'} {outSymbol}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Deadline</span>
            <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--text3)' }}>{DEADLINE_MINUTES}m</span>
          </div>

          {amountTooBig ? (
            <button className="anchor-swap-btn" disabled style={{ background: 'var(--s3)', color: 'var(--red)', cursor: 'not-allowed' }}>
              Insufficient {inSymbol} Balance
            </button>
          ) : routerLiq[tokenOutSel] <= 0 ? (
            <button className="anchor-swap-btn" disabled style={{ background: 'var(--s3)', color: 'var(--text3)', cursor: 'not-allowed' }}>
              Router has no {outSymbol} — deposit via Router Liquidity
            </button>
          ) : needsApprove ? (
            <button className="anchor-swap-btn" onClick={handleApprove} disabled={isPending}>
              {isPending ? 'Approving...' : `Approve ${inSymbol}`}
            </button>
          ) : (
            <button className="anchor-swap-btn" onClick={handleSwap} disabled={isPending || !amountIn}>
              {isPending ? 'Executing...' : `Swap ${inSymbol} → ${outSymbol}`}
            </button>
          )}

          {isSuccess && actionRef.current === null && (
            <p className="anchor-msg success">Transaction confirmed on Arc!</p>
          )}
          {error && (
            <p className="anchor-msg error">{error.shortMessage || error.message}</p>
          )}
        </div>

        <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--s1)', borderRadius: 10, border: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Router Liquidity</span>
            <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>
              {routerLiq.usdc.toFixed(2)} USDC · {routerLiq.eurc.toFixed(2)} EURC
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
            Contract needs both tokens to execute swaps. Deposit to enable trading.
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <TokenSelect
              value={depositToken}
              tokens={Object.keys(TOKENS)}
              onChange={e => { setDepositToken(e); setDepositAmount('') }}
            />
            <input
              className="anchor-input"
              type="number"
              placeholder="Amount"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
              style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
            />
            <button
              onClick={() => {
                const b = { EURC: eurcBalance, USDC: usdcBalance, USYC: usycBalance }[depositToken] || 0
                setDepositAmount(b > 0 ? b.toFixed(6) : '')
              }}
              style={{
                padding: '6px 12px', background: 'var(--s2)', border: '0.5px solid var(--border)',
                color: 'var(--accent)', borderRadius: 6, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >MAX</button>
            <button
              onClick={() => {
                const amt = parseFloat(depositAmount)
                if (!depositAmount || amt <= 0) return
                const addr = { EURC: EURC_ADDRESS, USDC: USDC_ADDRESS, USYC: USYC_ADDRESS }[depositToken]
                const bal = { EURC: eurcBalance, USDC: usdcBalance, USYC: usycBalance }[depositToken] || 0
                if (amt > bal) { notify('Deposit Failed', 'Insufficient balance', 'error'); return }
                writeContract({
                  address: addr,
                  abi: ERC20_ABI,
                  functionName: 'transfer',
                  args: [ANCHOR_FX_ROUTER_ADDRESS, parseUnits(depositAmount, 6)],
                  gas: 200000n,
                  maxFeePerGas: parseGwei('20'),
                  maxPriorityFeePerGas: parseGwei('1'),
                })
                notify('Deposit Submitted', `Sending ${depositAmount} ${depositToken} to router`, 'info')
              }}
              style={{
                padding: '6px 14px', background: 'var(--accent2)', color: '#000',
                border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >Deposit</button>
          </div>
        </div>
      </div>
    </div>
  )
}
