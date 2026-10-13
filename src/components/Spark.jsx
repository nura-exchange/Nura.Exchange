export default function Spark({ data }) {
  if (!Array.isArray(data) || data.length < 2) return <span className="dim">—</span>
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 96
  const h = 26
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="spark" aria-hidden="true">
      <polyline points={pts} pathLength="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}
