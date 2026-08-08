import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

const DELETE_WIDTH = 84
const LONG_PRESS_MS = 600

export default function SwipeDelete({
  children,
  onDelete,
  disabled,
  deleteLabel
}: {
  children: ReactNode
  onDelete: () => void
  disabled?: boolean
  deleteLabel: string
}) {
  const [offset, setOffset] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; startOffset: number; moved: boolean } | null>(null)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressRef = useRef(false)

  const clearLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const target = e.target as HTMLElement
    const onControl = typeof target.closest === 'function' && !!target.closest('[data-no-swipe]')
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffset: offset,
      moved: false
    }
    suppressRef.current = false
    if (!onControl) {
      clearLongPress()
      longPressRef.current = setTimeout(() => {
        longPressRef.current = null
        suppressRef.current = true
        onDelete()
      }, LONG_PRESS_MS)
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      d.moved = true
      clearLongPress()
      setSwiping(true)
    }
    if (d.moved) {
      suppressRef.current = true
      setOffset(Math.max(-DELETE_WIDTH, Math.min(0, d.startOffset + dx)))
    }
  }

  const endDrag = () => {
    clearLongPress()
    const d = dragRef.current
    dragRef.current = null
    setSwiping(false)
    if (d?.moved) {
      setOffset((o) => (o <= -DELETE_WIDTH / 2 ? -DELETE_WIDTH : 0))
    }
  }

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressRef.current) {
      e.preventDefault()
      e.stopPropagation()
      suppressRef.current = false
    }
  }

  const revealed = offset < 0

  return (
    <div className={`swipe-item${revealed ? ' revealed' : ''}`}>
      <button
        type="button"
        className="swipe-delete"
        tabIndex={revealed ? 0 : -1}
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
      >
        {deleteLabel}
      </button>
      <div
        className={`swipe-content${swiping ? ' swiping' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onClick={onClick}
      >
        {children}
      </div>
    </div>
  )
}
