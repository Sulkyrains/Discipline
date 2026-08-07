import { useMemo, useState } from 'react'
import { t } from '../lib/i18n'
import type { Course, CourseColor, Parity } from '../types'
import { COURSE_COLORS } from '../types'
import { minuteToHHMM, nowMinute, timeToMinute } from '../lib/format'
import {
  courseWeekLabel,
  coursesOnDay,
  courseOverlaps,
  currentWeekNumber,
  isCourseOngoing,
  nextCourse,
  WEEKDAY_EN,
  WEEKDAY_ZH
} from '../lib/timetable'
import { useAppStore } from '../stores/useAppStore'
import { useFocusStore } from '../stores/useFocusStore'
import Sheet from '../components/Sheet'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'

interface CourseForm {
  name: string
  location: string
  teacher: string
  weekdays: number[]
  startMinute: number
  endMinute: number
  weekStart: number
  weekEnd: number
  parity: Parity
  color: CourseColor
  priority: 1 | 2 | 3
  reminderMinutes: number
}

function emptyForm(day = 1): CourseForm {
  return {
    name: '',
    location: '',
    teacher: '',
    weekdays: [day],
    startMinute: 480,
    endMinute: 510,
    weekStart: 1,
    weekEnd: 16,
    parity: 'all',
    color: 'indigo',
    priority: 2,
    reminderMinutes: 0
  }
}

