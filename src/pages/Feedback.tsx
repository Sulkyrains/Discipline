import { useEffect, useState, type FormEvent } from 'react'
import { t } from '../lib/i18n'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { formatClock } from '../lib/format'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useToastStore } from '../stores/useToastStore'
import EmptyState from '../components/EmptyState'

export default function Feedback() {
  const lang = useAppStore((s) => s.settings.language)
  const feedback = useAppStore((s) => s.feedback)
  const addFeedback = useAppStore((s) => s.addFeedback)
  const user = useAuthStore((s) => s.user)
  const [type, setType] = useState<'problem' | 'bug' | 'idea' | 'other'>('problem')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cloudItems, setCloudItems] = useState<
    Array<{
      id: string
      content: string
      contact: string
      type?: string
      createdAt: string
      status: string
      reply?: string
    }>
  >([])

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return
    let alive = true
    void supabase!
      .from('feedback')
      .select('id, data, status, reply, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!alive || !data) return
        setCloudItems(
          data.map((row) => ({
            id: String(row.id),
            content: String((row.data as { content?: unknown })?.content ?? ''),
            contact: String((row.data as { contact?: unknown })?.contact ?? ''),
            type: String((row.data as { type?: unknown })?.type ?? ''),
            createdAt: String(row.updated_at ?? ''),
            status: String(row.status ?? 'pending'),
            reply: typeof row.reply === 'string' && row.reply ? row.reply : undefined
          }))
        )
      })
    return () => {
      alive = false
    }
  }, [user])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitting) return
    setSubmitting(true)
    let ok = true
    if (user && supabase) {
      const id = crypto.randomUUID()
      const { error } = await supabase.from('feedback').insert({
        id,
        owner_id: user.id,
        data: { content: content.trim(), contact: contact.trim(), type },
        updated_at: new Date().toISOString()
      })
      ok = !error
      if (!error) {
        setCloudItems((prev) => [
          {
            id,
            content: content.trim(),
            contact: contact.trim(),
            type,
            createdAt: new Date().toISOString(),
            status: 'pending'
          },
          ...prev
        ])
      }
    } else {
      addFeedback(content.trim(), contact.trim(), type)
    }
    setSubmitting(false)
    if (ok) {
      useToastStore.getState().push({ title: t(lang, 'submitOk'), kind: 'success' })
      setContent('')
      setContact('')
    } else {
      useToastStore.getState().push({ title: t(lang, 'submitFail'), kind: 'warn' })
    }
  }

  return (
    <div className="page page-feedback">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t(lang, 'feedback')}</h1>
          <p className="muted">{user ? user.email : t(lang, 'guest')}</p>
        </div>
      </header>

      <form className="card feedback-form" onSubmit={submit}>
        <div className="field">
          <span>{t(lang, 'feedbackType')}</span>
          <div className="sound-chips">
            {(['problem', 'bug', 'idea', 'other'] as const).map((ft) => (
              <button
                key={ft}
                type="button"
                className={`sound-chip${type === ft ? ' active' : ''}`}
                onClick={() => setType(ft)}
              >
                {t(lang, `feedbackType${ft[0].toUpperCase()}${ft.slice(1)}` as 'feedbackTypeProblem')}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>{t(lang, 'content')} *</span>
          <textarea
            className="textarea"
            rows={4}
            value={content}
            placeholder={t(lang, 'contentPh')}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t(lang, 'contact')} · {t(lang, 'optional')}</span>
          <input className="input" value={contact} placeholder={t(lang, 'contactPh')} onChange={(e) => setContact(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={submitting || !content.trim()}>
          {submitting ? t(lang, 'submitting') : t(lang, 'submit')}
        </button>
      </form>

      <section className="my-feedback">
        <h3 className="section-title">{t(lang, 'myFeedback')}</h3>
        {!user || !isSupabaseConfigured() ? (
          feedback.length === 0 ? (
            <EmptyState emoji="💬" text={t(lang, 'emptyFeedback')} />
          ) : (
            feedback.slice(0, 20).map((item) => (
              <div key={item.id} className="card feedback-item">
                <p>{item.content}</p>
                <div className="feedback-meta">
                  {item.type ? (
                    <span className="chip">
                      {t(
                        lang,
                        `feedbackType${item.type[0].toUpperCase()}${item.type.slice(1)}` as 'feedbackTypeProblem'
                      )}
                    </span>
                  ) : null}
                  <span className="chip">{t(lang, 'statusPending')}</span>
                  <span className="muted small">{formatClock(item.createdAt)}</span>
                </div>
              </div>
            ))
          )
        ) : cloudItems.length === 0 ? (
          <EmptyState emoji="💬" text={t(lang, 'emptyFeedback')} />
        ) : (
          cloudItems.map((item) => (
            <div key={item.id} className="card feedback-item">
              <p>{item.content}</p>
              <div className="feedback-meta">
                {item.type ? (
                  <span className="chip">
                    {t(lang, `feedbackType${item.type[0].toUpperCase()}${item.type.slice(1)}` as 'feedbackTypeProblem')}
                  </span>
                ) : null}
                <span className={`chip${item.status === 'done' ? ' chip-ok' : ''}`}>
                  {item.status === 'done' ? t(lang, 'statusDone') : t(lang, 'statusPending')}
                </span>
                <span className="muted small">{formatClock(item.createdAt)}</span>
              </div>
              {item.reply ? (
                <div className="feedback-reply">
                  <strong>💬 {t(lang, 'feedbackReply')}</strong>
                  <p>{item.reply}</p>
                </div>
              ) : null}
            </div>
          ))
        )}
      </section>
    </div>
  )
}
