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
  /** The part of the note (`reset` or `detail`) drawn in the title's color, not dim: the tokens, the time left. */
  strong: string
}

export const CONTEXT_ACCENT = '#60a5fa'
export const LIMIT_ACCENT = '#a78bfa'

const BAR_CELLS = 10
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const LABELS: Record<string, string> = {
  five_hour: 'Límite de 5 horas',
  seven_day: 'Límite semanal'
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export const clampPercent = (percent: number) => Math.max(0, Math.min(100, Math.round(percent)))

export const level = (percent: number): Level => (percent > 80 ? 'red' : percent > 60 ? 'yellow' : 'green')

const filledCells = (percent: number, cells = BAR_CELLS) => Math.round((clampPercent(percent) / 100) * cells)

export const bar = (percent: number) => {
  const filled = filledCells(percent)

  return '█'.repeat(filled) + '░'.repeat(BAR_CELLS - filled)
}

/** The bar, `cells` wide, split in its filled and empty cells so each can take its own color. */
export const barParts = (percent: number, cells = BAR_CELLS) => {
  const filled = filledCells(percent, cells)

  return { filled: '█'.repeat(filled), empty: '░'.repeat(cells - filled) }
}

/** The percent as the badge beside the label shows it: ` 42% `. */
export const percentBadge = (percent: number) => ` ${clampPercent(percent)}% `

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

/** The time left until the window resets, as `relative` writes it; empty without a valid timestamp. */
export const resetRelative = (resetsAt: string | undefined, nowMs: number) => {
  if (!resetsAt) return ''

  const at = new Date(resetsAt)

  return Number.isNaN(at.getTime()) ? '' : relative(at.getTime() - nowMs)
}

export const resetText = (kind: string, resetsAt: string | undefined, nowMs: number) => {
  const left = resetRelative(resetsAt, nowMs)

  if (!left) return ''

  const at = new Date(resetsAt!)
  const date = kind === 'seven_day' ? longDate(at) : shortDate(at, new Date(nowMs))

  return `Restablece en ${left} (${date})`
}

/** A note split around its strong part: what comes before, the part itself and what follows. */
export const splitNote = (note: string, strong: string): [string, string, string] => {
  const at = strong ? note.indexOf(strong) : -1

  return at < 0 ? [note, '', ''] : [note.slice(0, at), strong, note.slice(at + strong.length)]
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
    detail: '',
    strong: resetRelative(limit.resetsAt, nowMs)
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

/** The color of each category the engine names; one it does not know takes the next of PALETTE. */
const NAME_COLORS: Record<string, string> = {
  'System prompt': '#60a5fa',
  'System tools': '#22d3ee',
  'MCP server instructions': '#fb923c',
  'Custom agents': '#4ade80',
  'Memory files': '#facc15',
  Skills: '#f472b6',
  Messages: '#a78bfa'
}

const PALETTE = ['#94a3b8', '#2dd4bf', '#f87171', '#a3e635']

/** The legend's text: darker than the default so the colored markers stand out. */
export const LEGEND_TEXT = '#9ca3af'

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
    color:
      category.kind === 'free'
        ? FREE_COLOR
        : category.kind === 'buffer'
          ? BUFFER_COLOR
          : (NAME_COLORS[category.name] ?? PALETTE[next++ % PALETTE.length])
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

export type LegendItem = { color: string; name: string; tokens: string; percent: string }

export const LEGEND_GAP = 2

/** `■ name (12% ≈ 3.4k)`. */
const itemWidth = (item: LegendItem) => 2 + item.name.length + 2 + item.percent.length + 3 + item.tokens.length + 1

const lineWidth = (line: LegendItem[]) =>
  line.reduce((sum, item, index) => sum + itemWidth(item) + (index > 0 ? LEGEND_GAP : 0), 0)

/**
 * The legend as lines of `■ name tokens %` items flowing to fit `columns`, at most `maxLines` of them.
 * When some do not fit, `hidden` counts the items left out, and the last line leaves room for a note on them.
 */
export const legendLines = (slices: Slice[], columns: number, maxLines: number) => {
  const items: LegendItem[] = slices.map(slice => ({
    color: slice.color,
    name: slice.name,
    tokens: compactTokens(slice.tokens),
    percent: `${slice.percent}%`
  }))
  const lines: LegendItem[][] = []

  for (const item of items) {
    const line = lines[lines.length - 1]

    if (line && lineWidth(line) + LEGEND_GAP + itemWidth(item) <= columns) line.push(item)
    else lines.push([item])
  }

  if (lines.length <= maxLines) return { lines, hidden: 0 }

  const kept = lines.slice(0, Math.max(0, maxLines))

  if (kept.length === 0) return { lines: kept, hidden: items.length }

  const last = kept[kept.length - 1]
  let hidden = items.length - kept.reduce((sum, line) => sum + line.length, 0)

  while (last.length > 1 && lineWidth(last) + LEGEND_GAP + ` +${hidden} más`.length > columns) {
    last.pop()
    hidden++
  }

  return { lines: kept, hidden }
}

export const contextRow = (context: ContextReading): Row => {
  const p = clampPercent(context.percent)

  return {
    key: 'context',
    label: 'Ventana de contexto',
    percent: p,
    level: level(p),
    accent: CONTEXT_ACCENT,
    bar: bar(p),
    reset: '',
    detail: tokensText(context),
    strong: context.tokens === null ? '' : compactTokens(context.tokens)
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

/** What the row's header line holds besides its note: marker, label and percent badge. */
export const head = (row: Row) => `◆ ${row.label} ${percentBadge(row.percent)}`

/** Whether the reset text fits on the row's header line within `columns`. */
export const inlineFits = (row: Row, columns: number) => {
  if (!row.reset) return true

  return head(row).length + 3 + row.reset.length <= columns
}
