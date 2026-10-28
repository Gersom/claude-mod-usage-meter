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

/** The pane, mounted (its content is drawn whether or not the engine placed it). */
const paneView = ($: any, bodyColumns = 60, surface: 'terminal' | 'desktop' = 'terminal') =>
  $.ui.mount({
    plugin: 'usage-meter',
    surface,
    component: 'Pane',
    requestId: 'usage-meter',
    props: { title: 'Usage Meter', isFocused: false, bodyColumns, placement: surface === 'desktop' ? 'dock' : 'inline' } as never
  } as never)

/** The breakdown the session gives for the context: some categories, the free space among them. */
const categories = () => ({
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
}) as never

/** A `ui.open` / `ui.close` beneath the plugin, and the calls that reached them; `isPlaced` false is a surface with no panes. */
const panes = (on: any, isPlaced = true, opened: unknown[] = [], calls: string[] = []) => {
  on('ui.open', (_: unknown, e: { id: string }) => {
    calls.push(`open ${e.id}`)
    opened.push(e)

    return { value: isPlaced ? { isPlaced: true } : { isPlaced: false, reason: 'no panes here' } } as never
  })
  on('ui.close', (_: unknown, e: { id: string }) => {
    calls.push(`close ${e.id}`)

    return { value: undefined } as never
  })

  return { calls, opened }
}

/** Observes `$.ui.toast`: every text the meter shows. */
const watchToasts = (on: any, toasts: string[] = []) => {
  on('ui.toast', (_: unknown, e: { text: string }) => {
    toasts.push(e.text)

    return { value: undefined }
  })

  return toasts
}

/** The bottom a pane test stands on: the band, the settings in Spanish, the clock, the readings and a surface that places panes. */
const meter = (on: any, isPlaced = true, toasts: string[] = []) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($: unknown, e: { changed: unknown }) => ({ changed: e.changed }))
  mock.clock(on, { now: Date.now() })
  watchToasts(on, toasts)

  return panes(on, isPlaced)
}

const usageMeter = ($: any, args = '') => $.command.run({ command: 'usage-meter', args })

test('draws nothing until there is a reading', async ($, on) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  mock.clock(on, { now: Date.now() })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Text', text: /Usage Meter/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'pane' })).toBeUndefined()
  await ui.unmount()
})

test('the band is one line: the name, the three measures as percentages and the two buttons', async ($, on) => {
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

    expect(await ui.find({ type: 'Text', text: /Usage Meter:/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Contexto/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Límite 5h/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Semanal/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /42%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /23%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /7%/ })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'pane', text: /^\[Abrir\]$/ })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'lang', text: /^\[ES\]$/ })).toBeDefined()
    expect(await ui.find({ type: 'Button' })).toBeDefined()
    // Nothing of the pane's detail: no long titles, no data in parentheses, no view or category buttons.
    expect(await ui.find({ type: 'Text', text: /Ventana de contexto/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /\(/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /Restablece/ })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'view' })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'categories' })).toBeUndefined()
    await ui.unmount()
  }
})

test('the band keeps only the measures the plan reports', async ($, on) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  mock.clock(on, { now: Date.now() })

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Text', text: /Contexto/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Límite 5h/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Semanal/ })).toBeUndefined()
  await ui.unmount()
})

test('the pane draws the full view: context, both plan windows and the legend of categories, open', async ($, on) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.usage', categories)
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
    const ui = await paneView($, 60, surface)

    expect(await ui.find({ type: 'Text', text: /Ventana de contexto/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Límite de 5 horas/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Límite semanal/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /42%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^84k$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /de 200k/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Restablece en/ })).toBeDefined()
    // The legend is always open: no button to open it.
    expect(await ui.find({ type: 'Text', text: /System prompt/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Messages/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Libre/ })).toBeDefined()
    // And no buttons at all: language and the pane's own switch live in the band.
    expect(await ui.find({ type: 'Button' })).toBeUndefined()
    await ui.unmount()
  }
})

test('the pane draws the context without categories when the session gives none', async ($, on) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.usage', () => {
    throw new Error('no breakdown')
  })
  mock.clock(on, { now: Date.now() })

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await paneView($)

  expect(await ui.find({ type: 'Text', text: /Ventana de contexto/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Libre/ })).toBeUndefined()
  await ui.unmount()
})

