import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80 } as never
} as const

const engineBand = { type: 'Box' as const, props: {}, children: [] }

const window = { window: 200000, tokens: 84000, percent: 42 }

test('draws nothing until there is a reading', async ($, on) => {
  on('ui.render', () => engineBand)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  mock.clock(on, { now: Date.now() })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Text', text: /Contexto/ })).toBeUndefined()
  await ui.unmount()
})

test('draws context and both plan windows as percentages', async ($, on) => {
  on('ui.render', () => engineBand)
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

    expect(await ui.find({ type: 'Text', text: /Contexto/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /5 horas/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Semana/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /42%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Restablece en/ })).toBeDefined()
    await ui.unmount()
  }
})

test('yields to a survey', async ($, on) => {
  on('ui.render', () => engineBand)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  mock.clock(on, { now: Date.now() })

  await $.session.measure({ context: window, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({
    plugin: 'usage-meter',
    surface: 'terminal',
    ...BAND,
    props: { hasSurvey: true, isWorking: false, maxRows: 10, bodyColumns: 80 } as never
  })

  expect(await ui.find({ type: 'Text', text: /Contexto/ })).toBeUndefined()
  await ui.unmount()
})
