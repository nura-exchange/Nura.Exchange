import { useAppState } from '../context/useAppState'

const STEPS = [
  ['01', 'Pick your network', 'Start from any of the 16 supported networks, with the funds you already hold.'],
  ['02', 'Sign once', 'One signature routes your funds to Robinhood Chain. You approve every step in your own wallet.'],
  ['03', 'Trade', 'Swap into stock tokens and crypto. Everything stays in your wallet, nothing sits on Nura.'],
]

export default function HowSection() {
  const { setActiveTab } = useAppState()
  return (
    <section className="container how" id="how">
      <div className="how-head reveal">
        <h2 className="subheading">From wherever your money is.</h2>
        <p className="section-note">Bring funds in from 16 networks, then trade tokenized markets on Robinhood Chain.</p>
      </div>
      <ol className="how-steps">
        {STEPS.map(([n, title, text], i) => (
          <li key={n} className={`how-step reveal reveal-d${i}`}>
            <span className="how-n mono">{n}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>
      <div className="how-cta reveal">
        <button type="button" className="pill pill-ghost" onClick={() => setActiveTab('Bridge')}>Bridge funds</button>
        <button type="button" className="pill pill-ghost" onClick={() => setActiveTab('Swap')}>Open Swap</button>
      </div>
      <p className="legal-note">
        Tokenized stocks may not be available in every country, and the rules depend on where you live. Check them before you trade.
        Prices are indicative and nothing here is financial advice. Nura never holds your funds, and you sign every transaction yourself.
      </p>
    </section>
  )
}
