import { SOURCE_CHAINS } from '../../config'
import { useAppState } from '../../context/useAppState'

const GROUPS = [
  { label: 'Guides', links: [['getting-started', 'Getting Started'], ['swap', 'Swap'], ['bridge', 'Bridge']] },
  { label: 'Reference', links: [['fees', 'Fees'], ['contracts', 'Contracts'], ['glossary', 'Glossary']] },
  { label: 'Help', links: [['faq', 'FAQ']] },
]

function Steps({ items }) {
  return (
    <ol className="steps">
      {items.map(([title, body], i) => (
        <li key={i}>
          <span className="step-num">{i + 1}</span>
          <div>
            <strong>{title}</strong>
            <p>{body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function DocsView() {
  const { setActiveTab } = useAppState()

  return (
    <div className="container view docs">
      <aside className="docs-side reveal">
        <div className="docs-group">
          <span className="docs-group-label">Start</span>
          <a className="docs-link" href="#welcome">Welcome to Nura</a>
        </div>
        {GROUPS.map(g => (
          <div className="docs-group" key={g.label}>
            <span className="docs-group-label">{g.label}</span>
            {g.links.map(([id, label]) => (
              <a className="docs-link" key={id} href={`#${id}`}>{label}</a>
            ))}
          </div>
        ))}
        <button type="button" className="pill pill-ghost docs-open" onClick={() => setActiveTab('Markets')}>
          Open app →
        </button>
      </aside>

      <main className="docs-main">
        <section id="welcome" className="docs-hero reveal">
          <span className="docs-eyebrow">New to Nura? Start here.</span>
          <h1>Everything you need, before your first swap.</h1>
          <p className="docs-lede">
            Nura exchanges tokenized stocks, stables and crypto on Robinhood Chain. Self-custodial,
            one signature at a time — no account, no deposit, nothing to trust but your own wallet.
          </p>
        </section>

        <section id="getting-started" className="docs-section reveal">
          <h2>Getting Started</h2>
          <p>
            You need a wallet, a little ETH for gas, and about five minutes. Nura connects through
            any standard EVM wallet — MetaMask, Rabby, or anything that speaks WalletConnect.
          </p>

          <Steps items={[
            ['Connect your wallet', 'Click Connect top right and approve the connection. Nura never asks for a seed phrase or private key, in the app or anywhere else. If something asks, it isn’t Nura.'],
            ['Keep some ETH for gas', 'Every transaction on Robinhood Chain costs a small gas fee, paid in ETH. Fees run far below Ethereum mainnet, but they aren’t zero — if a transaction won’t confirm, check your ETH balance first.'],
            ['Swap or bridge', 'Coming from another chain? Bridge first in one signed transaction. Already on Robinhood Chain? Head to Swap and pick your market.'],
          ]} />

          <div className="callout">
            <span className="callout-label">Before your first swap</span>
            <p>An EVM wallet · a little ETH for gas · funds on Robinhood Chain (or a chain to bridge from).</p>
          </div>
        </section>

        <section id="swap" className="docs-section reveal">
          <h2>Swap</h2>
          <p>
            Tokenized stocks, USDG and crypto — routed through LI.FI across Robinhood Chain
            liquidity. You see the price before you sign, and you sign every transaction yourself.
          </p>

          <Steps items={[
            ['Pick what you pay', 'ETH or USDG, straight from the pay side of the card.'],
            ['Pick what you receive', 'Open the token menu and search any of the listed markets — Apple, Tesla, SPY and dozens more — or a stable.'],
            ['Read the quote', 'Rate, minimum received and route update live. Quotes refresh automatically; nothing is submitted until you press Swap.'],
            ['Sign', 'Your wallet asks once. The swap executes onchain and lands back in the same wallet.'],
          ]} />

          <div className="callout">
            <span className="callout-label">Quick example</span>
            <p>
              Swap 0.5 ETH → USDG. The quote routes through the deepest pool, shows the minimum
              you’ll receive after slippage, and only then asks for your signature.
            </p>
          </div>
        </section>

        <section id="bridge" className="docs-section reveal">
          <h2>Bridge</h2>
          <p>
            Bring funds to Robinhood Chain from {SOURCE_CHAINS.length} networks in a single signed transaction —
            routed by LI.FI, no middleman holds your assets on the way.
          </p>

          <Steps items={[
            ['Choose the source chain', 'Ethereum, Base, Arbitrum, Optimism, BNB, Polygon and ten more.'],
            ['Enter an amount', 'You pay in the source chain’s native ETH; the route tells you what arrives.'],
            ['Sign once', 'The bridge executes end to end in one transaction. Arrival is usually under a minute.'],
          ]} />
        </section>

        <section id="fees" className="docs-section reveal">
          <h2>Fees</h2>
          <p>Nura charges nothing on top. The only costs are the ones the network and the pools already charge everyone.</p>

          <div className="table-wrap doc-table">
            <table className="editorial-table">
              <thead>
                <tr><th>Action</th><th className="num">Fee</th><th>Notes</th></tr>
              </thead>
              <tbody>
                <tr><td>Swap quote</td><td className="num mono">0</td><td className="muted">Nura adds no fee to the route.</td></tr>
                <tr><td>Pool swap fee</td><td className="num mono">per pool</td><td className="muted">Set by each pool, shown inside the quote.</td></tr>
                <tr><td>Bridge</td><td className="num mono">0</td><td className="muted">Route fees shown before you sign.</td></tr>
                <tr><td>Gas</td><td className="num mono">network</td><td className="muted">Paid in ETH to Robinhood Chain.</td></tr>
                <tr><td>History</td><td className="num mono">0</td><td className="muted">Stored in this browser only.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="contracts" className="docs-section reveal">
          <h2>Contracts</h2>
          <p>
            Live on Robinhood Chain, chain id <span className="mono">4663</span>. Nura holds no
            custody contract — swaps route through LI.FI’s contracts and settle in your wallet.
          </p>

          <div className="table-wrap doc-table">
            <table className="editorial-table">
              <thead>
                <tr><th>What</th><th>Address / value</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Chain</td>
                  <td className="mono">Robinhood Chain · id 4663</td>
                </tr>
                <tr>
                  <td>USDG</td>
                  <td className="mono">0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 · 6 dec</td>
                </tr>
                <tr>
                  <td>Stock tokens</td>
                  <td className="mono">listed per market — see Markets</td>
                </tr>
                <tr>
                  <td>RPC</td>
                  <td className="mono">rpc.mainnet.chain.robinhood.com</td>
                </tr>
                <tr>
                  <td>Explorer</td>
                  <td><a className="inline-link" href="https://robinhoodchain.blockscout.com" target="_blank" rel="noreferrer">robinhoodchain.blockscout.com ↗</a></td>
                </tr>
                <tr>
                  <td>Custody</td>
                  <td className="muted">none — only your wallet can move funds</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="glossary" className="docs-section reveal">
          <h2>Glossary</h2>
          <dl className="glossary">
            <div><dt>Tokenized stock</dt><dd>An onchain token whose price tracks a listed equity, backed by Chainlink price feeds and transferable 24/7.</dd></div>
            <div><dt>USDG</dt><dd>Global Dollar, issued by Paxos — the base stablecoin of Robinhood Chain.</dd></div>
            <div><dt>LI.FI</dt><dd>The routing protocol Nura uses to find a price across pools and bridge routes. Nura never holds your funds — LI.FI contracts execute them.</dd></div>
            <div><dt>Quote</dt><dd>A live price for your swap: rate, minimum received after slippage, and the route that produced it.</dd></div>
            <div><dt>Slippage</dt><dd>The gap between the price you expect and the price you get. The quote guarantees a minimum — below it, the swap reverts instead of filling.</dd></div>
            <div><dt>Self-custody</dt><dd>Only your own keys can move your assets. No account, no deposit address, no operator withdrawal.</dd></div>
            <div><dt>Gas</dt><dd>The network fee for a transaction, paid in ETH on Robinhood Chain.</dd></div>
            <div><dt>Chain ID</dt><dd>The number a wallet uses to confirm which network it is on. Robinhood Chain’s is 4663.</dd></div>
            <div><dt>Bridge</dt><dd>Moving value from another chain into Robinhood Chain in one signed transaction.</dd></div>
            <div><dt>History</dt><dd>Your past swaps and bridges, kept in this browser’s local storage — nothing is stored on a server.</dd></div>
          </dl>
        </section>

        <section id="faq" className="docs-section reveal">
          <h2>Frequently asked</h2>

          <div className="faq">
            <details>
              <summary>Does Nura ever hold my funds?</summary>
              <p>No. Swaps and bridges execute from your wallet through LI.FI’s contracts and settle back to your wallet. Nura has no custody contract and no key that can move anything.</p>
            </details>
            <details>
              <summary>What fees does Nura charge?</summary>
              <p>None on top. You pay the pool’s own swap fee — shown inside every quote — plus network gas in ETH. Bridge routes show their fees before you sign.</p>
            </details>
            <details>
              <summary>Where is my history stored?</summary>
              <p>In this browser only, via local storage keyed to your address. Clearing site data clears it; nothing is written to a server.</p>
            </details>
            <details>
              <summary>Are the stock prices real?</summary>
              <p>Stock tokens are priced by Chainlink feeds that update around the clock, with oracle pause flags during corporate actions. Markets shows each price and its 24h move.</p>
            </details>
            <details>
              <summary>Which networks can I bridge from?</summary>
            <p>Sixteen — Ethereum, Base, Arbitrum, Optimism, BNB, Polygon and ten more, all routed by LI.FI in a single signature.</p>
            </details>
            <details>
              <summary>I’m on the wrong network</summary>
              <p>A banner appears under the navigation with a one-click switch to Robinhood Chain. Nothing executes until you’re on the right chain.</p>
            </details>
          </div>
        </section>

        <nav className="prevnext reveal">
          <a href="#welcome">← Welcome</a>
          <a href="#getting-started">Getting Started →</a>
        </nav>
      </main>
    </div>
  )
}
