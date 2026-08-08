import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export const WHEEL_ITEM_HEIGHT = 36
const WHEEL_VISIBLE = 5

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

interface WheelColumnProps {
  label: string
  values: number[]
  value: number
  onChange: (v: number) => void
}

function WheelColumn({ label, values, value, onChange }: WheelColumnProps) {
  const startYRef = useRef<number | null>(null)
  const startValRef = useRef(0)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    startYRef.current = e.clientY
    startValRef.current = value
    setDragging(true)
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startYRef.current === null) return
    const dy = e.clientY - startYRef.current
    const delta = Math.round(dy / WHEEL_ITEM_HEIGHT)
    const next = clamp(startValRef.current - delta, 0, values.length - 1)
    if (next !== value) onChange(values[next])
  }

  const endDrag = () => {
    startYRef.current = null
    setDragging(false)
  }

  const step = (dir: 1 | -1) => {
    const idx = values.indexOf(value)
    const next = clamp(idx + dir, 0, values.length - 1)
    if (next !== idx) onChange(values[next])
  }

  const centerOffset = (WHEEL_VISIBLE * WHEEL_ITEM_HEIGHT) / 2 - WHEEL_ITEM_HEIGHT / 2
  const translateY = centerOffset - values.indexOf(value) * WHEEL_ITEM_HEIGHT

  return (
    <div className={`wheel-col${dragging ? ' dragging' : ''}`} aria-label={label}>
      <div className="wheel-mask wheel-mask-top" />
      <div
        className="wheel-items"
        style={{ transform: `translateY(${translateY}px)`, height: values.length * WHEEL_ITEM_HEIGHT }}
        data-wheel={label === 'hours' ? 'hours' : 'minutes'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        {values.map((v) => (
          <div
            key={v}
            className={`wheel-item${v === value ? ' active' : ''}`}
            style={{ height: WHEEL_ITEM_HEIGHT }}
          >
            {String(v).padStart(2, '0')}
          </div>
        ))}
      </div>
      <div className="wheel-mask wheel-mask-bottom" />
      <div className="wheel-stepper" aria-hidden>
        <button type="button" tabIndex={-1} className="wheel-step" onClick={() => step(-1)}>
          ▲
        </button>
        <button type="button" tabIndex={-1} className="wheel-step" onClick={() => step(1)}>
          ▼
        </button>
      </div>
    </div>
  )
}

export default function TimeWheel({
  value,
  onChange,
  ariaLabel
}: {
  value: number
  onChange: (minutes: number) => void
  ariaLabel: string
}) {
  const hour = Math.floor(value / 60)
  const minute = value % 60
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: 60 }, (_, i) => i)

  return (
    <div className="time-wheel" aria-label={ariaLabel} role="group">
      <WheelColumn
        label="hours"
        values={hours}
        value={hour}
        onChange={(h) => onChange(h * 60 + minute)}
      />
      <span className="wheel-colon">:</span>
      <WheelColumn
        label="minutes"
        values={minutes}
        value={minute}
        onChange={(m) => onChange(hour * 60 + m)}
      />
    </div>
  )
}