test('the pane says so when there is no reading yet', async ($, on) => {
  on('ui.render', () => engineBand)
  mock.clock(on, { now: Date.now() })

  const ui = await paneView($)

  expect(await ui.find({ type: 'Text', text: /No readings yet/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Context window/ })).toBeUndefined()
  await ui.unmount()
})

test('the button opens the pane and closes it, and its label follows', async ($, on) => {
  const { calls, opened } = meter(on)

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Button', key: 'pane', text: /^\[Abrir\]$/ })).toBeDefined()
  expect(calls).toEqual([])

  await ui.press({ key: 'pane' })
  expect(calls).toEqual(['open usage-meter'])
  expect(opened[0]).toMatchObject({ id: 'usage-meter', title: 'Usage Meter', rows: 22, columns: 60 })
  expect(await ui.find({ type: 'Button', key: 'pane', text: /^\[Cerrar\]$/ })).toBeDefined()

  await ui.press({ key: 'pane' })
  expect(calls).toEqual(['open usage-meter', 'close usage-meter'])
  expect(await ui.find({ type: 'Button', key: 'pane', text: /^\[Abrir\]$/ })).toBeDefined()
  await ui.unmount()
})

test('the meter never opens the pane by itself', async ($, on) => {
  const { calls } = meter(on)

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }) as never)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Button', key: 'pane', text: /Abrir/ })).toBeDefined()
  await ui.unmount()
  expect(calls).toEqual([])
})

test('/usage-meter with no argument toggles the pane, and the answer says which way', async ($, on) => {
  const { calls } = meter(on)

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await usageMeter($)).toEqual({ text: 'Panel de Usage Meter abierto' })
  expect(calls).toEqual(['open usage-meter'])
  expect(await ui.find({ type: 'Button', key: 'pane', text: /Cerrar/ })).toBeDefined()

  expect(await usageMeter($)).toEqual({ text: 'Panel de Usage Meter cerrado' })
  expect(calls).toEqual(['open usage-meter', 'close usage-meter'])
  expect(await ui.find({ type: 'Button', key: 'pane', text: /Abrir/ })).toBeDefined()
  await ui.unmount()
})

test('open only opens and close only closes: the other way round it does nothing', async ($, on) => {
  const { calls } = meter(on)

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await usageMeter($, 'close')).toEqual({ text: 'Panel de Usage Meter cerrado' })
  expect(calls).toEqual([])

  expect(await usageMeter($, 'open')).toEqual({ text: 'Panel de Usage Meter abierto' })
  expect(await usageMeter($, ' OPEN ')).toEqual({ text: 'Panel de Usage Meter abierto' })
  expect(calls).toEqual(['open usage-meter'])
  expect(await ui.find({ type: 'Button', key: 'pane', text: /Cerrar/ })).toBeDefined()

  expect(await usageMeter($, 'close')).toEqual({ text: 'Panel de Usage Meter cerrado' })
  expect(calls).toEqual(['open usage-meter', 'close usage-meter'])
  expect(await ui.find({ type: 'Button', key: 'pane', text: /Abrir/ })).toBeDefined()
  await ui.unmount()
})

test('the button and the command work the same pane: each sees what the other did', async ($, on) => {
  const { calls } = meter(on)

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  await ui.press({ key: 'pane' })
  expect(await usageMeter($)).toEqual({ text: 'Panel de Usage Meter cerrado' })
  expect(await usageMeter($)).toEqual({ text: 'Panel de Usage Meter abierto' })
  await ui.press({ key: 'pane' })
  expect(calls).toEqual(['open usage-meter', 'close usage-meter', 'open usage-meter', 'close usage-meter'])
  await ui.unmount()
})

test('an argument it does not know answers with the usage and changes nothing', async ($, on) => {
  const { calls } = meter(on)

  expect(await usageMeter($, 'toggle')).toEqual({ text: 'Uso: /usage-meter [open|close]. Sin argumento, alterna el panel.' })
  expect(await usageMeter($, 'open now')).toEqual({ text: 'Uso: /usage-meter [open|close]. Sin argumento, alterna el panel.' })
  expect(calls).toEqual([])
})

