import { CHANGELOG } from '../lib/changelog'
import { t } from '../lib/i18n'
import { useAppStore } from '../stores/useAppStore'

export default function Changelog() {
  const lang = useAppStore((s) => s.settings.language)
  return (
    <div className="page page-changelog">
      <header className="page-head">
        <div>
          <h1 className="page-title">📜 {t(lang, 'changelog')}</h1>
          <p className="muted">{t(lang, 'changelogDesc')}</p>
        </div>
      </header>
      <div className="changelog-list">
        {CHANGELOG.map((entry) => (
          <div key={entry.version} className="card changelog-item">
            <div className="changelog-head">
              <strong>v{entry.version}</strong>
              <span className="muted small">{entry.date}</span>
            </div>
            <p>{lang === 'zh' ? entry.zh : entry.en}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
