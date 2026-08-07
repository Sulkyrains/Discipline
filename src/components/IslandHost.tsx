import { useToastStore } from '../stores/useToastStore'

function iconFor(kind?: string): string {
  switch (kind) {
    case 'success':
      return '✓'
    case 'warn':
      return '!'
    case 'achieve':
      return '🏆'
    default:
      return 'i'
  }
}

export default function IslandHost() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  if (toasts.length === 0) return null
  return (
    <div className="island-host" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          className={`island island-${toast.kind ?? 'info'}`}
          onClick={() => dismiss(toast.id)}
        >
          <span className="island-icon">{iconFor(toast.kind)}</span>
          <span className="island-text">
            <strong>{toast.title}</strong>
            {toast.body ? <small>{toast.body}</small> : null}
          </span>
        </button>
      ))}
    </div>
  )
}
