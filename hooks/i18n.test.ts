import { describe, expect, test } from 'claude-code/testing'

import { contextRow, longDate, relative, resetText, rowOf, shortDate, slicesOf, tokensText } from './format'
import { DEFAULT_LANG, TEXTS, detectLang, otherLang, textsOf } from './i18n'

const es = TEXTS.es
const en = TEXTS.en

describe('detectLang', () => {
  test('Spanish, however the setting names it', () => {
    for (const value of ['Español', 'español', 'ESPAÑOL', 'Spanish', 'spanish', 'es', 'es-MX', 'es_ES', 'Castellano', ' spanish (Spain) ']) {
      expect(detectLang(value)).toBe('es')
    }
  })

  test('English, and any language the panel does not have, give English', () => {
    for (const value of ['English', 'english', 'en', 'en-US', 'japanese', 'french', 'Estonian', 'português', 'esperanto']) {
      expect(detectLang(value)).toBe('en')
    }
  })

  test('no setting, or one that is not text, gives the default: English', () => {
    expect(DEFAULT_LANG).toBe('en')
    expect(detectLang(undefined)).toBe('en')
    expect(detectLang(null)).toBe('en')
    expect(detectLang(42)).toBe('en')
    expect(detectLang('')).toBe('en')
    expect(detectLang('   ')).toBe('en')
  })
})

describe('textsOf and otherLang', () => {
  test('each language has its own texts, and the switch goes to the other one', () => {
    expect(textsOf('es')).toBe(es)
    expect(textsOf('en')).toBe(en)
    expect(otherLang('es')).toBe('en')
    expect(otherLang('en')).toBe('es')
  })

  test('both languages have a word for everything', () => {
    const keys = (t: object) => Object.keys(t).sort()

    expect(keys(en)).toEqual(keys(es))

    for (const t of [es, en]) {
      expect(t.weekdays).toHaveLength(7)
      expect(t.months).toHaveLength(12)
      expect(t.weekdays.every(day => day !== '')).toBe(true)
      expect(t.months.every(month => month !== '')).toBe(true)
    }
  })
})

describe('the pane texts', () => {
  test('the button, in each language', () => {
    expect([es.open, es.close]).toEqual(['Abrir', 'Cerrar'])
    expect([en.open, en.close]).toEqual(['Open', 'Close'])
  })

  test('the reason a surface gives is added when there is one', () => {
    expect(es.paneUnavailable('sin paneles')).toBe('El panel no está disponible aquí: sin paneles')
    expect(en.paneUnavailable('no panes here')).toBe('The pane is not available here: no panes here')
    expect(en.paneUnavailable(null)).toBe('The pane is not available here')
  })
})

describe('the same figures in English', () => {
  const now = new Date(2026, 9, 8, 16, 30).getTime()

  test('time left', () => {
    expect(relative(0, en)).toBe('less than 1 min')
    expect(relative((2 * 60 + 10) * 60000, en)).toBe('2 h 10 min')
  })

  test('dates', () => {
    expect(shortDate(new Date(2026, 9, 8, 18, 40), new Date(now), en)).toBe('today 18:40')
    expect(shortDate(new Date(2026, 9, 9, 1, 5), new Date(now), en)).toBe('Fri 01:05')
    expect(longDate(new Date(2026, 9, 12, 3, 0), en)).toBe('Mon, Oct 12')
  })

  test('reset text', () => {
    const at = new Date(2026, 9, 8, 18, 40).toISOString()

    expect(resetText('five_hour', at, now, en)).toBe('Resets in 2 h 10 min (today 18:40)')
    expect(resetText('seven_day', new Date(2026, 9, 12, 20, 30).toISOString(), now, en)).toBe('Resets in 4 d 4 h (Mon, Oct 12)')
  })

  test('titles', () => {
    const at = new Date(2026, 9, 8, 18, 40).toISOString()

    expect(rowOf({ kind: 'five_hour', percentUsed: 17, resetsAt: at }, now, en)).toMatchObject({
      label: '5-hour limit',
      short: '5-hour limit'
    })
    expect(rowOf({ kind: 'seven_day', percentUsed: 26 }, now, en)).toMatchObject({ label: 'Weekly limit', short: 'Weekly' })

    const context = contextRow({ percent: 30, tokens: 245000, window: 1000000, categories: [] }, en)

    expect(context).toMatchObject({ label: 'Context window', short: 'Context', detail: '245k of 1M' })
  })

  test('tokens and the legend names', () => {
    expect(tokensText({ percent: 9, tokens: 90000, window: 1000000, categories: [] }, en)).toBe('90k of 1M')

    const slices = slicesOf(
      [
        { name: 'Messages', tokens: 1000, kind: 'used' },
        { name: 'Free space', tokens: 8000, kind: 'free' },
        { name: 'Autocompact buffer', tokens: 1000, kind: 'buffer' }
      ],
      en
    )

    expect(slices.map(slice => slice.name)).toEqual(['Messages', 'Free', 'Buffer'])
  })
})
