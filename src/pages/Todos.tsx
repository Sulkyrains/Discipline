import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n'
import type { Todo } from '../types'
import { addDays, dateKey, formatDateCN, todayKey } from '../lib/format'
import { useAppStore } from '../stores/useAppStore'
import { useFocusStore } from '../stores/useFocusStore'
import { useToastStore } from '../stores/useToastStore'
import Sheet from '../components/Sheet'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'

type Filter = 'all' | 'today' | 'done'

interface TodoForm {
  title: string
  notes: string
  dueDate: string
  priority: 0 | 1 | 2 | 3
}

const emptyForm = (): TodoForm => ({ title: '', notes: '', dueDate: '', priority: 0 })

export default function Todos() {
  const lang = useAppStore((s) => s.settings.language)
  const todos = useAppStore((s) => s.todos)
  const addTodo = useAppStore((s) => s.addTodo)
  const updateTodo = useAppStore((s) => s.updateTodo)
  const toggleTodo = useAppStore((s) => s.toggleTodo)
  const removeTodo = useAppStore((s) => s.removeTodo)
  const focusActive = useFocusStore((s) => s.active)
  const setTaskId = useFocusStore((s) => s.setTaskId)
  const navigate = useNavigate()

  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Todo | 'new' | null>(null)
  const [form, setForm] = useState<TodoForm>(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [batchText, setBatchText] = useState('')
  const [batchError, setBatchError] = useState(false)

  const today = todayKey()
  const dateQuick = [
    { label: t(lang, 'today'), key: today },
    { label: t(lang, 'tomorrowShort'), key: dateKey(addDays(new Date(), 1)) },
    { label: t(lang, 'dayAfterShort'), key: dateKey(addDays(new Date(), 2)) }
  ]
  const filtered = [...todos]
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      if (a.priority !== b.priority) return b.priority - a.priority
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      return b.createdAt.localeCompare(a.createdAt)
    })
    .filter((td) => {
      if (filter === 'done') return td.completed
      if (filter === 'today') return !td.completed && (td.dueDate === today || td.dueDate === '' || td.dueDate < today)
      return true
    })

  const openNew = () => {
    setForm(emptyForm())
    setMode('single')
    setBatchText('')
    setBatchError(false)
    setEditing('new')
  }

  const openEdit = (todo: Todo) => {
    setForm({ title: todo.title, notes: todo.notes, dueDate: todo.dueDate, priority: todo.priority })
    setEditing(todo)
  }

  const save = () => {
    if (editing === 'new' && mode === 'batch') {
      const lines = batchText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      if (lines.length === 0) {
        setBatchError(true)
        return
      }
      for (const line of lines) {
        addTodo({ title: line, notes: '', dueDate: form.dueDate, priority: form.priority })
      }
      setEditing(null)
      return
    }
    if (!form.title.trim()) return
    if (editing === 'new') {
      addTodo({ ...form, title: form.title.trim() })
    } else if (editing) {
      updateTodo(editing.id, { ...form, title: form.title.trim() })
    }
    setEditing(null)
  }

  const onToggle = (id: string) => {
    const unlocked = toggleTodo(id)
    for (const def of unlocked) {
      useToastStore.getState().push({
        title: `🏆 ${t(lang, 'viewAchievements')} · ${lang === 'zh' ? def.zh : def.en}`,
        body: lang === 'zh' ? def.descZh : def.descEn,
        kind: 'achieve'
      })
    }
  }

  const startFocusWith = (todo: Todo) => {
    setTaskId(todo.id)
    navigate('/focus')
  }

  const priorityLabel = (p: number) => t(lang, `pri${p}` as 'pri0')

  return (
    <div className="page page-todos">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t(lang, 'navTodos')}</h1>
          <p className="muted">
            {todos.filter((td) => !td.completed).length} / {todos.length}
          </p>
        </div>
        {!focusActive ? (
          <button className="btn btn-primary btn-sm" onClick={openNew}>
            + {t(lang, 'addTodo')}
          </button>
        ) : null}
      </header>

      {focusActive ? <div className="banner banner-lock">{t(lang, 'lockedBanner')}</div> : null}

      <div className="seg">
        {(['all', 'today', 'done'] as Filter[]).map((f) => (
          <button key={f} className={`seg-item${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {t(lang, f === 'all' ? 'filterAll' : f === 'today' ? 'filterToday' : 'filterDone')}
          </button>
        ))}
      </div>

      <div className="todo-list">
        {filtered.length === 0 ? (
          <EmptyState emoji="📝" text={t(lang, 'emptyTodos')} />
        ) : (
          filtered.map((todo) => (
            <div key={todo.id} className={`card todo-item${todo.completed ? ' done' : ''}`}>
              <button
                className={`check${todo.completed ? ' checked' : ''}`}
                onClick={() => onToggle(todo.id)}
                aria-label={todo.completed ? 'undone' : 'done'}
              >
                {todo.completed ? '✓' : ''}
              </button>
              <button className="todo-content" onClick={() => (focusActive ? undefined : openEdit(todo))} disabled={focusActive}>
                <strong>{todo.title}</strong>
                {todo.notes ? <span className="muted todo-notes">{todo.notes}</span> : null}
                <span className="todo-meta">
                  <span className={`chip chip-pri-${todo.priority}`}>{priorityLabel(todo.priority)}</span>
                  {todo.dueDate ? (
                    <span className={`chip${todo.dueDate < today && !todo.completed ? ' chip-overdue' : ''}`}>
                      {todo.dueDate < today && !todo.completed ? `${t(lang, 'overdue')} · ` : ''}
                      {formatDateCN(todo.dueDate)}
                    </span>
                  ) : null}
                  {todo.focusCount > 0 ? <span className="chip">🎯 ×{todo.focusCount}</span> : null}
                </span>
              </button>
              {!focusActive && !todo.completed ? (
                <button className="btn btn-ghost btn-icon todo-focus" onClick={() => startFocusWith(todo)} aria-label={t(lang, 'focusWithTask')}>
                  ▶
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>

      <Sheet
        open={editing !== null}
        title={editing === 'new' ? t(lang, 'addTodo') : t(lang, 'editTodo')}
        onClose={() => setEditing(null)}
      >
        <div className="form">
          {editing === 'new' ? (
            <div className="seg seg-sm todo-mode">
              <button
                type="button"
                className={`seg-item${mode === 'single' ? ' active' : ''}`}
                onClick={() => setMode('single')}
              >
                {t(lang, 'singleAdd')}
              </button>
              <button
                type="button"
                className={`seg-item${mode === 'batch' ? ' active' : ''}`}
                onClick={() => setMode('batch')}
              >
                {t(lang, 'batchAdd')}
              </button>
            </div>
          ) : null}
          {mode === 'single' || editing !== 'new' ? (
            <>
              <label className="field">
                <span>{t(lang, 'todoTitle')} *</span>
                <input
                  className="input"
                  value={form.title}
                  placeholder="复习高数第二章"
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  autoFocus
                />
              </label>
              <label className="field">
                <span>{t(lang, 'notes')}</span>
                <textarea
                  className="textarea"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </>
          ) : (
            <label className="field">
              <span>{t(lang, 'todoTitle')} *</span>
              <textarea
                className="textarea"
                rows={5}
                value={batchText}
                placeholder={t(lang, 'batchPh')}
                autoFocus
                onChange={(e) => {
                  setBatchText(e.target.value)
                  setBatchError(false)
                }}
              />
              {batchError ? <span className="form-error">{t(lang, 'batchEmpty')}</span> : null}
              {batchText.trim() ? (
                <p className="muted small">
                  {t(lang, 'batchCount', {
                    n: batchText
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean).length
                  })}
                </p>
              ) : null}
            </label>
          )}
          <div className="form-row">
            <label className="field">
              <span>{t(lang, 'dueDate')}</span>
              <input
                className="input"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{t(lang, 'priority')}</span>
              <select
                className="select"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) as 0 | 1 | 2 | 3 })}
              >
                {[0, 1, 2, 3].map((p) => (
                  <option key={p} value={p}>
                    {t(lang, `pri${p}` as 'pri0')}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="sound-chips date-chips">
            {dateQuick.map((d) => (
              <button
                key={d.key}
                type="button"
                className={`sound-chip${form.dueDate === d.key ? ' active' : ''}`}
                onClick={() => setForm({ ...form, dueDate: d.key })}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="form-actions">
            {editing !== 'new' && editing ? (
              <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                {t(lang, 'delete')}
              </button>
            ) : null}
            <button className="btn btn-primary" onClick={save}>
              {t(lang, 'save')}
            </button>
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title={t(lang, 'delete')}
        body={(editing as Todo | null)?.title ?? ''}
        danger
        confirmText={t(lang, 'delete')}
        cancelText={t(lang, 'cancel')}
        onConfirm={() => {
          if (editing && editing !== 'new') removeTodo(editing.id)
          setConfirmDelete(false)
          setEditing(null)
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
