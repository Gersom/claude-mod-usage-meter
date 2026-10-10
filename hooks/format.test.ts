import { describe, expect, test } from 'claude-code/testing'

import {
  bar,
  barParts,
  compactTokens,
  contextRow,
  inlineFits,
  legendRows,
  level,
  longDate,
  percentBadge,
  relative,
  resetText,
  rowOf,
  rowsOf,
  shortDate,
  slicesOf,
  tokensText,
  withPercent
} from './format'

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

describe('barParts', () => {
  test('splits the bar into filled and empty cells', () => {
    expect(barParts(42)).toEqual({ filled: '████', empty: '░░░░░░' })
    expect(barParts(0)).toEqual({ filled: '', empty: '░░░░░░░░░░' })
    expect(barParts(100)).toEqual({ filled: '██████████', empty: '' })
  })

  test('takes any width', () => {
    expect(barParts(50, 40).filled).toHaveLength(20)
    expect(barParts(50, 40).empty).toHaveLength(20)
    expect(barParts(100, 7)).toEqual({ filled: '███████', empty: '' })
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

  test('keys the row by its limit kind and colors it as a limit', () => {
    const row = rowOf({ kind: 'five_hour', percentUsed: 23 }, now)

    expect(row?.key).toBe('five_hour')
    expect(row?.accent).toBe('#a78bfa')
  })
})

describe('rowsOf', () => {
  const now = new Date(2026, 9, 8, 16, 30).getTime()

  test('context first, then the plan windows in the order given', () => {
    const rows = rowsOf(
      { context: reading(42), limits: [{ kind: 'seven_day', percentUsed: 7 }, { kind: 'spend_limit', percentUsed: 1 }] },
      now
    )

    expect(rows.map(row => row.key)).toEqual(['context', 'seven_day'])
  })

  test('no context reading leaves the context row out', () => {
    expect(rowsOf({ context: null, limits: [] }, now)).toEqual([])
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
    expect(tokensText(reading(9, 90000, 1000000))).toBe('90k de 1M')
  })

  test('no token count gives no text', () => {
    expect(tokensText(reading(9))).toBe('')
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

  test('fills the bar exactly, leaving out what is deferred', () => {
    const slices = slicesOf(categories, 40)

    expect(slices.map(slice => slice.name)).toEqual(['System prompt', 'Messages', 'Libre', 'Búfer'])
    expect(slices.reduce((sum, slice) => sum + slice.cells, 0)).toBe(40)
    expect(slices.map(slice => slice.cells)).toEqual([1, 7, 28, 4])
  })

  test('shares are of what sits in the window', () => {
    expect(slicesOf(categories, 40).map(slice => slice.percent)).toEqual([2, 18, 70, 10])
  })

  test('a used category with tokens keeps at least one cell', () => {
    const tiny = [
      { name: 'Skills', tokens: 10, kind: 'used' as const },
      { name: 'Free space', tokens: 100000, kind: 'free' as const }
    ]

    expect(slicesOf(tiny, 20).map(slice => slice.cells)).toEqual([1, 19])
  })

  test('free and buffer have their own colors, used ones take the palette in order', () => {
    const slices = slicesOf(categories, 40)

    expect(slices[0].color).toBe('#60a5fa')
    expect(slices[1].color).toBe('#22d3ee')
    expect(slices[2].color).toBe('#2f3442')
  })

  test('nothing to draw without tokens or width', () => {
    expect(slicesOf([], 40)).toEqual([])
    expect(slicesOf(categories, 0)).toEqual([])
  })
})

describe('legendRows', () => {
  const slices = slicesOf(
    [
      { name: 'System prompt', tokens: 4000, kind: 'used' },
      { name: 'Messages', tokens: 36000, kind: 'used' },
      { name: 'Free space', tokens: 140000, kind: 'free' },
      { name: 'Autocompact buffer', tokens: 20000, kind: 'buffer' }
    ],
    40
  )

  test('lines the columns up by padding each field to the widest', () => {
    const [row] = legendRows(slices, 200)

    expect(row.map(item => item.name)).toEqual(['System prompt', 'Messages     ', 'Libre        ', 'Búfer        '])
    expect(row.map(item => item.tokens)).toEqual(['  4k', ' 36k', '140k', ' 20k'])
    expect(row.map(item => item.percent)).toEqual([' 2%', '18%', '70%', '10%'])
  })

  test('wraps into rows when the columns do not fit them all', () => {
    // item: 2 + 13 + 1 + 4 + 1 + 3 = 24 wide, 3 apart
    expect(legendRows(slices, 200)).toHaveLength(1)
    expect(legendRows(slices, 80).map(row => row.length)).toEqual([3, 1])
    expect(legendRows(slices, 51).map(row => row.length)).toEqual([2, 2])
    expect(legendRows(slices, 50).map(row => row.length)).toEqual([1, 1, 1, 1])
    expect(legendRows(slices, 10).map(row => row.length)).toEqual([1, 1, 1, 1])
  })

  test('nothing to list without slices', () => {
    expect(legendRows([], 80)).toEqual([])
  })
})

describe('contextRow', () => {
  test('is colored blue and has no reset text', () => {
    const row = contextRow(reading(42))

    expect(row.accent).toBe('#60a5fa')
    expect(row.reset).toBe('')
  })

  test('carries its tokens as detail', () => {
    expect(contextRow(reading(42, 84000)).detail).toBe('84k de 200k')
    expect(contextRow(reading(42)).detail).toBe('')
  })
})

describe('withPercent', () => {
  test('shows another percent with its own bar, keeping the rest of the row', () => {
    const row = contextRow(reading(90))
    const moved = withPercent(row, 40)

    expect(moved.percent).toBe(40)
    expect(moved.bar).toBe('████░░░░░░')
    expect(moved.label).toBe('Contexto')
    expect(moved.level).toBe('red')
  })
})

describe('inlineFits', () => {
  const now = new Date(2026, 9, 8, 16, 30).getTime()
  const at = new Date(2026, 9, 8, 18, 40).toISOString()
  const row = rowOf({ kind: 'five_hour', percentUsed: 23, resetsAt: at }, now)!

  test('fits on the line when the terminal is wide enough', () => {
    expect(inlineFits(row, 80)).toBe(true)
  })

  test('does not fit when the reset text would overflow', () => {
    const headWidth = 15

    expect(inlineFits(row, headWidth + 3 + row.reset.length)).toBe(true)
    expect(inlineFits(row, headWidth + 3 + row.reset.length - 1)).toBe(false)
  })

  test('a row with no reset text always fits', () => {
    expect(inlineFits(contextRow(reading(42)), 10)).toBe(true)
  })
})
