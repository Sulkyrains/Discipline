import { useState } from 'react'

const EMOJIS = [
  '😀', '😂', '😊', '😍', '😭', '😅', '😉', '🙏',
  '👍', '👏', '🙌', '💪', '🔥', '⭐', '💡', '❤️',
  '🎉', '✅', '❌', '❓', '❗', '🎯', '🌈', '🍀'
]

export default function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="emoji-picker">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
        😊
      </button>
      {open ? (
        <div className="emoji-picker-grid">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className="emoji-picker-btn"
              onClick={() => {
                onPick(e)
                setOpen(false)
              }}
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
