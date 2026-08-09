import { useEffect, useState, type FormEvent } from 'react'
import { t } from '../lib/i18n'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { formatClock } from '../lib/format'
import {
  addFeedbackMessage,
  lastFeedbackSeen,
  markFeedbackSeen,
  threadFromRow,
  type FeedbackMessage
} from '../lib/feedback'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useFeedbackStore } from '../stores/useFeedbackStore'
import { useToastStore } from '../stores/useToastStore'
import EmptyState from '../components/EmptyState'
import EmojiPicker from '../components/EmojiPicker'
import ConfirmDialog from '../components/ConfirmDialog'

interface CloudItem {
  id: string
  content: string
  type?: string
  createdAt: string
  status: string
  reply?: string
  messages?: unknown
}

function Thread({ thread }: { thread: FeedbackMessage[] }) {
  if (thread.length === 0) return null
  return (
    <div className="feedback-thread">
      {thread.map((m, i) => (
        <div key={i} className={`feedback-bubble ${m.role === 'dev' ? 'dev' : 'user'}`}>
          <span className="feedback-bubble-role">{m.role === 'dev' ? '开发者' : '我'}</span>
          <p>{m.text}</p>
          {m.at ? <span className="muted small">{formatClock(m.at)}</span> : null}
        </div>
      ))}
    </div>
  )
}

