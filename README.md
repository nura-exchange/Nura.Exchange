# Nura.Exchange

**Tokenized markets on [Robinhood Chain](https://docs.robinhood.com/chain) — swap, bridge, portfolio. Self-custodial, one signature.**

**Live: [arcfx-app.vercel.app](https://arcfx-app.vercel.app)**

## What's inside

- **Markets** — one catalog: 64 tokenized stocks & ETFs plus ~750 chain markets. `/api/tokens` aggregates Quoro launches, the LI.FI token registry, GeckoTerminal pools and DexScreener, with on-chain supply pricing via Multicall3.
- **Charts** — animated OHLCV charts for every token: click any market row (timeframes 1H/1D/1W/1M/1Y). `/api/chart` serves GeckoTerminal candles.
- **Swap** — LI.FI-powered swaps, token search across the whole catalog, live quotes and price impact.
- **Bridge** — one-signature bridging from 16 networks.
- **Portfolio / History / News / Docs** — balances, on-chain fills with explorer links, feed, glossary.

## Stack

- Vite + React 18, wagmi + RainbowKit, viem
- Vercel serverless functions: `api/rpc`, `api/quote`, `api/balances`, `api/tokens`, `api/chart`
- Market data: Quoro public API (MIT), GeckoTerminal, DexScreener, LI.FI

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build
```

Set `VITE_WALLETCONNECT_PROJECT_ID` in `.env` (see `.env.example`) to enable wallet connections.

## Deploy

```bash
npx vercel --prod
```

---

Nothing here is financial advice. Tokenized assets are experimental — verify contract addresses before trading.