test('a surface that places no panes: the button toasts the reason and nothing is left waiting', async ($, on) => {
  const toasts: string[] = []
  const { calls } = meter(on, false, toasts)

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  await ui.press({ key: 'pane' })
  expect(calls).toEqual(['open usage-meter', 'close usage-meter'])
  expect(toasts).toEqual(['El panel no está disponible aquí: no panes here'])
  expect(await ui.find({ type: 'Button', key: 'pane', text: /Abrir/ })).toBeDefined()
  await ui.unmount()
})

test('a surface that places no panes: the command answers and toasts the reason', async ($, on) => {
  const toasts: string[] = []
  const { calls } = meter(on, false, toasts)

  expect(await usageMeter($)).toEqual({ text: 'El panel no está disponible aquí: no panes here' })
  expect(toasts).toEqual(['El panel no está disponible aquí: no panes here'])
  expect(calls).toEqual(['open usage-meter', 'close usage-meter'])
})

test('opening is the first asynchronous step of the command: the language is read after it', async ($, on) => {
  const { calls } = panes(on)
  const readsAfter: number[] = []

  mock.clock(on, { now: Date.now() })
  on('settings.read', () => {
    readsAfter.push(calls.length)

    return { value: { language: 'Español' } } as never
  })

  // Nothing settled the language yet, as with a command typed before any other event.
  expect(await usageMeter($)).toEqual({ text: 'Panel de Usage Meter abierto' })
  expect(readsAfter[0]).toBe(1)
})

test('registers /usage-meter at the start of the session, described in the language of the settings', async ($, on) => {
  const commands: unknown[] = []

  mock.clock(on, { now: Date.now() })
  on('settings.read', spanish)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.usage', () => {
    throw new Error('no reading yet')
  })
  on('command.register', (_: unknown, e: { name: string }) => {
    commands.push(e)

    return { value: { command: e.name } } as never
  })

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  expect(commands).toEqual([
    { name: 'usage-meter', description: 'Abre o cierra el panel de Usage Meter.', argumentHint: '[open|close]' }
  ])
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

  expect(await ui.find({ type: 'Text', text: /Context/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Weekly/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Contexto/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'pane', text: /^\[Open\]$/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'lang', text: /EN/ })).toBeDefined()
  await ui.unmount()

  const pane = await paneView($)

  expect(await pane.find({ type: 'Text', text: /Context window/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Weekly limit/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Ventana de contexto/ })).toBeUndefined()
  await pane.unmount()
})

test('speaks the language settings.language names, in any spelling', async ($, on) => {
  on('ui.render', () => engineBand)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('settings.read', () => ({ value: { language: 'english' } }) as never)
  mock.clock(on, { now: Date.now() })

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await paneView($)

  expect(await ui.find({ type: 'Text', text: /Context window/ })).toBeDefined()
  await ui.unmount()
})

test('switches the language by hand and back, in the band and in the pane', async ($, on) => {
  on('ui.render', () => engineBand)
  on('settings.read', spanish)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  mock.clock(on, { now: Date.now() })

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })
  const pane = await paneView($)

  expect(await ui.find({ type: 'Text', text: /Contexto/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Ventana de contexto/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'lang', text: /ES/ })).toBeDefined()

  await ui.press({ key: 'lang' })

  expect(await ui.find({ type: 'Text', text: /Context/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Contexto/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'pane', text: /^\[Open\]$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Context window/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Ventana de contexto/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'lang', text: /EN/ })).toBeDefined()

  // A new reading does not take the choice back to what the settings say.
  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  expect(await pane.find({ type: 'Text', text: /Context window/ })).toBeDefined()

  await ui.press({ key: 'lang' })

  expect(await pane.find({ type: 'Text', text: /Ventana de contexto/ })).toBeDefined()
  await ui.unmount()
  await pane.unmount()
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

  expect(await ui.find({ type: 'Text', text: /Usage Meter/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'pane' })).toBeUndefined()
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
  expect(await before.find({ type: 'Text', text: /Usage Meter/ })).toBeUndefined()
  await before.unmount()

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Text', text: /OTHER BAND/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Usage Meter/ })).toBeDefined()
  await ui.unmount()
})
