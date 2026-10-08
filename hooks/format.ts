import type { UsageLimit } from '../types'

export type Level = 'green' | 'yellow' | 'red'

export type Row = {
  label: string
  percent: number
  level: Level
  bar: string
  reset: string
}

const BAR_CELLS = 10
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const LABELS: Record<string, string> = {
  five_hour: '5 horas',
  seven_day: 'Semana'
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export const clampPercent = (percent: number) => Math.max(0, Math.min(100, Math.round(percent)))

export const level = (percent: number): Level => (percent >= 90 ? 'red' : percent > 70 ? 'yellow' : 'green')

export const bar = (percent: number) => {
  const filled = Math.round((clampPercent(percent) / 100) * BAR_CELLS)

  return '█'.repeat(filled) + '░'.repeat(BAR_CELLS - filled)
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

  return { label, percent, level: level(percent), bar: bar(percent), reset: resetText(limit.kind, limit.resetsAt, nowMs) }
}

export const contextRow = (percent: number): Row => {
  const p = clampPercent(percent)

  return { label: 'Contexto', percent: p, level: level(p), bar: bar(p), reset: '' }
}

/** The part of a row left of its reset text: label, bar and percent. */
export const head = (row: Row) => `${row.label.padEnd(9)} ${row.bar} ${String(row.percent).padStart(3)}%`

/**
 * Reset text that fits `columns`: whole, then without the parenthesised date,
 * then none.
 */
export const fitReset = (row: Row, columns: number) => {
  if (!row.reset) return ''

  const room = columns - head(row).length - 3

  if (row.reset.length <= room) return row.reset

  const short = row.reset.replace(/ \(.*\)$/, '')

  return short.length <= room ? short : ''
}
