import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { t } from '../lib/i18n'
import { useAppStore } from '../stores/useAppStore'

const BOX = 260

export default function AvatarCropper({
  file,
  onConfirm,
  onCancel
}: {
  file: File
  onConfirm: (cropped: File) => void
  onCancel: () => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null)

  useEffect(() => {
    const el = new Image()
    el.onload = () => setImg(el)
    el.src = URL.createObjectURL(file)
    return () => {
      try {
        URL.revokeObjectURL(el.src)
      } catch {
        /* ignore */
      }
    }
  }, [file])

  const baseZoom = img ? BOX / Math.min(img.width, img.height) : 1
  const scale = zoom * baseZoom
  const dw = img ? img.width * scale : BOX
  const dh = img ? img.height * scale : BOX
  const minX = BOX - dw
  const minY = BOX - dh
  const clamped = { x: Math.min(0, Math.max(minX, pos.x)), y: Math.min(0, Math.max(minY, pos.y)) }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, x: clamped.x, y: clamped.y }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    setPos({ x: d.x + (e.clientX - d.startX), y: d.y + (e.clientY - d.startY) })
  }

  const endDrag = () => {
    dragRef.current = null
  }

  const confirmCrop = () => {
    if (!img) return
    const sx = -clamped.x / scale
    const sy = -clamped.y / scale
    const sw = BOX / scale
    const sh = BOX / scale
    try {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(sw))
      canvas.height = Math.max(1, Math.round(sh))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        onConfirm(file)
        return
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (blob) {
          onConfirm(new File([blob], file.name.replace(/\.[^.]+$/, '') + '-crop.jpg', { type: 'image/jpeg' }))
        } else {
          onConfirm(file)
        }
      }, 'image/jpeg', 0.92)
    } catch {
      onConfirm(file)
    }
  }

  return (
    <div className="avatar-crop-overlay">
      <div className="avatar-crop-card">
        <h3 className="sheet-title">{t(lang, 'avatarCropTitle')}</h3>
        <div
          className="avatar-crop-box"
          style={{ width: BOX, height: BOX }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {img ? (
            <img
              src={img.src}
              alt="crop"
              draggable={false}
              style={{
                width: dw,
                height: dh,
                transform: `translate(${clamped.x}px, ${clamped.y}px)`,
                maxWidth: 'none'
              }}
            />
          ) : null}
          <span className="avatar-crop-grid" />
        </div>
        <label className="field volume-field">
          <span>
            {t(lang, 'zoom')}: {Math.round(zoom * 100)}%
          </span>
          <input
            type="range"
            min={100}
            max={300}
            value={Math.round(zoom * 100)}
            onChange={(e) => setZoom(Number(e.target.value) / 100)}
          />
        </label>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            {t(lang, 'cancel')}
          </button>
          <button className="btn btn-primary" onClick={confirmCrop} disabled={!img}>
            {t(lang, 'cropConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
