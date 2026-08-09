import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'
import { formatClock } from '../lib/format'
import { isAdmin, listAllFeedback, updateFeedbackReply, type AdminFeedbackRow } from '../lib/admin'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useToastStore } from '../stores/useToastStore'
import EmptyState from '../components/EmptyState'

export default function Admin() {
  const lang = useAppStore((s) => s.settings.language)
  const user = useAuthStore((s) => s.user)
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [rows, setRows] = useState<AdminFeedbackRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!user) {
      setAuthorized(false)
      return
    }
    let alive = true
    void isAdmin(user.id).then((ok) => {
      if (!alive) return
      setAuthorized(ok)
      if (ok) {
        void listAllFeedback().then((r) => {
          if (!alive) return
          const sorted = [...r].sort(
            (a, b) =>
              (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) ||
              b.updatedAt.localeCompare(a.updatedAt)
          )
          setRows(sorted)
        })
      }
    })
    return () => {
      alive = false
    }
  }, [user])

  if (!user || authorized === false) {
    return (
      <div className="page page-admin">
        <EmptyState emoji="🔒" text={t(lang, 'adminForbidden')} />
        <p className="muted small" style={{ textAlign: 'center', marginTop: 8 }}>
          {t(lang, 'adminHint')}
        </p>
      </div>
    )
  }

  if (authorized === null) {
    return (
      <div className="page page-admin">
        <p className="muted">{t(lang, 'loading')}</p>
      </div>
    )
  }

  const saveReply = async (row: AdminFeedbackRow) => {
    const ok = await updateFeedbackReply(row.id, drafts[row.id] ?? '', 'done')
    if (ok) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, status: 'done', reply: drafts[r.id]?.trim() || undefined } : r
        )
      )
      useToastStore.getState().push({ title: t(lang, 'adminReplySaved'), kind: 'success' })
    } else {
      useToastStore.getState().push({ title: t(lang, 'submitFail'), kind: 'warn' })
    }
  }

  const markPending = async (row: AdminFeedbackRow) => {
    const ok = await updateFeedbackReply(row.id, drafts[row.id] ?? '', 'pending')
    if (ok) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: 'pending' } : r)))
      useToastStore.getState().push({ title: t(lang, 'adminMarkedPending'), kind: 'info' })
    }
  }

  return (
    <div className="page page-admin">
      <header className="page-head">
        <div>
          <h1 className="page-title">🛠 {t(lang, 'adminPanel')}</h1>
          <p className="muted">{t(lang, 'adminDesc')}</p>
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState emoji="💬" text={t(lang, 'emptyFeedback')} />
      ) : (
        <div className="admin-feedback-list">
          {rows.map((row) => (
            <div key={row.id} className={`card admin-feedback-item${row.status === 'done' ? ' done' : ''}`}>
              <div className="admin-feedback-head">
                <span className={`chip${row.status === 'done' ? ' chip-ok' : ''}`}>
                  {row.status === 'done' ? t(lang, 'statusDone') : t(lang, 'statusPending')}
                </span>
                {row.type ? (
                  <span className="chip">
                    {t(lang, `feedbackType${row.type[0].toUpperCase()}${row.type.slice(1)}` as 'feedbackTypeProblem')}
                  </span>
                ) : null}
                {!row.ownerId ? <span className="chip">{t(lang, 'guest')}</span> : null}
                {row.ownerId && row.nickname ? <span className="chip chip-tag">👤 {row.nickname}</span> : null}
                <span className="muted small">{formatClock(row.updatedAt)}</span>
              </div>
              <p className="admin-feedback-content">{row.content}</p>
              <p className="muted small">{row.contact ? `📮 ${row.contact}` : t(lang, 'adminNoContact')}</p>
              <textarea
                className="textarea"
                rows={2}
                placeholder={t(lang, 'adminReplyPh')}
                value={drafts[row.id] ?? row.reply ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
              />
              <div className="settings-actions">
                <button className="btn btn-primary btn-sm" onClick={() => void saveReply(row)}>
                  {t(lang, 'adminSaveReply')}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => void markPending(row)}>
                  {t(lang, 'adminMarkPending')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
