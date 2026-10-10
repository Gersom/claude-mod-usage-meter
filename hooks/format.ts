import type { Category, ContextReading, Usage, UsageLimit } from '../types'

export type Level = 'green' | 'yellow' | 'red'

export type Row = {
  key: string
  label: string
  percent: number
  level: Level
  accent: string
  bar: string
  reset: string
  /** Extra text after the label, such as the context's tokens; empty when there is none. */
  detail: string
}

export const CONTEXT_ACCENT = '#60a5fa'
export const LIMIT_ACCENT = '#a78bfa'

const BAR_CELLS = 10
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const LABELS: Record<string, string> = {
  five_hour: '5 horas',
  seven_day: 'Semana'
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export const clampPercent = (percent: number) => Math.max(0, Math.min(100, Math.round(percent)))

export const level = (percent: number): Level => (percent > 80 ? 'red' : percent > 60 ? 'yellow' : 'green')

const filledCells = (percent: number) => Math.round((clampPercent(percent) / 100) * BAR_CELLS)

export const bar = (percent: number) => {
  const filled = filledCells(percent)

  return '█'.repeat(filled) + '░'.repeat(BAR_CELLS - filled)
}

/** The bar split in its filled and empty cells, so each can take its own color. */
export const barParts = (percent: number) => {
  const filled = filledCells(percent)

  return { filled: '█'.repeat(filled), empty: '░'.repeat(BAR_CELLS - filled) }
}

/** `2 h 10 min`, `3 d 4 h`, `45 min`; `menos de 1 min` below a minute. */
export const relative = (ms: number) => {
  const minutes = Math.floor(Math.max(0, ms) / 60000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60

  if (days > 0) return `${days} d ${hours} h`
  if (hours > 0) return `${hours} h ${mins} min`
  if (minutes > 0) return `${mins} min`

  return 'menos de 1 min'
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** 5-hour window: `hoy 18:40`, or `lun 18:40` when it crosses midnight. */
export const shortDate = (at: Date, now: Date) => {
  const time = `${pad2(at.getHours())}:${pad2(at.getMinutes())}`

  return sameDay(at, now) ? `hoy ${time}` : `${DAYS[at.getDay()]} ${time}`
}

/** Weekly window: `lun 09 de oct`, no time. */
export const longDate = (at: Date) => `${DAYS[at.getDay()]} ${pad2(at.getDate())} de ${MONTHS[at.getMonth()]}`

export const resetText = (kind: string, resetsAt: string | undefined, nowMs: number) => {
  if (!resetsAt) return ''

  const at = new Date(resetsAt)

  if (Number.isNaN(at.getTime())) return ''

  const date = kind === 'seven_day' ? longDate(at) : shortDate(at, new Date(nowMs))

  return `Restablece en ${relative(at.getTime() - nowMs)} (${date})`
}

export const rowOf = (limit: UsageLimit, nowMs: number): Row | null => {
  const label = LABELS[limit.kind]

  if (!label) return null

  const percent = clampPercent(limit.percentUsed)

  return {
    key: limit.kind,
    label,
    percent,
    level: level(percent),
    accent: LIMIT_ACCENT,
    bar: bar(percent),
    reset: resetText(limit.kind, limit.resetsAt, nowMs),
    detail: ''
  }
}

/** `850`, `90k`, `1.5k`, `1M`: tokens in their shortest readable form. */
export const compactTokens = (tokens: number) => {
  const trim = (n: number) => String(Math.round(n * 10) / 10)

  if (tokens >= 1_000_000) return `${trim(tokens / 1_000_000)}M`
  if (tokens >= 1000) return `${trim(tokens / 1000)}k`

  return String(Math.max(0, Math.round(tokens)))
}

/** `90k de 1M`; empty when the reading has no token count. */
export const tokensText = (context: ContextReading) =>
  context.tokens === null ? '' : `${compactTokens(context.tokens)} de ${compactTokens(context.window)}`

export type Slice = { name: string; kind: Category['kind']; tokens: number; percent: number; cells: number; color: string }

const PALETTE = ['#60a5fa', '#22d3ee', '#a78bfa', '#4ade80', '#facc15', '#f472b6', '#fb923c', '#94a3b8']

export const FREE_COLOR = '#2f3442'
export const BUFFER_COLOR = '#4b5263'

const sliceName = (category: Category) =>
  category.kind === 'free' ? 'Libre' : category.kind === 'buffer' ? 'Búfer' : category.name

/**
 * The categories that sit in the window, each with the cells it takes of a bar `cells` wide
 * (a used category with tokens always gets at least one) and its share of the window.
 */
export const slicesOf = (categories: Category[], cells: number): Slice[] => {
  const shown = categories.filter(category => category.kind !== 'deferred')
  const total = shown.reduce((sum, category) => sum + Math.max(0, category.tokens), 0)

  if (total <= 0 || cells <= 0) return []

  let next = 0

  const slices: Slice[] = shown.map(category => ({
    name: sliceName(category),
    kind: category.kind,
    tokens: category.tokens,
    percent: Math.round((category.tokens / total) * 100),
    cells: 0,
    color: category.kind === 'free' ? FREE_COLOR : category.kind === 'buffer' ? BUFFER_COLOR : PALETTE[next++ % PALETTE.length]
  }))

  const exact = slices.map(slice => (slice.tokens / total) * cells)

  slices.forEach((slice, index) => {
    slice.cells = Math.floor(exact[index])

    if (slice.kind === 'used' && slice.tokens > 0 && slice.cells === 0) slice.cells = 1
  })

  let diff = cells - slices.reduce((sum, slice) => sum + slice.cells, 0)
  const byRemainder = slices.map((_, index) => index).sort((a, b) => (exact[b] % 1) - (exact[a] % 1))

  for (let step = 0; diff > 0; step++, diff--) slices[byRemainder[step % byRemainder.length]].cells++

  for (; diff < 0; diff++) slices.reduce((widest, slice) => (slice.cells > widest.cells ? slice : widest)).cells--

  return slices
}

export const contextRow = (context: ContextReading): Row => {
  const p = clampPercent(context.percent)

  return {
    key: 'context',
    label: 'Contexto',
    percent: p,
    level: level(p),
    accent: CONTEXT_ACCENT,
    bar: bar(p),
    reset: '',
    detail: tokensText(context)
  }
}

/** Every row the meter shows for a usage reading, in display order. */
export const rowsOf = (usage: Usage, nowMs: number): Row[] => {
  const rows: Row[] = []

  if (usage.context !== null) rows.push(contextRow(usage.context))

  for (const limit of usage.limits) {
    const row = rowOf(limit, nowMs)

    if (row) rows.push(row)
  }

  return rows
}

/** The same row showing `percent` instead of its own, as an animation steps toward it. */
export const withPercent = (row: Row, percent: number): Row => {
  const p = clampPercent(percent)

  return { ...row, percent: p, bar: bar(p) }
}

/** The part of a row left of its reset text: label, bar and percent. */
export const head = (row: Row) => `${row.label.padEnd(9)} ${row.bar} ${String(row.percent).padStart(3)}%`

/** Whether the reset text fits on the row's line within `columns`. */
export const inlineFits = (row: Row, columns: number) => {
  if (!row.reset) return true

  return head(row).length + 3 + row.reset.length <= columns
}
