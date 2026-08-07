import type { ReactNode } from 'react'

interface ProgressRingProps {
  size?: number
  stroke?: number
  progress: number // 0..1
  children?: ReactNode
}

export default function ProgressRing({
  size = 220,
  stroke = 10,
  progress,
  children
}: ProgressRingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, progress))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-progress"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  )
}
