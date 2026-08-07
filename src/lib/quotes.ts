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
  { en: 'Your future self is watching you right now.', zh: '未来的你，正在看着现在的你。' },
  { en: 'The best way to predict the future is to create it.', zh: '预测未来最好的方式，就是去创造它。' },
  { en: 'It always seems impossible until it is done.', zh: '在完成之前，一切看起来都像不可能。' },
  { en: 'Do something today that your future self will thank you for.', zh: '今天做点让未来的你感谢自己的事。' },
  { en: 'Success is the sum of small efforts repeated day in and day out.', zh: '成功是日复一日微小努力的累积。' },
  { en: "Don't watch the clock; do what it does. Keep going.", zh: '不要看时钟，学它一直走下去。' },
  { en: "You don't have to be great to start, but you have to start to be great.", zh: '你不必很优秀才开始，但要开始才能变优秀。' },
  { en: 'A year from now you may wish you had started today.', zh: '一年后的你，可能会希望今天就开始。' },
  { en: "The harder you work for something, the greater you'll feel when you achieve it.", zh: '为某件事越努力，达成时就越有成就感。' },
  { en: "Little by little, one travels far.", zh: '积少成多，行远自迩。' },
  { en: 'Action is the foundational key to all success.', zh: '行动是一切成功的基础。' },
  { en: 'Discipline is the bridge between goals and accomplishment.', zh: '自律是目标与成就之间的桥梁。' },
  { en: 'Every day may not be good, but there is something good in every day.', zh: '并非每天都是好日子，但每天都有美好的事。' },
  { en: 'Push yourself, because no one else is going to do it for you.', zh: '逼自己一把，因为没人会替你努力。' },
  { en: 'The only limit to our realization of tomorrow is our doubts of today.', zh: '实现明天的唯一限制，是我们今天的怀疑。' },
  { en: 'Great things never come from comfort zones.', zh: '伟大的成就从不来自舒适区。' },
  { en: 'Fall seven times, stand up eight.', zh: '跌倒七次，站起来八次。' },
  { en: 'Motivation gets you going, but discipline keeps you growing.', zh: '动力让你出发，自律让你成长。' },
  { en: 'Amateurs sit and wait for inspiration, the rest of us just get up and go to work.', zh: '业余者等待灵感，我们只是起身开始工作。' },
  { en: 'Your only competition is who you were yesterday.', zh: '你唯一的对手，是昨天的自己。' },
  { en: 'Begin anywhere.', zh: '从任何地方开始。' }
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
