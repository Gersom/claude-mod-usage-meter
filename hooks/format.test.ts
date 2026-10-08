import { describe, expect, test } from 'claude-code/testing'

import { bar, fitReset, head, level, longDate, relative, resetText, rowOf, shortDate } from './format'

describe('level', () => {
  test('green up to 70, yellow above 70, red from 90', () => {
    expect(level(0)).toBe('green')
    expect(level(70)).toBe('green')
    expect(level(71)).toBe('yellow')
    expect(level(89)).toBe('yellow')
    expect(level(90)).toBe('red')
    expect(level(100)).toBe('red')
  })
})

describe('bar', () => {
  test('ten cells, filled by rounded tenths', () => {
    expect(bar(0)).toBe('░░░░░░░░░░')
    expect(bar(7)).toBe('█░░░░░░░░░')
    expect(bar(42)).toBe('████░░░░░░')
    expect(bar(100)).toBe('██████████')
  })

  test('clamps out-of-range values', () => {
    expect(bar(-5)).toBe('░░░░░░░░░░')
    expect(bar(140)).toBe('██████████')
  })
})

describe('relative', () => {
  const min = 60000

  test('minutes, hours and days', () => {
    expect(relative(0)).toBe('menos de 1 min')
    expect(relative(45 * min)).toBe('45 min')
    expect(relative((2 * 60 + 10) * min)).toBe('2 h 10 min')
    expect(relative((3 * 1440 + 4 * 60 + 9) * min)).toBe('3 d 4 h')
  })

  test('a past time counts as zero', () => {
    expect(relative(-1000)).toBe('menos de 1 min')
  })
})

describe('dates', () => {
  const now = new Date(2026, 9, 8, 16, 30)

  test('5-hour window says hoy on the same day, the weekday after midnight', () => {
    expect(shortDate(new Date(2026, 9, 8, 18, 40), now)).toBe('hoy 18:40')
    expect(shortDate(new Date(2026, 9, 9, 1, 5), now)).toBe('vie 01:05')
  })

  test('weekly window is weekday, day and month, no time', () => {
    expect(longDate(new Date(2026, 9, 12, 3, 0))).toBe('lun 12 de oct')
  })
})

describe('resetText', () => {
  const now = new Date(2026, 9, 8, 16, 30).getTime()

  test('relative first, date in parentheses', () => {
    const at = new Date(2026, 9, 8, 18, 40).toISOString()

    expect(resetText('five_hour', at, now)).toBe('Restablece en 2 h 10 min (hoy 18:40)')
  })

  test('weekly uses the long date', () => {
    const at = new Date(2026, 9, 12, 20, 30).toISOString()

    expect(resetText('seven_day', at, now)).toBe('Restablece en 4 d 4 h (lun 12 de oct)')
  })

  test('no or invalid timestamp gives no text', () => {
    expect(resetText('five_hour', undefined, now)).toBe('')
    expect(resetText('five_hour', 'nope', now)).toBe('')
  })
})

describe('rowOf', () => {
  const now = new Date(2026, 9, 8, 16, 30).getTime()

  test('maps the two plan windows and ignores the rest', () => {
    expect(rowOf({ kind: 'five_hour', percentUsed: 23.5 }, now)?.label).toBe('5 horas')
    expect(rowOf({ kind: 'seven_day', percentUsed: 7 }, now)?.label).toBe('Semana')
    expect(rowOf({ kind: 'spend_limit', percentUsed: 50 }, now)).toBeNull()
  })
})

describe('fitReset', () => {
  const row = {
    label: '5 horas',
    percent: 23,
    level: 'green' as const,
    bar: bar(23),
    reset: 'Restablece en 2 h 10 min (hoy 18:40)'
  }

  test('whole when it fits', () => {
    expect(fitReset(row, 80)).toBe(row.reset)
  })

  test('drops the date, then everything, as the room shrinks', () => {
    expect(fitReset(row, head(row).length + 3 + 'Restablece en 2 h 10 min'.length)).toBe('Restablece en 2 h 10 min')
    expect(fitReset(row, head(row).length + 3)).toBe('')
  })
})
