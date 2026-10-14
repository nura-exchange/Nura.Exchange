// Ten-segment ring: one segment per point of the Data score.
export default function ScoreRing({ value, size = 128, tone = 'good', label = 'Data score' }) {
  const R = 52
  const C = 2 * Math.PI * R
  const seg = C / 10
  const gap = 6
  return (
    <div className={`ring ring-${tone}`} style={{ width: size, height: size }} role="img" aria-label={`${label} ${value} out of 10`}>
      <svg viewBox="0 0 128 128" width={size} height={size} aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <circle
            key={i}
            className={i < value ? 'ring-on' : 'ring-off'}
            cx="64" cy="64" r={R}
            fill="none" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={`${seg - gap} ${C - (seg - gap)}`}
            strokeDashoffset={-i * seg - gap / 2}
            transform="rotate(-90 64 64)"
            style={{ '--i': i }}
          />
        ))}
      </svg>
      <div className="ring-center"><b>{value}</b><small>/10</small></div>
    </div>
  )
}
