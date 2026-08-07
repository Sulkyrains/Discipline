import { useMemo } from 'react'

const COLORS = ['var(--primary)', 'var(--primary-2)', 'var(--accent)', 'var(--warn)', 'var(--success)']

export default function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        left: `${(i * 61) % 100}%`,
        delay: `${((i * 137) % 700) / 1000}s`,
        color: COLORS[i % COLORS.length],
        rotate: `${(i * 53) % 180}deg`
      })),
    []
  )
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{ left: p.left, animationDelay: p.delay, background: p.color, transform: `rotate(${p.rotate})` }}
        />
      ))}
    </div>
  )
}
