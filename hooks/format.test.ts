import { describe, expect, test } from 'claude-code/testing'

import {
  compactTokens,
  contextRow,
  legendLines,
  level,
  longDate,
  percentBadge,
  relative,
  resetRelative,
  resetText,
  rowOf,
  rowsOf,
  shortDate,
  slicesOf,
  splitNote,
  tokensText,
  withPercent
} from './format'
import { TEXTS } from './i18n'

const es = TEXTS.es
const en = TEXTS.en

const reading = (percent: number, tokens: number | null = null, window = 200000) => ({
  percent,
  tokens,
  window,
  categories: []
})

describe('level', () => {
  test('green up to 60, yellow up to 80, red above 80', () => {
    expect(level(0)).toBe('green')
    expect(level(60)).toBe('green')
    expect(level(61)).toBe('yellow')
    expect(level(80)).toBe('yellow')
    expect(level(81)).toBe('red')
    expect(level(100)).toBe('red')
  })
})

describe('percentBadge', () => {
  test('the percent padded for its colored background', () => {
    expect(percentBadge(42)).toBe(' 42% ')
    expect(percentBadge(7.4)).toBe(' 7% ')
    expect(percentBadge(140)).toBe(' 100% ')
  })
})

describe('relative', () => {
  const min = 60000

  test('minutes, hours and days', () => {
    expect(relative(0, es)).toBe('menos de 1 min')
    expect(relative(45 * min, es)).toBe('45 min')
    expect(relative((2 * 60 + 10) * min, es)).toBe('2 h 10 min')
    expect(relative((3 * 1440 + 4 * 60 + 9) * min, es)).toBe('3 d 4 h')
  })

  test('a past time counts as zero', () => {
    expect(relative(-1000, es)).toBe('menos de 1 min')
  })
})

describe('dates', () => {
  const now = new Date(2026, 9, 8, 16, 30)

  test('5-hour window says hoy on the same day, the weekday after midnight', () => {
    expect(shortDate(new Date(2026, 9, 8, 18, 40), now, es)).toBe('hoy 18:40')
    expect(shortDate(new Date(2026, 9, 9, 1, 5), now, es)).toBe('vie 01:05')
  })

  test('weekly window is weekday, day and month, no time', () => {
    expect(longDate(new Date(2026, 9, 12, 3, 0), es)).toBe('lun 12 de oct')
  })
})

describe('resetText', () => {
  const now = new Date(2026, 9, 8, 16, 30).getTime()

  test('relative first, date in parentheses', () => {
    const at = new Date(2026, 9, 8, 18, 40).toISOString()

    expect(resetText('five_hour', at, now, es)).toBe('Restablece en 2 h 10 min (hoy 18:40)')
  })

  test('weekly uses the long date', () => {
    const at = new Date(2026, 9, 12, 20, 30).toISOString()

    expect(resetText('seven_day', at, now, es)).toBe('Restablece en 4 d 4 h (lun 12 de oct)')
  })

  test('no or invalid timestamp gives no text', () => {
    expect(resetText('five_hour', undefined, now, es)).toBe('')
    expect(resetText('five_hour', 'nope', now, es)).toBe('')
  })
})

describe('short titles', () => {
  const now = new Date(2026, 9, 8, 16, 30).getTime()

  test('the context gives its short title', () => {
    expect(contextRow(reading(30, 245000), es).short).toBe('Contexto')
  })

  test('the limits give their short title', () => {
    const at = new Date(2026, 9, 8, 18, 22).toISOString()

    expect(rowOf({ kind: 'five_hour', percentUsed: 17, resetsAt: at }, now, es)?.short).toBe('Límite 5h')
    expect(rowOf({ kind: 'seven_day', percentUsed: 26 }, now, es)?.short).toBe('Semanal')
  })
})

describe('resetRelative', () => {
  const now = new Date(2026, 9, 8, 16, 30).getTime()

  test('the time left, without the rest of the note', () => {
    expect(resetRelative(new Date(2026, 9, 8, 18, 40).toISOString(), now, es)).toBe('2 h 10 min')
    expect(resetRelative(new Date(2026, 9, 12, 20, 30).toISOString(), now, es)).toBe('4 d 4 h')
  })

  test('no or invalid timestamp gives nothing', () => {
    expect(resetRelative(undefined, now, es)).toBe('')
    expect(resetRelative('nope', now, es)).toBe('')
  })
})

