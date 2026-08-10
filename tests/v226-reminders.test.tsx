import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dateKey } from '../src/lib/format'
import {
  exactAlarmGranted,
  requestExactAlarms,
  scheduleTodoReminders
} from '../src/lib/notifications'
import type { Todo } from '../src/types'

const { ln } = vi.hoisted(() => ({
  ln: {
    getPending: vi.fn<any>(),
    cancel: vi.fn<any>(),
    schedule: vi.fn<any>(),
    checkExactNotificationSetting: vi.fn<any>(),
    changeExactNotificationSetting: vi.fn<any>()
  }
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true }
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: ln
}))

function todo(id: string, dueDate: string, startMinute: number, reminderMinutes: number): Todo {
  return {
    id,
    title: '任务',
    notes: '',
    dueDate,
    startMinute,
    reminderMinutes,
    priority: 2,
    completed: false,
    completedAt: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    focusCount: 0
  }
}

describe('v2.2.6 native todo reminders', () => {
  beforeEach(() => {
    ln.getPending.mockClear()
    ln.cancel.mockClear()
    ln.schedule.mockClear()
    ln.checkExactNotificationSetting.mockClear()
    ln.changeExactNotificationSetting.mockClear()
  })

  it('cancels previous todo notifications and schedules upcoming ones', async () => {
    ln.getPending.mockResolvedValue({
      notifications: [{ id: 100, extra: { kind: 'todo' } }]
    })
    const now = new Date()
    const at = new Date(now.getTime() + 30 * 60000)
    const td = todo('t1', dateKey(at), at.getHours() * 60 + at.getMinutes() + 5, 5)
    await scheduleTodoReminders([td], now)
    expect(ln.cancel).toHaveBeenCalledWith({
      notifications: [{ id: 100, extra: { kind: 'todo' } }]
    })
    expect(ln.schedule).toHaveBeenCalledTimes(1)
    const scheduled = (ln.schedule.mock.calls[0][0] as {
      notifications: Array<{ id: number; extra: { kind: string } }>
    }).notifications[0]
    expect(scheduled.extra.kind).toBe('todo')
  })

  it('skips completed and past todos', async () => {
    const now = new Date()
    const pastAt = new Date(now.getTime() - 3600000)
    const past = todo('t2', dateKey(pastAt), pastAt.getHours() * 60 + pastAt.getMinutes() + 5, 5)
    const done = { ...todo('t3', dateKey(now), 600, 5), completed: true }
    await scheduleTodoReminders([past, done], now)
    expect(ln.schedule).not.toHaveBeenCalled()
  })

  it('reports and requests exact alarms', async () => {
    ln.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'granted' })
    expect(await exactAlarmGranted()).toBe(true)
    ln.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'denied' })
    expect(await exactAlarmGranted()).toBe(false)
    await requestExactAlarms()
    expect(ln.changeExactNotificationSetting).toHaveBeenCalled()
  })
})
