import { useId } from 'react'

export default function Logo({ size = 64 }: { size?: number }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="Discipline" role="img">
      <defs>
        <linearGradient id={`lg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--primary-2)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="var(--logo-bg)" />
      <circle cx="32" cy="34" r="15" fill="none" stroke={`url(#lg-${id})`} strokeWidth="5" />
      <circle cx="32" cy="19" r="3.5" fill={`url(#lg-${id})`} />
    </svg>
  )
}
