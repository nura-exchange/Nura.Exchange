export default function Footer() {
  return (
    <footer className="ft">
      <div className="ft-inner container">
        <div className="ft-col">
          <div className="ft-line ft-strong">Nura Exchange</div>
          <div className="ft-line">Tokenized markets, self-custodied.</div>
          <div className="ft-line">Every trade signed in your own wallet.</div>
        </div>
        <div className="ft-col">
          <div className="ft-line ft-strong">Robinhood Chain</div>
          <div className="ft-line">Chain ID 4663 · gas: ETH</div>
          <div className="ft-line">robinhoodchain.blockscout.com</div>
        </div>
        <div className="ft-col ft-links">
          <a href="https://docs.robinhood.com/chain" target="_blank" rel="noreferrer">Docs</a>
          <a href="https://github.com/nura-exchange/Nura.Exchange" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://robinhoodchain.blockscout.com" target="_blank" rel="noreferrer">Explorer</a>
          <a href="https://quoro.exchange/docs" target="_blank" rel="noreferrer">API</a>
        </div>
      </div>
      <div className="ft-base container">
        <span>© 2026 Nura Exchange</span>
        <span>Nothing here is financial advice.</span>
      </div>
    </footer>
  )
}
