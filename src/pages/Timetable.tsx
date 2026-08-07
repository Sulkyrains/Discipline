import { useMemo, useState } from 'react'
import { t } from '../lib/i18n'
import type { Course, CourseColor, Parity } from '../types'
import { COURSE_COLORS } from '../types'
import { minuteToHHMM, nowMinute } from '../lib/format'
import {
  courseWeekLabel,
  coursesOnDay,
  courseOverlaps,
  currentWeekNumber,
  isCourseOngoing,
  nextCourse,
  TIME_OPTIONS,
  WEEKDAY_EN,
  WEEKDAY_ZH
} from '../lib/timetable'
import { useAppStore } from '../stores/useAppStore'
import Sheet from '../components/Sheet'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'

const REMINDER_OPTIONS = [0, 5, 10, 15, 30]

interface CourseForm {
  name: string
  location: string
  teacher: string
  dayOfWeek: number
  startMinute: number
  endMinute: number
  weekStart: number
  weekEnd: number
  parity: Parity
  color: CourseColor
  reminderMinutes: number
}

function emptyForm(): CourseForm {
  return {
    name: '',
    location: '',
    teacher: '',
    dayOfWeek: 1,
    startMinute: 480,
    endMinute: 510,
    weekStart: 1,
    weekEnd: 16,
    parity: 'all',
    color: 'indigo',
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

  const [week, setWeek] = useState(() => currentWeekNumber(semesterStart))
  const [day, setDay] = useState(() => ((new Date().getDay() + 6) % 7) + 1)
  const [editing, setEditing] = useState<Course | 'new' | null>(null)
  const [form, setForm] = useState<CourseForm>(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; time?: string; weeks?: string }>({})

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
      return courseOverlaps(c, form)
    })
  }, [courses, form, editing])

  const openNew = () => {
    setForm(emptyForm())
    setErrors({})
    setEditing('new')
  }

  const openEdit = (course: Course) => {
    setForm({
      name: course.name,
      location: course.location,
      teacher: course.teacher,
      dayOfWeek: course.dayOfWeek,
      startMinute: course.startMinute,
      endMinute: course.endMinute,
      weekStart: course.weekStart,
      weekEnd: course.weekEnd,
      parity: course.parity,
      color: course.color,
      reminderMinutes: course.reminderMinutes
    })
    setErrors({})
    setEditing(course)
  }

  const save = () => {
    const nextErrors: { name?: string; time?: string; weeks?: string } = {}
    if (!form.name.trim()) nextErrors.name = t(lang, 'courseNameRequired')
    if (form.endMinute <= form.startMinute) nextErrors.time = t(lang, 'timeInvalid')
    if (form.weekEnd < form.weekStart) nextErrors.weeks = t(lang, 'weeksInvalid')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    if (editing === 'new') {
      addCourse({ ...form, name: form.name.trim() })
    } else if (editing) {
      updateCourse(editing.id, { ...form, name: form.name.trim() })
    }
    setEditing(null)
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
            <button key={course.id} className="card course-item" onClick={() => openEdit(course)}>
              <span className={`course-bar color-${course.color}`} />
              <div className="course-main">
                <div className="course-row">
                  <strong className="course-name">{course.name}</strong>
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
          <div className="form-row">
            <label className="field">
              <span>{t(lang, 'weekday')}</span>
              <select
                className="select"
                value={form.dayOfWeek}
                onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
              >
                {WEEKDAY_ZH.map((wz, i) => (
                  <option key={i + 1} value={i + 1}>
                    {lang === 'zh' ? `星期${wz}` : WEEKDAY_EN[i]}
                  </option>
                ))}
              </select>
            </label>
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
          </div>
          <div className="form-row">
            <label className="field">
              <span>{t(lang, 'startTime')}</span>
              <select
                className="select"
                value={form.startMinute}
                onChange={(e) => setForm({ ...form, startMinute: Number(e.target.value) })}
              >
                {TIME_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {minuteToHHMM(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t(lang, 'endTime')}</span>
              <select
                className="select"
                value={form.endMinute}
                onChange={(e) => setForm({ ...form, endMinute: Number(e.target.value) })}
              >
                {TIME_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {minuteToHHMM(m)}
                  </option>
                ))}
              </select>
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
            <span>{t(lang, 'reminder')}</span>
            <select
              className="select"
              value={form.reminderMinutes}
              onChange={(e) => setForm({ ...form, reminderMinutes: Number(e.target.value) })}
            >
              {REMINDER_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? t(lang, 'none') : `${m} ${t(lang, 'minutesBefore')}`}
                </option>
              ))}
            </select>
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
