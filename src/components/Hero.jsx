import { useAppState } from '../context/useAppState'

export default function Hero() {
  const { setActiveTab } = useAppState()

  return (
    <section className="hero">
      <div className="hero-media" aria-hidden="true">
        <div className="hero-blob b1" />
        <div className="hero-blob b2" />
        <div className="hero-blob b3" />
      </div>

      <div className="hero-content">
        <h1 className="hero-display">nura</h1>
        <div className="hero-actions">
          <button type="button" className="pill pill-ghost-dark" onClick={() => setActiveTab('Swap')}>
            Start trading
          </button>
          <button type="button" className="pill pill-ghost-dark" onClick={() => setActiveTab('Bridge')}>
            Bridge funds
          </button>
        </div>
      </div>

      <div className="scroll-badge" aria-hidden="true">
        <svg viewBox="0 0 100 100" width="92" height="92">
          <defs>
            <path id="circlePath" d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" />
          </defs>
          <text className="scroll-text">
            <textPath href="#circlePath">SCROLL DOWN · SCROLL DOWN · </textPath>
          </text>
        </svg>
      </div>
    </section>
  )
}
