import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n'
import type { CourseColor, Todo } from '../types'
import { COURSE_COLORS } from '../types'
import { addDays, dateKey, formatDateCN, minuteToHHMM, timeToMinute, todayKey } from '../lib/format'
import { useAppStore } from '../stores/useAppStore'
import { useFocusStore } from '../stores/useFocusStore'
import { useToastStore } from '../stores/useToastStore'
import Sheet from '../components/Sheet'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'

type Filter = 'all' | 'done' | string

interface TodoForm {
  title: string
  notes: string
  dueDate: string
  priority?: 1 | 2 | 3
  startMinute?: number
  endMinute?: number
  reminderMinutes?: number
  color: CourseColor | null
  tags: string[]
}

const emptyForm = (): TodoForm => ({
  title: '',
  notes: '',
  dueDate: '',
  priority: undefined,
  color: null,
  tags: []
})

export default function Todos() {
  const lang = useAppStore((s) => s.settings.language)
  const todos = useAppStore((s) => s.todos)
  const addTodo = useAppStore((s) => s.addTodo)
  const updateTodo = useAppStore((s) => s.updateTodo)
  const toggleTodo = useAppStore((s) => s.toggleTodo)
  const removeTodo = useAppStore((s) => s.removeTodo)
  const focusActive = useFocusStore((s) => s.active)
  const setTaskId = useFocusStore((s) => s.setTaskId)
  const todoQuickTags = useAppStore((s) => s.todoQuickTags)
  const addTodoQuickTag = useAppStore((s) => s.addTodoQuickTag)
  const todoSort = useAppStore((s) => s.settings.todoSort)
  const setSettings = useAppStore((s) => s.setSettings)
  const navigate = useNavigate()

  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Todo | 'new' | null>(null)
  const [form, setForm] = useState<TodoForm>(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [batchText, setBatchText] = useState('')
  const [batchError, setBatchError] = useState(false)
  const [tagInput, setTagInput] = useState('')

  const today = todayKey()
  const upcomingDates = useMemo(() => {
    const set = new Set<string>()
    for (const td of todos) {
      if (!td.completed && td.dueDate !== '' && td.dueDate >= today) set.add(td.dueDate)
    }
    return [...set]
      .sort()
      .filter((d) => d !== today)
      .slice(0, 4)
  }, [todos, today])
  const dateQuick = [
    { label: t(lang, 'today'), key: today },
    { label: t(lang, 'tomorrowShort'), key: dateKey(addDays(new Date(), 1)) },
    { label: t(lang, 'dayAfterShort'), key: dateKey(addDays(new Date(), 2)) }
  ]
  const filtered = [...todos]
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      if (todoSort === 'priority') {
        const pa = a.priority ?? 0
        const pb = b.priority ?? 0
        if (pa !== pb) return pb - pa
      }
      const timeKey = (td: Todo): string =>
        `${td.startMinute !== undefined ? String(td.startMinute).padStart(4, '0') : '9999'}-${
          td.dueDate || '9999-99-99'
        }-${td.createdAt}`
      return timeKey(a).localeCompare(timeKey(b))
    })
    .filter((td) => {
      if (filter === 'done') return td.completed
      if (filter === 'all') return true
      if (filter === 'today') return !td.completed && (td.dueDate === today || td.dueDate === '')
      return !td.completed && td.dueDate === filter
    })

  const openNew = () => {
    setForm(emptyForm())
    setMode('single')
    setBatchText('')
    setBatchError(false)
    setEditing('new')
  }

  const openEdit = (todo: Todo) => {
    setForm({
      title: todo.title,
      notes: todo.notes,
      dueDate: todo.dueDate,
      priority:
        (todo as { priority?: unknown }).priority === 0
          ? undefined
          : (todo.priority as 1 | 2 | 3 | undefined),
      startMinute: todo.startMinute,
      endMinute: todo.endMinute,
      reminderMinutes: todo.reminderMinutes,
      color: todo.color ?? null,
      tags: todo.tags ?? []
    })
    setEditing(todo)
  }

  const save = () => {
    for (const tag of form.tags) addTodoQuickTag(tag)
    if (editing === 'new' && mode === 'batch') {
      const lines = batchText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      if (lines.length === 0) {
        setBatchError(true)
        return
      }
      const counts = colorCounts(todos)
      for (const line of lines) {
        const existing = todos.find((td) => td.title.trim() === line)
        let color: CourseColor
        if (existing) color = existing.color ?? 'indigo'
        else if (form.color) color = form.color
        else {
          color = leastUsedColor(counts)
          counts.set(color, (counts.get(color) ?? 0) + 1)
        }
        addTodo({
          title: line,
          notes: '',
          dueDate: form.dueDate,
          priority: form.priority,
          startMinute: form.startMinute,
          endMinute: form.endMinute,
          reminderMinutes: form.reminderMinutes,
          color,
          tags: [...form.tags]
        })
      }
      setEditing(null)
      return
    }
    if (!form.title.trim()) return
    const selfId = editing !== 'new' && editing ? editing.id : ''
    const sameTitle = todos.filter((td) => td.title.trim() === form.title.trim() && td.id !== selfId)
    const renamed =
      editing !== 'new' && editing !== null && editing.title.trim() !== form.title.trim()
    const color: CourseColor =
      renamed || editing === 'new'
        ? sameTitle.length > 0
          ? (sameTitle[0].color ?? 'indigo')
          : form.color ?? leastUsedColor(colorCounts(todos))
        : form.color ?? 'indigo'
    const payload = { ...form, title: form.title.trim(), color, tags: [...form.tags] }
    if (editing === 'new') {
      addTodo(payload)
    } else if (editing) {
      updateTodo(editing.id, payload)
      for (const c of todos) {
        if (
          c.id !== editing.id &&
          c.title.trim() === payload.title &&
          (c.color ?? 'indigo') !== color
        ) {
          updateTodo(c.id, { color })
        }
      }
    }
    setEditing(null)
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (!tag) return
    if (!form.tags.includes(tag)) setForm({ ...form, tags: [...form.tags, tag] })
    addTodoQuickTag(tag)
    setTagInput('')
  }

  const toggleQuickTag = (tag: string) => {
    setForm({
      ...form,
      tags: form.tags.includes(tag) ? form.tags.filter((x) => x !== tag) : [...form.tags, tag]
    })
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

  const priorityLabel = (p: number) => t(lang, `pri${Math.max(1, Math.min(3, p))}` as 'pri1')

  const colorCounts = (list: Todo[]): Map<string, number> => {
    const counts = new Map<string, number>()
    for (const c of COURSE_COLORS) counts.set(c, 0)
    for (const td of list) {
      const col = td.color ?? 'indigo'
      counts.set(col, (counts.get(col) ?? 0) + 1)
    }
    return counts
  }

  const leastUsedColor = (counts: Map<string, number>): CourseColor => {
    let best: CourseColor = 'indigo'
    let bestCount = Infinity
    for (const c of COURSE_COLORS) {
      const n = counts.get(c) ?? 0
      if (n < bestCount) {
        best = c
        bestCount = n
      }
    }
    return best
  }

  return (
    <div className="page page-todos">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t(lang, 'navTodos')}</h1>
          <p className="muted">
            {todos.filter((td) => !td.completed).length} / {todos.length}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>
          + {t(lang, 'addTodo')}
        </button>
      </header>

      {focusActive ? <div className="banner banner-lock">{t(lang, 'lockedBanner')}</div> : null}

      <div className="seg seg-sm sort-seg">
        <button
          className={`seg-item${todoSort === 'time' ? ' active' : ''}`}
          onClick={() => setSettings({ todoSort: 'time' })}
        >
          {t(lang, 'sortTime')}
        </button>
        <button
          className={`seg-item${todoSort === 'priority' ? ' active' : ''}`}
          onClick={() => setSettings({ todoSort: 'priority' })}
        >
          {t(lang, 'sortPriority')}
        </button>
      </div>

      <div className="filter-chips">
        <button className={`sound-chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          {t(lang, 'filterAll')}
        </button>
        <button className={`sound-chip${filter === 'today' ? ' active' : ''}`} onClick={() => setFilter('today')}>
          {t(lang, 'filterToday')}
        </button>
        {upcomingDates.map((d) => (
          <button key={d} className={`sound-chip${filter === d ? ' active' : ''}`} onClick={() => setFilter(d)}>
            {formatDateCN(d)}
          </button>
        ))}
        <button className={`sound-chip${filter === 'done' ? ' active' : ''}`} onClick={() => setFilter('done')}>
          {t(lang, 'filterDone')}
        </button>
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
                  <i className={`todo-color-dot color-${todo.color ?? 'indigo'}`} />
                  {todo.priority ? (
                    <span className={`chip chip-pri-${todo.priority}`}>
                      {priorityLabel(todo.priority)}
                    </span>
                  ) : null}
                  {todo.dueDate ? (
                    <span className={`chip${todo.dueDate < today && !todo.completed ? ' chip-overdue' : ''}`}>
                      {todo.dueDate < today && !todo.completed ? `${t(lang, 'overdue')} · ` : ''}
                      {formatDateCN(todo.dueDate)}
                    </span>
                  ) : null}
                  {todo.startMinute !== undefined ? (
                    <span className="chip">
                      {minuteToHHMM(todo.startMinute)}
                      {todo.endMinute !== undefined ? `–${minuteToHHMM(todo.endMinute)}` : ''}
                      {todo.reminderMinutes ? ` · 🔔${todo.reminderMinutes}` : ''}
                    </span>
                  ) : null}
                  {todo.focusCount > 0 ? <span className="chip">🎯 ×{todo.focusCount}</span> : null}
                  {(todo.tags ?? []).map((tag) => (
                    <span key={tag} className="chip chip-tag">
                      #{tag}
                    </span>
                  ))}
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
                value={form.priority ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    priority:
                      e.target.value === '' ? undefined : (Number(e.target.value) as 1 | 2 | 3)
                  })
                }
              >
                <option value="">{t(lang, 'none')}</option>
                {[1, 2, 3].map((p) => (
                  <option key={p} value={p}>
                    {t(lang, `pri${p}` as 'pri1')}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label className="field">
              <span>{t(lang, 'startTime')}</span>
              <input
                className="input"
                type="time"
                value={form.startMinute !== undefined ? minuteToHHMM(form.startMinute) : ''}
                onChange={(e) => {
                  const m = timeToMinute(e.target.value)
                  setForm({ ...form, startMinute: m ?? undefined })
                }}
              />
            </label>
            <label className="field">
              <span>{t(lang, 'endTime')}</span>
              <input
                className="input"
                type="time"
                value={form.endMinute !== undefined ? minuteToHHMM(form.endMinute) : ''}
                onChange={(e) => {
                  const m = timeToMinute(e.target.value)
                  setForm({ ...form, endMinute: m ?? undefined })
                }}
              />
            </label>
          </div>
          <label className="field">
            <span>{t(lang, 'reminderShort')}</span>
            <input
              className="input"
              type="number"
              min={0}
              max={60}
              step={5}
              value={form.reminderMinutes ?? 0}
              onChange={(e) =>
                setForm({
                  ...form,
                  reminderMinutes: Math.max(0, Math.min(60, Number(e.target.value) || 0))
                })
              }
            />
          </label>
          <div className="field">
            <span>{t(lang, 'color')}</span>
            <div className="color-picker">
              <button
                type="button"
                className={`sound-chip${form.color === null ? ' active' : ''}`}
                onClick={() => setForm({ ...form, color: null })}
              >
                {t(lang, 'colorAuto')}
              </button>
              {COURSE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-dot color-${c}${form.color === c ? ' selected' : ''}`}
                  onClick={() => setForm({ ...form, color: c })}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <div className="field">
            <span>{t(lang, 'tags')}</span>
            <div className="tag-chips">
              {todoQuickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`sound-chip${form.tags.includes(tag) ? ' active' : ''}`}
                  onClick={() => toggleQuickTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="tag-input-row">
              <input
                className="input"
                value={tagInput}
                placeholder={t(lang, 'tagPlaceholder')}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={addTag}>
                {t(lang, 'tagAdd')}
              </button>
            </div>
            {form.tags.length > 0 ? (
              <div className="tag-chips">
                {form.tags.map((tag) => (
                  <span key={tag} className="chip chip-tag">
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
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