export default function Timetable() {
  const lang = useAppStore((s) => s.settings.language)
  const semesterStart = useAppStore((s) => s.settings.semesterStart)
  const courses = useAppStore((s) => s.courses)
  const addCourse = useAppStore((s) => s.addCourse)
  const updateCourse = useAppStore((s) => s.updateCourse)
  const removeCourse = useAppStore((s) => s.removeCourse)
  const focusActive = useFocusStore((s) => s.active)

  const [week, setWeek] = useState(() => currentWeekNumber(semesterStart))
  const [day, setDay] = useState(() => ((new Date().getDay() + 6) % 7) + 1)
  const [editing, setEditing] = useState<Course | 'new' | null>(null)
  const [form, setForm] = useState<CourseForm>(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; time?: string; weeks?: string; day?: string }>({})

  const todayDOW = ((new Date().getDay() + 6) % 7) + 1
  const todayWeek = currentWeekNumber(semesterStart)
  const isToday = week === todayWeek && day === todayDOW
  const minute = nowMinute()
  const ongoing = isToday ? nextCourse(courses, day, week, minute) : null
  const ongoingId = ongoing && isCourseOngoing(ongoing, minute) ? ongoing.id : null
  const upcomingId = ongoing && !isCourseOngoing(ongoing, minute) ? ongoing.id : null
  const dayCourses = coursesOnDay(courses, day, week)
  const conflicts = useMemo(() => {
    if (editing === null || !form.name.trim()) return []
    return courses.filter((c) => {
      if (editing !== 'new' && c.id === editing.id) return false
      if (!form.weekdays.includes(c.dayOfWeek)) return false
      return courseOverlaps(c, { ...form, dayOfWeek: c.dayOfWeek })
    })
  }, [courses, form, editing])

  const openNew = () => {
    setForm(emptyForm(day))
    setErrors({})
    setEditing('new')
  }

  const openEdit = (course: Course) => {
    setForm({
      name: course.name,
      location: course.location,
      teacher: course.teacher,
      weekdays: [course.dayOfWeek],
      startMinute: course.startMinute,
      endMinute: course.endMinute,
      weekStart: course.weekStart,
      weekEnd: course.weekEnd,
      parity: course.parity,
      color: course.color,
      priority: course.priority,
      reminderMinutes: course.reminderMinutes
    })
    setErrors({})
    setEditing(course)
  }

  const save = () => {
    const nextErrors: { name?: string; time?: string; weeks?: string; day?: string } = {}
    if (!form.name.trim()) nextErrors.name = t(lang, 'courseNameRequired')
    if (form.weekdays.length === 0) nextErrors.day = t(lang, 'courseDayRequired')
    if (form.endMinute <= form.startMinute) nextErrors.time = t(lang, 'timeInvalid')
    if (form.weekEnd < form.weekStart) nextErrors.weeks = t(lang, 'weeksInvalid')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    const base = {
      name: form.name.trim(),
      location: form.location,
      teacher: form.teacher,
      startMinute: form.startMinute,
      endMinute: form.endMinute,
      weekStart: form.weekStart,
      weekEnd: form.weekEnd,
      parity: form.parity,
      color: form.color,
      priority: form.priority,
      reminderMinutes: form.reminderMinutes
    }
    const selfId = editing && editing !== 'new' ? editing.id : ''
    const sameName = courses.filter((c) => c.name.trim() === base.name && c.id !== selfId)
    const renamed =
      editing !== 'new' && editing !== null && editing.name.trim() !== base.name
    const payload = {
      ...base,
      color: renamed || editing === 'new' ? (sameName.length > 0 ? sameName[0].color : base.color) : base.color
    }
    if (editing === 'new') {
      for (const w of form.weekdays) addCourse({ ...payload, dayOfWeek: w })
    } else if (editing) {
      updateCourse(editing.id, { ...payload, dayOfWeek: form.weekdays[0] })
      for (const w of form.weekdays.slice(1)) addCourse({ ...payload, dayOfWeek: w })
      // Keep every course with the same name on the same color.
      for (const c of courses) {
        if (c.id !== editing.id && c.name.trim() === payload.name && c.color !== payload.color) {
          updateCourse(c.id, { color: payload.color })
        }
      }
    }
    setEditing(null)
  }

  const toggleWeekday = (d: number) => {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(d)
        ? f.weekdays.filter((x) => x !== d)
        : [...f.weekdays, d].sort((a, b) => a - b)
    }))
  }

  return (
    <div className="page page-timetable">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t(lang, 'navTimetable')}</h1>
          <p className="muted">
            {t(lang, 'weekLabel', { week })} · {t(lang, 'coursesCount', { n: courses.filter((c) => c.weekStart <= week && c.weekEnd >= week).length })}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>
          + {t(lang, 'addCourse')}
        </button>
      </header>

      {focusActive ? <div className="banner banner-lock">{t(lang, 'courseLockBanner')}</div> : null}

      <div className="week-stepper">
        <button className="btn btn-ghost btn-icon" onClick={() => setWeek((w) => Math.max(1, w - 1))} aria-label={t(lang, 'weekPrev')}>
          ‹
        </button>
        <span className="week-label">{t(lang, 'weekLabel', { week })}</span>
        <button className="btn btn-ghost btn-icon" onClick={() => setWeek((w) => w + 1)} aria-label={t(lang, 'weekNext')}>
          ›
        </button>
      </div>

      <div className="week-strip">
        {WEEKDAY_ZH.map((wz, i) => {
          const d = i + 1
          const count = coursesOnDay(courses, d, week).length
          return (
            <button key={d} className={`day-chip${day === d ? ' active' : ''}`} onClick={() => setDay(d)}>
                <span className="day-chip-week">{lang === 'zh' ? wz : WEEKDAY_EN[i]}</span>
              <span className="day-chip-count">{count > 0 ? count : ''}</span>
            </button>
          )
        })}
      </div>

      <div className="course-list">
        {dayCourses.length === 0 ? (
          <EmptyState emoji="🗓️" text={t(lang, 'noCourseOnDay')} />
        ) : (
          dayCourses.map((course) => (
            <button
              key={course.id}
              className="card course-item"
              onClick={() => openEdit(course)}
              disabled={focusActive}
            >
              <span className={`course-bar color-${course.color}`} />
              <div className="course-main">
                <div className="course-row">
                  <strong className="course-name">{course.name}</strong>
                  <span className={`chip chip-pri-${course.priority}`}>
                    {t(lang, `pri${course.priority}` as 'pri1')}
                  </span>
                  {ongoingId === course.id ? <span className="badge badge-live">{t(lang, 'ongoing')}</span> : null}
                  {upcomingId === course.id ? <span className="badge badge-next">{t(lang, 'nextUp')}</span> : null}
                </div>
                <span className="course-time">
                  {minuteToHHMM(course.startMinute)} – {minuteToHHMM(course.endMinute)}
                </span>
                <span className="course-meta muted">
                  {[course.location, course.teacher, courseWeekLabel(course)].filter(Boolean).join(' · ')}
                </span>
              </div>
              {course.reminderMinutes > 0 ? (
                <span className="course-reminder">🔔 {course.reminderMinutes}m</span>
              ) : null}
            </button>
          ))
        )}
      </div>

      <Sheet
        open={editing !== null}
        title={editing === 'new' ? t(lang, 'addCourse') : t(lang, 'editCourse')}
        onClose={() => setEditing(null)}
      >
        <div className="form">
          <label className="field">
            <span>{t(lang, 'courseName')} *</span>
            <input
              className="input"
              value={form.name}
              placeholder="高等数学"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
            {errors.name ? <span className="form-error">{errors.name}</span> : null}
          </label>
          <div className="form-row">
            <label className="field">
              <span>{t(lang, 'location')}</span>
              <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
            <label className="field">
              <span>{t(lang, 'teacher')}</span>
              <input className="input" value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} />
            </label>
          </div>
          <div className="field">
            <span>{t(lang, 'weekday')} *</span>
            <div className="sound-chips">
              {WEEKDAY_ZH.map((wz, i) => {
                const d = i + 1
                return (
                  <button
                    key={d}
                    type="button"
                    className={`sound-chip${form.weekdays.includes(d) ? ' active' : ''}`}
                    onClick={() => toggleWeekday(d)}
                  >
                    {lang === 'zh' ? `周${wz}` : WEEKDAY_EN[i]}
                  </button>
                )
              })}
            </div>
            {form.weekdays.length > 1 ? (
              <p className="muted small">{t(lang, 'courseBatchCount', { n: form.weekdays.length })}</p>
            ) : null}
            {errors.day ? <span className="form-error">{errors.day}</span> : null}
          </div>
          <label className="field">
            <span>{t(lang, 'parity')}</span>
            <select
              className="select"
              value={form.parity}
              onChange={(e) => setForm({ ...form, parity: e.target.value as Parity })}
            >
              <option value="all">{t(lang, 'parityAll')}</option>
              <option value="odd">{t(lang, 'parityOdd')}</option>
              <option value="even">{t(lang, 'parityEven')}</option>
            </select>
          </label>
          <div className="form-row">
            <label className="field">
              <span>{t(lang, 'startTime')}</span>
              <input
                className="input"
                type="time"
                value={minuteToHHMM(form.startMinute)}
                onChange={(e) => {
                  const m = timeToMinute(e.target.value)
                  if (m !== null) setForm({ ...form, startMinute: m })
                }}
              />
            </label>
            <label className="field">
              <span>{t(lang, 'endTime')}</span>
              <input
                className="input"
                type="time"
                value={minuteToHHMM(form.endMinute)}
                onChange={(e) => {
                  const m = timeToMinute(e.target.value)
                  if (m !== null) setForm({ ...form, endMinute: m })
                }}
              />
            </label>
          </div>
          {errors.time ? <span className="form-error">{errors.time}</span> : null}
          <div className="form-row">
            <label className="field">
              <span>{t(lang, 'weeksStart')}</span>
              <input
                className="input"
                type="number"
                min={1}
                max={30}
                value={form.weekStart}
                onChange={(e) => setForm({ ...form, weekStart: Number(e.target.value) || 1 })}
              />
            </label>
            <label className="field">
              <span>{t(lang, 'weeksEnd')}</span>
              <input
                className="input"
                type="number"
                min={1}
                max={30}
                value={form.weekEnd}
                onChange={(e) => setForm({ ...form, weekEnd: Number(e.target.value) || 1 })}
              />
            </label>
          </div>
          {errors.weeks ? <span className="form-error">{errors.weeks}</span> : null}
          {conflicts.length > 0 ? (
            <div className="banner banner-warn">
              {t(lang, 'courseConflict')} {conflicts.map((c) => c.name).join('、')}
            </div>
          ) : null}
          <div className="field">
            <span>{t(lang, 'color')}</span>
            <div className="color-picker">
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
          <label className="field">
            <span>{t(lang, 'priority')}</span>
            <select
              className="select"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) as 1 | 2 | 3 })}
            >
              {[1, 2, 3].map((p) => (
                <option key={p} value={p}>
                  {t(lang, `pri${p}` as 'pri1')}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t(lang, 'reminder')}</span>
            <input
              className="input"
              type="number"
              min={0}
              max={60}
              step={5}
              value={form.reminderMinutes}
              onChange={(e) =>
                setForm({ ...form, reminderMinutes: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })
              }
            />
          </label>
          <div className="form-actions">
            {editing !== 'new' && editing ? (
              <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                {t(lang, 'delete')}
              </button>
            ) : null}
            <button className="btn btn-primary" onClick={save}>
              {t(lang, 'saveCourse')}
            </button>
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title={t(lang, 'deleteCourse')}
        body={(editing as Course | null)?.name ?? ''}
        danger
        confirmText={t(lang, 'delete')}
        cancelText={t(lang, 'cancel')}
        onConfirm={() => {
          if (editing && editing !== 'new') removeCourse(editing.id)
          setConfirmDelete(false)
          setEditing(null)
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
