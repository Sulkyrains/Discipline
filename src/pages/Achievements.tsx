import { useMemo } from 'react'
import { t } from '../lib/i18n'
import { ACHIEVEMENTS, achievementById } from '../lib/achievements'
import { computeStats } from '../lib/stats'
import { useAppStore } from '../stores/useAppStore'

export default function Achievements() {
  const lang = useAppStore((s) => s.settings.language)
  const sessions = useAppStore((s) => s.sessions)
  const todos = useAppStore((s) => s.todos)
  const unlocked = useAppStore((s) => s.unlocked)
  const stats = useMemo(() => computeStats(sessions, todos), [sessions, todos])

  const unlockedDefs = unlocked.map((id) => achievementById(id)).filter((d): d is NonNullable<typeof d> => !!d)

  return (
    <div className="page page-achievements">
      <header className="page-head">
        <div>
          <h1 className="page-title">🏆 {t(lang, 'viewAchievements')}</h1>
          <p className="muted">
            {t(lang, 'unlockedCount', { n: unlockedDefs.length })} / {ACHIEVEMENTS.length}
          </p>
        </div>
      </header>

      <div className="progress-bar">
        <span style={{ width: `${(unlockedDefs.length / ACHIEVEMENTS.length) * 100}%` }} />
      </div>

      <div className="ach-grid">
        {ACHIEVEMENTS.map((def) => {
          const isUnlocked = unlocked.includes(def.id)
          const p = def.progress(stats)
          const progressText = `${Math.min(p.current, p.target)}/${p.target}`
          return (
            <div key={def.id} className={`card ach-card${isUnlocked ? ' unlocked' : ''}`}>
              <span className="ach-icon">{isUnlocked ? def.icon : '🔒'}</span>
              <strong className="ach-name">{lang === 'zh' ? def.zh : def.en}</strong>
              <span className="ach-desc muted">{lang === 'zh' ? def.descZh : def.descEn}</span>
              <span className={`ach-progress${isUnlocked ? ' done' : ''}`}>
                {isUnlocked ? `✓ ${t(lang, 'achieved')}` : progressText}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