export default function Feedback() {
  const lang = useAppStore((s) => s.settings.language)
  const feedback = useAppStore((s) => s.feedback)
  const addFeedback = useAppStore((s) => s.addFeedback)
  const removeFeedback = useAppStore((s) => s.removeFeedback)
  const user = useAuthStore((s) => s.user)
  const [type, setType] = useState<'problem' | 'bug' | 'idea' | 'other'>('problem')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cloudItems, setCloudItems] = useState<CloudItem[]>([])
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replying, setReplying] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; local: boolean } | null>(null)
  const lastSeen = user ? lastFeedbackSeen(user.id) : 0
  const cloudSorted = [...cloudItems].sort((a, b) => {
    const doneA = a.status === 'done' ? 1 : 0
    const doneB = b.status === 'done' ? 1 : 0
    if (doneA !== doneB) return doneA - doneB
    const readA = Date.parse(a.createdAt) <= lastSeen ? 1 : 0
    const readB = Date.parse(b.createdAt) <= lastSeen ? 1 : 0
    if (readA !== readB) return readA - readB
    return b.createdAt.localeCompare(a.createdAt)
  })
  const isRead = (item: CloudItem) => Date.parse(item.createdAt) <= lastSeen

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return
    let alive = true
    const mapRows = (rows: Array<Record<string, unknown>>): CloudItem[] =>
      rows.map((row) => ({
        id: String(row.id),
        content: String((row.data as { content?: unknown } | null)?.content ?? ''),
        type: String((row.data as { type?: unknown } | null)?.type ?? ''),
        createdAt: String(row.updated_at ?? ''),
        status: String(row.status ?? 'pending'),
        reply: typeof row.reply === 'string' && row.reply ? row.reply : undefined,
        messages: row.messages
      }))
    const fetchRows = async (cols: string) =>
      await supabase!
        .from('feedback')
        .select(cols)
        .order('updated_at', { ascending: false })
        .limit(20)
    void (async () => {
      let result = (await fetchRows('id, data, status, reply, messages, updated_at')) as unknown as {
        data: unknown
        error: unknown
      }
      if (result.error) {
        result = (await fetchRows('id, data, status, updated_at')) as unknown as {
          data: unknown
          error: unknown
        }
      }
      if (!alive) return
      if (!result.error && Array.isArray(result.data)) {
        setCloudItems(mapRows(result.data as Array<Record<string, unknown>>))
        useFeedbackStore.getState().setUserHasNewReply(false)
        markFeedbackSeen(user.id)
      }
    })()
    return () => {
      alive = false
    }
  }, [user])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitting) return
    setSubmitting(true)
    let ok = true
    const payload = { content: content.trim(), contact: contact.trim(), type }
    if (user && supabase) {
      const id = crypto.randomUUID()
      const { error } = await supabase.from('feedback').insert({
        id,
        owner_id: user.id,
        data: payload,
        updated_at: new Date().toISOString()
      })
      ok = !error
      if (!error) {
        setCloudItems((prev) => [
          {
            id,
            content: payload.content,
            type,
            createdAt: new Date().toISOString(),
            status: 'pending'
          },
          ...prev
        ])
      }
    } else {
      if (supabase) {
        await supabase
          .from('feedback')
          .insert({
            id: crypto.randomUUID(),
            owner_id: null,
            data: payload,
            updated_at: new Date().toISOString()
          })
          .then(
            () => undefined,
            () => undefined
          )
      }
      addFeedback(payload.content, '', type)
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

  const sendReply = async (item: CloudItem) => {
    const text = replyDrafts[item.id]?.trim()
    if (!text || replying) return
    setReplying(item.id)
    const ok = await addFeedbackMessage(item.id, 'user', text)
    setReplying(null)
    if (ok) {
      setReplyDrafts((d) => ({ ...d, [item.id]: '' }))
      setCloudItems((prev) =>
        prev.map((r) =>
          r.id === item.id
            ? {
                ...r,
                status: 'pending',
                messages: [
                  ...threadFromRow({ messages: r.messages, reply: r.reply, status: r.status }),
                  { role: 'user' as const, text, at: new Date().toISOString() }
                ]
              }
            : r
        )
      )
      useToastStore.getState().push({ title: t(lang, 'feedbackReplySent'), kind: 'success' })
    } else {
      useToastStore.getState().push({ title: t(lang, 'submitFail'), kind: 'warn' })
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    if (pendingDelete.local) {
      removeFeedback(pendingDelete.id)
    } else if (supabase) {
      await supabase
        .from('feedback')
        .delete()
        .eq('id', pendingDelete.id)
        .eq('owner_id', user?.id ?? '')
      setCloudItems((prev) => prev.filter((r) => r.id !== pendingDelete.id))
    }
    setPendingDelete(null)
  }

  return (
    <div className="page page-feedback">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t(lang, 'feedback')}</h1>
          <p className="muted">{t(lang, 'feedbackDesc')}</p>
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
                  <button
                    type="button"
                    className="btn btn-danger btn-icon"
                    aria-label={t(lang, 'delete')}
                    onClick={() => setPendingDelete({ id: item.id, local: true })}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )
        ) : cloudItems.length === 0 ? (
          <EmptyState emoji="💬" text={t(lang, 'emptyFeedback')} />
        ) : (
          cloudSorted.map((item) => {
            const thread = threadFromRow({ messages: item.messages, reply: item.reply, status: item.status })
            return (
              <div key={item.id} className={`card feedback-item${item.status === 'done' ? ' done' : ''}`}>
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
                  {item.status === 'done' && !isRead(item) ? (
                    <span className="chip">● {t(lang, 'feedbackNewReply')}</span>
                  ) : null}
                  <span className="muted small">{formatClock(item.createdAt)}</span>
                  <button
                    type="button"
                    className="btn btn-danger btn-icon"
                    aria-label={t(lang, 'delete')}
                    onClick={() => setPendingDelete({ id: item.id, local: false })}
                  >
                    ✕
                  </button>
                </div>
                <Thread thread={thread} />
                <div className="feedback-reply-row">
                  <textarea
                    className="textarea"
                    rows={2}
                    placeholder={t(lang, 'feedbackReplyPh')}
                    value={replyDrafts[item.id] ?? ''}
                    onChange={(e) => setReplyDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                  />
                  <EmojiPicker
                    onPick={(e) =>
                      setReplyDrafts((d) => ({ ...d, [item.id]: (d[item.id] ?? '') + e }))
                    }
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={replying !== null || !(replyDrafts[item.id] ?? '').trim()}
                    onClick={() => void sendReply(item)}
                  >
                    {replying === item.id ? '…' : t(lang, 'feedbackReplySend')}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t(lang, 'delete')}
        body={t(lang, 'deleteFeedback')}
        danger
        confirmText={t(lang, 'delete')}
        cancelText={t(lang, 'cancel')}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
