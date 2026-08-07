import { useState, type FormEvent } from 'react'
import { t } from '../lib/i18n'
import { supabase } from '../lib/supabase'
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
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitting) return
    setSubmitting(true)
    let ok = true
    if (user && supabase) {
      const { error } = await supabase.from('feedback').insert({
        id: crypto.randomUUID(),
        owner_id: user.id,
        data: { content: content.trim(), contact: contact.trim() },
        updated_at: new Date().toISOString()
      })
      ok = !error
    } else {
      addFeedback(content.trim(), contact.trim())
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
        {feedback.length === 0 ? (
          <EmptyState emoji="💬" text={t(lang, 'emptyFeedback')} />
        ) : (
          feedback.slice(0, 20).map((item) => (
            <div key={item.id} className="card feedback-item">
              <p>{item.content}</p>
              <div className="feedback-meta">
                <span className="chip">{t(lang, 'statusPending')}</span>
                <span className="muted small">{formatClock(item.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
