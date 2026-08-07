export interface Quote {
  en: string
  zh: string
}

export const QUOTES: Quote[] = [
  { en: 'Always believe a better day.', zh: '永远相信明天会更好。' },
  { en: 'Discipline is choosing what you want most over what you want now.', zh: '自律，是选择你最想要的，而不是当下想要的。' },
  { en: 'Small steps every day, big changes over time.', zh: '每天一小步，时间会给你答案。' },
  { en: 'You do not rise to the level of your goals, you fall to the level of your systems.', zh: '你不是达到了目标的高度，而是落到了系统的高度。' },
  { en: 'Focus on being productive, not busy.', zh: '专注于高效，而不是忙碌。' },
  { en: 'The secret of getting ahead is getting started.', zh: '领先的秘诀，是开始行动。' },
  { en: 'Strength does not come from winning, it comes from showing up.', zh: '力量不来自胜利，而来自坚持到场。' },
  { en: 'One day or day one. You decide.', zh: '某一天，或第一天，由你决定。' },
  { en: 'Progress, not perfection.', zh: '要进步，不要完美。' },
  { en: 'Your future self is watching you right now.', zh: '未来的你，正在看着现在的你。' }
]

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86400000)
}

export function quoteForDate(d = new Date()): Quote {
  return QUOTES[dayOfYear(d) % QUOTES.length]
}

export function quoteByIndex(i: number): Quote {
  const idx = ((i % QUOTES.length) + QUOTES.length) % QUOTES.length
  return QUOTES[idx]
}
