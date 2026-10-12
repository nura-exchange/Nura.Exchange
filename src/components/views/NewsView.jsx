const ITEMS = [
  {
    tag: 'Ecosystem',
    date: 'Oct 2026',
    title: 'Uniswap V3 is live on Robinhood Chain',
    body: 'Concentrated-liquidity pools run natively on the chain — WETH/USDG and USDG/stock-token pools are already trading. Nura routes quotes through this liquidity.',
  },
  {
    tag: 'Markets',
    date: 'Oct 2026',
    title: '64 stock tokens, one wallet',
    body: 'Apple, Tesla, Nvidia, SPY and dozens more as onchain tokens with Chainlink price feeds that update 24/5. Every token is self-custodied and transferable 24/7.',
  },
  {
    tag: 'Stablecoin',
    date: 'Oct 2026',
    title: 'USDG: the chain’s dollar',
    body: 'Global Dollar (USDG), issued by Paxos, is the base stablecoin of Robinhood Chain. Nura quotes USDG against every listed market with zero-fee discovery.',
  },
  {
    tag: 'Infrastructure',
    date: 'Oct 2026',
    title: 'Chainlink feeds, including equity prices',
    body: 'Robinhood Chain uses Chainlink for both crypto and stock-token prices, with sequencer-uptime checks and oracle pause flags during corporate actions.',
  },
  {
    tag: 'Bridging',
    date: 'Oct 2026',
    title: 'Sixteen networks one click away',
    body: 'Ethereum, Base, Arbitrum, Optimism, BNB, Polygon and ten more route straight into Robinhood Chain through LI.FI — one signature, no custody.',
  },
  {
    tag: 'Nura',
    date: 'Now',
    title: 'Nura Exchange is open',
    body: 'Swap tokenized stocks and stables, bridge from any supported chain, and keep full custody. Every transaction is signed in your own wallet.',
  },
]

export default function NewsView() {
  return (
    <div className="container view">
      <div className="view-head reveal">
        <h1 className="section-heading">News</h1>
        <p className="section-note">What is happening on Robinhood Chain and around Nura Exchange.</p>
      </div>

      <div className="news-list reveal reveal-d1">
        {ITEMS.map((n, i) => (
          <article className="news-row" key={i} style={{ '--i': i }}>
            <div className="news-meta">
              <span className="news-tag">{n.tag}</span>
              <span className="news-date">{n.date}</span>
            </div>
            <div className="news-body">
              <h3 className="news-title">{n.title}</h3>
              <p className="news-text">{n.body}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
