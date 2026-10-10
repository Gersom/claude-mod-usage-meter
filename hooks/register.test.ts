import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80 } as never
} as const

const engineBand = { type: 'Box' as const, props: {}, children: [] }

// The person's settings say Spanish: the panel is drawn in it.
const spanish = () => ({ value: { language: 'Español' } }) as never

const window = { window: 200000, tokens: 84000, percent: 42 }

test('draws nothing until there is a reading', async ($, on) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  mock.clock(on, { now: Date.now() })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Text', text: /Ventana de contexto/ })).toBeUndefined()
  await ui.unmount()
})

test('draws context and both plan windows as percentages', async ($, on) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  mock.clock(on, { now: Date.now() })

  const inTwoHours = new Date(Date.now() + 2 * 3600000).toISOString()

  await $.session.measure({
    context: window,
    rateLimits: [
      { kind: 'five_hour', percentUsed: 23, resetsAt: inTwoHours },
      { kind: 'seven_day', percentUsed: 7 }
    ],
    changed: ['context', 'rateLimits']
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'usage-meter', surface, ...BAND })

    expect(await ui.find({ type: 'Text', text: /Ventana de contexto/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Límite de 5 horas/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Límite semanal/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /42%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^84k$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /de 200k/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Restablece en/ })).toBeDefined()
    await ui.unmount()
  }
})

test('draws the context by category', async ($, on) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: {
        ...window,
        breakdown: {
          categories: [
            { name: 'System prompt', tokens: 4000, color: 'a', isDeferred: false, kind: 'used' },
            { name: 'Messages', tokens: 80000, color: 'b', isDeferred: false, kind: 'used' },
            { name: 'Free space', tokens: 116000, color: 'c', isDeferred: false, kind: 'free' }
          ]
        }
      },
      rateLimits: [],
      cost: { usd: 0 }
    }
  }) as never)
  mock.clock(on, { now: Date.now() })

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Button', key: 'categories' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /System prompt/ })).toBeUndefined()

  await ui.press({ key: 'categories' })

  expect(await ui.find({ type: 'Text', text: /System prompt/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Messages/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Libre/ })).toBeDefined()

  await ui.press({ key: 'categories' })

  expect(await ui.find({ type: 'Text', text: /System prompt/ })).toBeUndefined()
  await ui.unmount()
})

test('folds to one line per measure and unfolds again', async ($, on) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: {
        ...window,
        breakdown: {
          categories: [
            { name: 'System prompt', tokens: 4000, color: 'a', isDeferred: false, kind: 'used' },
            { name: 'Free space', tokens: 196000, color: 'c', isDeferred: false, kind: 'free' }
          ]
        }
      },
      rateLimits: [],
      cost: { usd: 0 }
    }
  }) as never)
  mock.clock(on, { now: Date.now() })

  await $.session.measure({
    context: window,
    rateLimits: [{ kind: 'five_hour', percentUsed: 23 }],
    changed: ['context', 'rateLimits']
  })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Button', key: 'compact', text: /Compactar/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'categories' })).toBeDefined()

  await ui.press({ key: 'categories' })
  await ui.press({ key: 'compact' })

  expect(await ui.find({ type: 'Button', key: 'compact', text: /Expandir/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'categories' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /System prompt/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Ventana de contexto/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Límite de 5 horas/ })).toBeDefined()

  await ui.press({ key: 'compact' })

  expect(await ui.find({ type: 'Button', key: 'categories' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /System prompt/ })).toBeDefined()
  await ui.unmount()
})

test('puts everything on a single line and unfolds again', async ($, on) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  mock.clock(on, { now: Date.now() })

  const inTwoHours = new Date(Date.now() + 2 * 3600000 + 30000).toISOString()

  await $.session.measure({
    context: window,
    rateLimits: [
      { kind: 'five_hour', percentUsed: 17, resetsAt: inTwoHours },
      { kind: 'seven_day', percentUsed: 26 }
    ],
    changed: ['context', 'rateLimits']
  })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Button', key: 'line', text: /Una línea/ })).toBeDefined()

  await ui.press({ key: 'line' })

  expect(await ui.find({ type: 'Button', key: 'line', text: /Expandir/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Contexto/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Límite 5h/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Semanal/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /\(84k\)/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /\(2h 0m\)/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Ventana de contexto/ })).toBeUndefined()

  await ui.press({ key: 'line' })

  expect(await ui.find({ type: 'Text', text: /Ventana de contexto/ })).toBeDefined()
  await ui.unmount()
})