describe('splitNote', () => {
  test('splits the note around its strong part', () => {
    expect(splitNote('Restablece en 2 h 10 min (hoy 18:40)', '2 h 10 min')).toEqual([
      'Restablece en ',
      '2 h 10 min',
      ' (hoy 18:40)'
    ])
    expect(splitNote('84k de 200k', '84k')).toEqual(['', '84k', ' de 200k'])
  })

  test('without a strong part, or one the note lacks, it is all before', () => {
    expect(splitNote('84k de 200k', '')).toEqual(['84k de 200k', '', ''])
    expect(splitNote('84k de 200k', '1M')).toEqual(['84k de 200k', '', ''])
  })
})

describe('rowOf', () => {
  const now = new Date(2026, 9, 8, 16, 30).getTime()

  test('maps the two plan windows and ignores the rest', () => {
    expect(rowOf({ kind: 'five_hour', percentUsed: 23.5 }, now, es)?.label).toBe('Límite de 5 horas')
    expect(rowOf({ kind: 'seven_day', percentUsed: 7 }, now, es)?.label).toBe('Límite semanal')
    expect(rowOf({ kind: 'spend_limit', percentUsed: 50 }, now, es)).toBeNull()
  })

  test('keys the row by its limit kind and colors it as a limit', () => {
    const row = rowOf({ kind: 'five_hour', percentUsed: 23 }, now, es)

    expect(row?.key).toBe('five_hour')
    expect(row?.accent).toBe('#a78bfa')
  })
})

describe('rowsOf', () => {
  const now = new Date(2026, 9, 8, 16, 30).getTime()

  test('context first, then the plan windows in the order given', () => {
    const rows = rowsOf(
      { context: reading(42), limits: [{ kind: 'seven_day', percentUsed: 7 }, { kind: 'spend_limit', percentUsed: 1 }] },
      now,
      es
    )

    expect(rows.map(row => row.key)).toEqual(['context', 'seven_day'])
  })

  test('no context reading leaves the context row out', () => {
    expect(rowsOf({ context: null, limits: [] }, now, es)).toEqual([])
  })
})

describe('compactTokens', () => {
  test('plain below a thousand, k and M above', () => {
    expect(compactTokens(850)).toBe('850')
    expect(compactTokens(1500)).toBe('1.5k')
    expect(compactTokens(90000)).toBe('90k')
    expect(compactTokens(200000)).toBe('200k')
    expect(compactTokens(1000000)).toBe('1M')
    expect(compactTokens(1250000)).toBe('1.3M')
  })
})

describe('tokensText', () => {
  test('tokens used of the window', () => {
    expect(tokensText(reading(9, 90000, 1000000), es)).toBe('90k de 1M')
  })

  test('no token count gives no text', () => {
    expect(tokensText(reading(9), es)).toBe('')
  })
})

