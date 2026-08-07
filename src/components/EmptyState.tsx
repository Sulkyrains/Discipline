interface EmptyStateProps {
  emoji: string
  text: string
}

export default function EmptyState({ emoji, text }: EmptyStateProps) {
  return (
    <div className="empty">
      <span className="empty-emoji">{emoji}</span>
      <p>{text}</p>
    </div>
  )
}