test('keeps the plan windows in view when the band has little room', async ($, on) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: {
        ...window,
        breakdown: {
          categories: [
            { name: 'System prompt', tokens: 4000, color: 'a', isDeferred: false, kind: 'used' },
            { name: 'Messages', tokens: 80000, color: 'b', isDeferred: false, kind: 'used' },
            { name: 'Free space', tokens: 116000, color: 'c', isDeferred: false, kind: 'free' }
          ]
        }
      },
      rateLimits: [],
      cost: { usd: 0 }
    }
  }) as never)
  mock.clock(on, { now: Date.now() })

  await $.session.measure({
    context: window,
    rateLimits: [
      { kind: 'five_hour', percentUsed: 23 },
      { kind: 'seven_day', percentUsed: 7 }
    ],
    changed: ['context', 'rateLimits']
  })

  const tight = { ...BAND, props: { hasSurvey: false, isWorking: false, maxRows: 8, bodyColumns: 80 } as never }
  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...tight })

  expect(await ui.find({ type: 'Text', text: /Límite de 5 horas/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Límite semanal/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /System prompt/ })).toBeUndefined()
  await ui.unmount()
})

test('draws the context without categories when the session gives none', async ($, on) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.usage', () => {
    throw new Error('no breakdown')
  })
  mock.clock(on, { now: Date.now() })

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Text', text: /Ventana de contexto/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Libre/ })).toBeUndefined()
  await ui.unmount()
})

test('speaks English when the settings name no language, or one the panel does not have', async ($, on) => {
  on('ui.render', () => engineBand)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  mock.clock(on, { now: Date.now() })

  // No settings.read hook answers: nothing says a language.
  await $.session.measure({
    context: window,
    rateLimits: [{ kind: 'seven_day', percentUsed: 7 }],
    changed: ['context', 'rateLimits']
  })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Text', text: /Context window/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Weekly limit/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Ventana de contexto/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'compact', text: /Compact/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'lang', text: /EN/ })).toBeDefined()
  await ui.unmount()
})

test('speaks the language settings.language names, in any spelling', async ($, on) => {
  on('ui.render', () => engineBand)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('settings.read', () => ({ value: { language: 'english' } }) as never)
  mock.clock(on, { now: Date.now() })

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Text', text: /Context window/ })).toBeDefined()
  await ui.unmount()
})

test('switches the language by hand and back', async ($, on) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  mock.clock(on, { now: Date.now() })

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Text', text: /Ventana de contexto/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'lang', text: /ES/ })).toBeDefined()

  await ui.press({ key: 'lang' })

  expect(await ui.find({ type: 'Text', text: /Context window/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Ventana de contexto/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'lang', text: /EN/ })).toBeDefined()

  // A new reading does not take the choice back to what the settings say.
  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  expect(await ui.find({ type: 'Text', text: /Context window/ })).toBeDefined()

  await ui.press({ key: 'lang' })

  expect(await ui.find({ type: 'Text', text: /Ventana de contexto/ })).toBeDefined()
  await ui.unmount()
})

test('yields to a survey', async ($, on) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  mock.clock(on, { now: Date.now() })

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({
    plugin: 'usage-meter',
    surface: 'terminal',
    ...BAND,
    props: { hasSurvey: true, isWorking: false, maxRows: 10, bodyColumns: 80 } as never
  })

  expect(await ui.find({ type: 'Text', text: /Ventana de contexto/ })).toBeUndefined()
  await ui.unmount()
})

// Another plugin that draws in the band beneath this one, as cache-watch does.
const other = {
  name: 'other-band',
  tier: 'append' as const,
  register: (on: any) => {
    on('ui.render', { component: 'AbovePrompt' }, () => ({
      type: 'Box',
      props: {},
      children: [{ type: 'Text', props: {}, children: ['OTHER BAND'] }]
    }))
  }
}

test('lives beside another hook of the band: keeps what is below under the meter', { plugins: [other] }, async ($, on) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  mock.clock(on, { now: Date.now() })

  // Nothing read yet: only the other band draws.
  const before = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await before.find({ type: 'Text', text: /OTHER BAND/ })).toBeDefined()
  expect(await before.find({ type: 'Text', text: /Ventana de contexto/ })).toBeUndefined()
  await before.unmount()

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Text', text: /OTHER BAND/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Ventana de contexto/ })).toBeDefined()
  await ui.unmount()
})
