import type { Category, ContextReading, Usage, UsageLimit } from '../types'
import type { Texts } from './i18n'

export type Level = 'green' | 'yellow' | 'red'

export type Row = {
  key: string
  label: string
  percent: number
  level: Level
  accent: string
  reset: string
  /** Extra text after the label, such as the context's tokens; empty when there is none. */
  detail: string
  /** The part of the note (`reset` or `detail`) drawn in the title's color, not dim: the tokens, the time left. */
  strong: string
  /** The short title the single-line view uses: `Contexto`, `Límite 5 horas`, `Semanal`. */
  short: string
  /** What the single-line view shows in parentheses: the tokens (`245k`) or the time left (`1h 52m`); empty when unknown. */
  brief: string
}

export const CONTEXT_ACCENT = '#60a5fa'
export const LIMIT_ACCENT = '#a78bfa'

/** The title and the short title of a plan window in the language; none for a kind the meter does not show. */
const labelsOf = (kind: string, t: Texts) =>
  kind === 'five_hour'
    ? { label: t.fiveHour, short: t.fiveHourShort }
    : kind === 'seven_day'
      ? { label: t.sevenDay, short: t.sevenDayShort }
      : null

const pad2 = (n: number) => String(n).padStart(2, '0')

export const clampPercent = (percent: number) => Math.max(0, Math.min(100, Math.round(percent)))

export const level = (percent: number): Level => (percent > 80 ? 'red' : percent > 60 ? 'yellow' : 'green')

/** The percent as the badge beside the label shows it: ` 42% `. */
export const percentBadge = (percent: number) => ` ${clampPercent(percent)}% `

