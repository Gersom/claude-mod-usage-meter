import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Usage } from '../types'
import { barParts, inlineFits, rowsOf, withPercent } from './format'

const LABEL_WIDTH = 9
const BAR_WIDTH = 11
const PERCENT_WIDTH = 5
const GAP = 3
const STEP_MS = 40
const EASE = 0.35

const usage = atom({ plugin: 'usage-meter', key: 'usage' } as const, null)
const shown = atom({ plugin: 'usage-meter', key: 'shown' } as const, {} as Record<string, number>)

/** The running glide of each row, by key: the percent it moves toward and the timer that moves it. */
const glides = new Map<string, { target: number; timer: { cancel: () => void } }>()

const settle = (key: string) => {
  glides.get(key)?.timer.cancel()
  glides.delete(key)
}

/** Moves the row's shown percent toward `target` a little per step, then stops. */
const glide = ($: EngineInterface, key: string, target: number) => {
  if (glides.get(key)?.target === target) return

  settle(key)

  const timer = $.clock.every(STEP_MS, () => {
    void update($, shown, values => {
      const from = values[key] ?? target
      const next = Math.abs(target - from) <= 1 ? target : Math.round(from + (target - from) * EASE)

      if (next === target) settle(key)

      return { ...values, [key]: next }
    })
  })

  glides.set(key, { target, timer })
}

/** Rows new to the meter appear at their value; rows already shown glide to a changed one. */
const sync = async ($: EngineInterface, current: Usage) => {
  const values = await read($, shown)
  const targets = rowsOf(current, await $.clock.now())
  const fresh: Record<string, number> = {}

  for (const row of targets) {
    if (values[row.key] === undefined) fresh[row.key] = row.percent
    else if (values[row.key] !== row.percent) glide($, row.key, row.percent)
    else settle(row.key)
  }

  if (Object.keys(fresh).length > 0) await update($, shown, values => ({ ...values, ...fresh }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      const now = await $.session.usage()
      const reading: Usage = { context: now.context.percent ?? null, limits: now.rateLimits }

      await update($, usage, () => reading)
      await sync($, reading)
    } catch {
      // No reading yet: the band appears with the first session.measure.
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const next_: Usage = { context: e.context.percent ?? null, limits: e.rateLimits }

    await update($, usage, () => next_)
    await sync($, next_)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, usage)

    if (e.props.hasSurvey || current === null) {
      return next(e)
    }

    const nowMs = await $.clock.now()
    const values = await read($, shown)
    const targets = rowsOf(current, nowMs)

    if (targets.length === 0) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const columns = e.props.bodyColumns - 4

    return (
      <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column">
        <Text color="gray">Uso</Text>
        {targets.map(target => {
          const row = withPercent(target, values[target.key] ?? target.percent)
          const moving = row.percent !== target.percent
          const parts = barParts(row.percent)
          const inline = inlineFits(row, columns)

          return (
            <Box key={row.key} flexDirection="column">
              <Box>
                <Box width={LABEL_WIDTH}>
                  <Text color={row.accent}>{row.label}</Text>
                </Box>
                <Box width={BAR_WIDTH}>
                  <Text color={moving ? row.accent : row.level}>{parts.filled}</Text>
                  <Text dimColor>{parts.empty}</Text>
                </Box>
                <Box width={PERCENT_WIDTH} justifyContent="flex-end">
                  <Text>{`${row.percent}%`}</Text>
                </Box>
                {inline && row.reset ? <Text dimColor>{`${' '.repeat(GAP)}${row.reset}`}</Text> : null}
              </Box>
              {!inline && row.reset ? (
                <Box>
                  <Text dimColor>{`${' '.repeat(LABEL_WIDTH)}${row.reset}`}</Text>
                </Box>
              ) : null}
            </Box>
          )
        })}
      </Box>
    )
  })
}
