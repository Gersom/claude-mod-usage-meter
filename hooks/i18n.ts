import type { Lang } from '../types'

/** Every word the panel writes itself, in one language. The engine's own words (category names) are not here. */
export type Texts = {
  lang: Lang
  context: string
  contextShort: string
  fiveHour: string
  fiveHourShort: string
  sevenDay: string
  sevenDayShort: string
  free: string
  buffer: string
  /** The band's button: opens the pane, or closes it when it is open. */
  open: string
  close: string
  /** The pane when there is no reading yet. */
  nothing: string
  paneUnavailable: (reason: string | null) => string
  commandDescription: string
  commandUsage: string
  /** What `/usage-meter` answers once the pane is open, and once it is closed. */
  paneOpened: string
  paneClosed: string
  /** Between the tokens used and the window: `84k de 200k`. */
  of: string
  today: string
  lessThanMinute: string
  weekdays: readonly string[]
  months: readonly string[]
  resetsIn: (left: string, date: string) => string
  weekDate: (weekday: string, day: string, month: string) => string
}

/** The language the panel speaks when settings.language names none it knows. */
export const DEFAULT_LANG: Lang = 'en'

export const TEXTS: Record<Lang, Texts> = {
  es: {
    lang: 'es',
    context: 'Ventana de contexto',
    contextShort: 'Contexto',
    fiveHour: 'Límite de 5 horas',
    fiveHourShort: 'Límite 5h',
    sevenDay: 'Límite semanal',
    sevenDayShort: 'Semanal',
    free: 'Libre',
    buffer: 'Búfer',
    open: 'Abrir',
    close: 'Cerrar',
    nothing: 'Aún no hay lecturas.',
    paneUnavailable: reason => `El panel no está disponible aquí${reason ? `: ${reason}` : ''}`,
    commandDescription: 'Abre o cierra el panel de Usage Meter.',
    commandUsage: 'Uso: /usage-meter [open|close]. Sin argumento, alterna el panel.',
    paneOpened: 'Panel de Usage Meter abierto',
    paneClosed: 'Panel de Usage Meter cerrado',
    of: 'de',
    today: 'hoy',
    lessThanMinute: 'menos de 1 min',
    weekdays: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
    resetsIn: (left, date) => `Restablece en ${left} (${date})`,
    weekDate: (weekday, day, month) => `${weekday} ${day} de ${month}`
  },
  en: {
    lang: 'en',
    context: 'Context window',
    contextShort: 'Context',
    fiveHour: '5-hour limit',
    fiveHourShort: '5-hour limit',
    sevenDay: 'Weekly limit',
    sevenDayShort: 'Weekly',
    free: 'Free',
    buffer: 'Buffer',
    open: 'Open',
    close: 'Close',
    nothing: 'No readings yet.',
    paneUnavailable: reason => `The pane is not available here${reason ? `: ${reason}` : ''}`,
    commandDescription: 'Open or close the Usage Meter pane.',
    commandUsage: 'Usage: /usage-meter [open|close]. With no argument, it toggles the pane.',
    paneOpened: 'Usage Meter pane opened',
    paneClosed: 'Usage Meter pane closed',
    of: 'of',
    today: 'today',
    lessThanMinute: 'less than 1 min',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    resetsIn: (left, date) => `Resets in ${left} (${date})`,
    weekDate: (weekday, day, month) => `${weekday}, ${month} ${day}`
  }
}

export const textsOf = (lang: Lang) => TEXTS[lang]

/** The first word of the setting's value in lowercase letters, accents and case gone: `Español` is `espanol`. */
const firstWord = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .find(word => word !== '') ?? ''

const SPANISH = ['es', 'esp', 'spa', 'spanish', 'espanol', 'castellano']

/**
 * The panel's language for the value of `settings.language` (free text: `spanish`, `Español`, `es-MX`...).
 * Spanish when it names Spanish; any other value, or none, gives the default, English.
 */
export const detectLang = (language: unknown): Lang =>
  typeof language === 'string' && SPANISH.includes(firstWord(language)) ? 'es' : DEFAULT_LANG

/** The other language, for the button that switches by hand. */
export const otherLang = (lang: Lang): Lang => (lang === 'es' ? 'en' : 'es')