/** `2 h 10 min`, `3 d 4 h`, `45 min`; `menos de 1 min` (`less than 1 min`) below a minute. */
export const relative = (ms: number, t: Texts) => {
  const minutes = Math.floor(Math.max(0, ms) / 60000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60

  if (days > 0) return `${days} d ${hours} h`
  if (hours > 0) return `${hours} h ${mins} min`
  if (minutes > 0) return `${mins} min`

  return t.lessThanMinute
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** 5-hour window: `hoy 18:40` (`today 18:40`), or `lun 18:40` when it crosses midnight. */
export const shortDate = (at: Date, now: Date, t: Texts) => {
  const time = `${pad2(at.getHours())}:${pad2(at.getMinutes())}`

  return sameDay(at, now) ? `${t.today} ${time}` : `${t.weekdays[at.getDay()]} ${time}`
}

/** Weekly window: `lun 09 de oct` (`Mon, Oct 09`), no time. */
export const longDate = (at: Date, t: Texts) =>
  t.weekDate(t.weekdays[at.getDay()], pad2(at.getDate()), t.months[at.getMonth()])

/** `3d 20h`, `1h 52m`, `45m`; `<1m` below a minute: the time left in its shortest form. */
export const compactRelative = (ms: number) => {
  const minutes = Math.floor(Math.max(0, ms) / 60000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  if (minutes > 0) return `${mins}m`

  return '<1m'
}

/** Milliseconds until the window resets; null without a valid timestamp. */
const msUntil = (resetsAt: string | undefined, nowMs: number) => {
  if (!resetsAt) return null

  const at = new Date(resetsAt).getTime()

  return Number.isNaN(at) ? null : at - nowMs
}

/** The time left until the window resets, as `relative` writes it; empty without a valid timestamp. */
export const resetRelative = (resetsAt: string | undefined, nowMs: number, t: Texts) => {
  const ms = msUntil(resetsAt, nowMs)

  return ms === null ? '' : relative(ms, t)
}

/** The same time left in its shortest form (`compactRelative`); empty without a valid timestamp. */
export const resetCompact = (resetsAt: string | undefined, nowMs: number) => {
  const ms = msUntil(resetsAt, nowMs)

  return ms === null ? '' : compactRelative(ms)
}

export const resetText = (kind: string, resetsAt: string | undefined, nowMs: number, t: Texts) => {
  const left = resetRelative(resetsAt, nowMs, t)

  if (!left) return ''

  const at = new Date(resetsAt!)
  const date = kind === 'seven_day' ? longDate(at, t) : shortDate(at, new Date(nowMs), t)

  return t.resetsIn(left, date)
}

/** A note split around its strong part: what comes before, the part itself and what follows. */
export const splitNote = (note: string, strong: string): [string, string, string] => {
  const at = strong ? note.indexOf(strong) : -1

  return at < 0 ? [note, '', ''] : [note.slice(0, at), strong, note.slice(at + strong.length)]
}

export const rowOf = (limit: UsageLimit, nowMs: number, t: Texts): Row | null => {
  const names = labelsOf(limit.kind, t)

  if (!names) return null

  const percent = clampPercent(limit.percentUsed)

  return {
    key: limit.kind,
    label: names.label,
    percent,
    level: level(percent),
    accent: LIMIT_ACCENT,
    reset: resetText(limit.kind, limit.resetsAt, nowMs, t),
    detail: '',
    strong: resetRelative(limit.resetsAt, nowMs, t),
    short: names.short,
    brief: resetCompact(limit.resetsAt, nowMs)
  }
}

/** `850`, `90k`, `1.5k`, `1M`: tokens in their shortest readable form. */
export const compactTokens = (tokens: number) => {
  const trim = (n: number) => String(Math.round(n * 10) / 10)

  if (tokens >= 1_000_000) return `${trim(tokens / 1_000_000)}M`
  if (tokens >= 1000) return `${trim(tokens / 1000)}k`

  return String(Math.max(0, Math.round(tokens)))
}

/** `90k de 1M` (`90k of 1M`); empty when the reading has no token count. */
export const tokensText = (context: ContextReading, t: Texts) =>
  context.tokens === null ? '' : `${compactTokens(context.tokens)} ${t.of} ${compactTokens(context.window)}`

export type Slice = { name: string; kind: Category['kind']; tokens: number; percent: number; color: string }

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

const sliceName = (category: Category, t: Texts) =>
  category.kind === 'free' ? t.free : category.kind === 'buffer' ? t.buffer : category.name

/** The categories that sit in the window, each with its color and its share of the window. */
export const slicesOf = (categories: Category[], t: Texts): Slice[] => {
  const shown = categories.filter(category => category.kind !== 'deferred')
  const total = shown.reduce((sum, category) => sum + Math.max(0, category.tokens), 0)

  if (total <= 0) return []

  let next = 0

  return shown.map(category => ({
    name: sliceName(category, t),
    kind: category.kind,
    tokens: category.tokens,
    percent: Math.round((category.tokens / total) * 100),
    color:
      category.kind === 'free'
        ? FREE_COLOR
        : category.kind === 'buffer'
          ? BUFFER_COLOR
          : (NAME_COLORS[category.name] ?? PALETTE[next++ % PALETTE.length])
  }))
}

export type LegendItem = { color: string; name: string; tokens: string; percent: string }

export const LEGEND_GAP = 2

/** `■ name (12% ≈ 3.4k)`. */
const itemWidth = (item: LegendItem) => 2 + item.name.length + 2 + item.percent.length + 3 + item.tokens.length + 1

const lineWidth = (line: LegendItem[]) =>
  line.reduce((sum, item, index) => sum + itemWidth(item) + (index > 0 ? LEGEND_GAP : 0), 0)

/** The legend as lines of `■ name (% ≈ tokens)` items, all of them, flowing to fit `columns`. */
export const legendLines = (slices: Slice[], columns: number): LegendItem[][] => {
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

  return lines
}

export const contextRow = (context: ContextReading, t: Texts): Row => {
  const p = clampPercent(context.percent)

  return {
    key: 'context',
    label: t.context,
    percent: p,
    level: level(p),
    accent: CONTEXT_ACCENT,
    reset: '',
    detail: tokensText(context, t),
    strong: context.tokens === null ? '' : compactTokens(context.tokens),
    short: t.contextShort,
    brief: context.tokens === null ? '' : compactTokens(context.tokens)
  }
}

/** Every row the meter shows for a usage reading, in display order. */
export const rowsOf = (usage: Usage, nowMs: number, t: Texts): Row[] => {
  const rows: Row[] = []

  if (usage.context !== null) rows.push(contextRow(usage.context, t))

  for (const limit of usage.limits) {
    const row = rowOf(limit, nowMs, t)

    if (row) rows.push(row)
  }

  return rows
}

/** The same row showing `percent` instead of its own, as an animation steps toward it. */
export const withPercent = (row: Row, percent: number): Row => {
  const p = clampPercent(percent)

  return { ...row, percent: p }
}

/** What the row's header line holds besides its note: marker, label and percent badge. */
export const head = (row: Row) => `◆ ${row.label} ${percentBadge(row.percent)}`

/** Whether the reset text fits on the row's header line within `columns`. */
export const inlineFits = (row: Row, columns: number) => {
  if (!row.reset) return true

  return head(row).length + 3 + row.reset.length <= columns
}