describe('slicesOf', () => {
  const categories = [
    { name: 'System prompt', tokens: 4000, kind: 'used' as const },
    { name: 'Messages', tokens: 36000, kind: 'used' as const },
    { name: 'Free space', tokens: 140000, kind: 'free' as const },
    { name: 'Autocompact buffer', tokens: 20000, kind: 'buffer' as const },
    { name: 'MCP tools (deferred)', tokens: 9000, kind: 'deferred' as const }
  ]

  test('lists what sits in the window, leaving out what is deferred', () => {
    const slices = slicesOf(categories, es)

    expect(slices.map(slice => slice.name)).toEqual(['System prompt', 'Messages', 'Libre', 'Búfer'])
    expect(slices.map(slice => slice.tokens)).toEqual([4000, 36000, 140000, 20000])
  })

  test('shares are of what sits in the window', () => {
    expect(slicesOf(categories, es).map(slice => slice.percent)).toEqual([2, 18, 70, 10])
  })

  test('free and buffer have their own colors, used ones are colored by name', () => {
    const slices = slicesOf(categories, es)

    expect(slices[0]?.color).toBe('#60a5fa')
    expect(slices[1]?.color).toBe('#a78bfa')
    expect(slices[2]?.color).toBe('#2f3442')
    expect(slices[3]?.color).toBe('#4b5263')
  })

  test('Messages and MCP server instructions have swapped colors', () => {
    const slices = slicesOf(
      [
        { name: 'MCP server instructions', tokens: 700, kind: 'used' },
        { name: 'Messages', tokens: 147000, kind: 'used' },
        { name: 'Free space', tokens: 771000, kind: 'free' }
      ],
    es
  )

    expect(slices[0]?.color).toBe('#fb923c')
    expect(slices[1]?.color).toBe('#a78bfa')
  })

  test('a category the meter does not know takes the next fallback color', () => {
    const slices = slicesOf(
      [
        { name: 'Something new', tokens: 1000, kind: 'used' },
        { name: 'Another one', tokens: 1000, kind: 'used' },
        { name: 'Free space', tokens: 8000, kind: 'free' }
      ],
    es
  )

    expect(slices[0]?.color).toBe('#94a3b8')
    expect(slices[1]?.color).toBe('#2dd4bf')
  })

  test('nothing to draw without tokens', () => {
    expect(slicesOf([], es)).toEqual([])
    expect(slicesOf([{ name: 'Free space', tokens: 0, kind: 'free' }], es)).toEqual([])
  })
})

describe('legendLines', () => {
  const slices = slicesOf(
    [
      { name: 'System prompt', tokens: 4000, kind: 'used' },
      { name: 'Messages', tokens: 36000, kind: 'used' },
      { name: 'Free space', tokens: 140000, kind: 'free' },
      { name: 'Autocompact buffer', tokens: 20000, kind: 'buffer' }
    ],
    es
  )
  // Widths: `■ System prompt (2% ≈ 4k)` 25, `■ Messages (18% ≈ 36k)` 22, `■ Libre (70% ≈ 140k)` 20, `■ Búfer (10% ≈ 20k)` 19; 2 apart.
  const sizes = (lines: { length: number }[]) => lines.map(line => line.length)

  test('each item carries its name, tokens and percent as they are, unpadded', () => {
    const lines = legendLines(slices, 200)

    expect(lines[0]?.map(item => item.name)).toEqual(['System prompt', 'Messages', 'Libre', 'Búfer'])
    expect(lines[0]?.map(item => item.tokens)).toEqual(['4k', '36k', '140k', '20k'])
    expect(lines[0]?.map(item => item.percent)).toEqual(['2%', '18%', '70%', '10%'])
  })

  test('flows into lines as the width allows, never leaving an item out', () => {
    expect(sizes(legendLines(slices, 200))).toEqual([4])
    expect(sizes(legendLines(slices, 75))).toEqual([3, 1])
    expect(sizes(legendLines(slices, 49))).toEqual([2, 2])
    expect(sizes(legendLines(slices, 10))).toEqual([1, 1, 1, 1])
  })

  test('nothing to list without slices', () => {
    expect(legendLines([], 80)).toEqual([])
  })
})

describe('contextRow', () => {
  test('is colored blue and has no reset text', () => {
    const row = contextRow(reading(42), es)

    expect(row.accent).toBe('#60a5fa')
    expect(row.reset).toBe('')
  })

  test('carries its tokens as detail', () => {
    expect(contextRow(reading(42, 84000), es).detail).toBe('84k de 200k')
    expect(contextRow(reading(42), es).detail).toBe('')
  })

  test('its tokens are the strong part of its note', () => {
    expect(contextRow(reading(42, 84000), es).strong).toBe('84k')
    expect(contextRow(reading(42), es).strong).toBe('')
  })
})

describe('withPercent', () => {
  test('shows another percent, keeping the rest of the row', () => {
    const row = contextRow(reading(90), es)
    const moved = withPercent(row, 40)

    expect(moved.percent).toBe(40)
    expect(moved.label).toBe('Ventana de contexto')
    expect(moved.level).toBe('red')
  })
})
