import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Category, ContextReading, Usage } from '../types'
import { FREE_COLOR, barParts, inlineFits, legendRows, percentBadge, rowsOf, slicesOf, withPercent } from './format'

const BAR_MIN = 10
const INDENT = 2
const GAP = 3
const STEP_MS = 40
const EASE = 0.35

const usage = atom({ plugin: 'usage-meter', key: 'usage' } as const, null)
const shown = atom({ plugin: 'usage-meter', key: 'shown' } as const, {} as Record<string, number>)

/** The context as the meter keeps it; none until the session reports a percent. */
const contextOf = (
  context: { percent?: number; tokens?: number; window: number },
  categories: Category[]
): ContextReading | null =>
  context.percent === undefined
    ? null
    : { percent: context.percent, tokens: context.tokens ?? null, window: context.window, categories }

/** The window by category, estimated locally; none when the session has no breakdown to give. */
const categoriesOf = async ($: EngineInterface): Promise<Category[]> => {
  try {
    const { context } = await $.session.usage({ breakdown: 'summary' })

    return (context.breakdown?.categories ?? []).map(({ name, tokens, kind }) => ({ name, tokens, kind }))
  } catch {
    return []
  }
}

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
      const reading: Usage = { context: contextOf(now.context, await categoriesOf($)), limits: now.rateLimits }

      await update($, usage, () => reading)
      await sync($, reading)
    } catch {
      // No reading yet: the band appears with the first session.measure.
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const next_: Usage = { context: contextOf(e.context, await categoriesOf($)), limits: e.rateLimits }

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
    const width = Math.max(BAR_MIN, columns)
    const slices = slicesOf(current.context?.categories ?? [], width)
    const legend = legendRows(slices, columns)

    return (
      <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column">
        {targets.map((target, index) => {
          const row = withPercent(target, values[target.key] ?? target.percent)
          const moving = row.percent !== target.percent
          const parts = barParts(row.percent, width)
          const inline = inlineFits(row, columns)
          const note = row.reset || row.detail
          const segmented = row.key === 'context' && slices.length > 0

          return (
            <Box key={row.key} flexDirection="column" marginTop={index > 0 ? 1 : 0}>
              <Box justifyContent="space-between">
                <Box>
                  <Text color={row.accent}>{'◆ '}</Text>
                  <Text bold>{row.label}</Text>
                </Box>
                <Box>
                  {inline && note ? <Text dimColor>{`${note}${' '.repeat(GAP)}`}</Text> : null}
                  <Text bold color="black" backgroundColor={row.level}>
                    {percentBadge(row.percent)}
                  </Text>
                </Box>
              </Box>
              {!inline && row.reset ? (
                <Box>
                  <Text dimColor>{`${' '.repeat(INDENT)}${row.reset}`}</Text>
                </Box>
              ) : null}
              {segmented ? (
                <Box>
                  {slices.map((slice, at) => (
                    <Text key={at} color={slice.color}>
                      {'█'.repeat(slice.cells)}
                    </Text>
                  ))}
                </Box>
              ) : (
                <Box>
                  <Text color={moving ? row.accent : row.level}>{parts.filled}</Text>
                  <Text color={FREE_COLOR}>{'█'.repeat(parts.empty.length)}</Text>
                </Box>
              )}
              {segmented
                ? legend.map((items, at) => (
                    <Box key={at}>
                      {items.map((item, column) => (
                        <Box key={column} marginRight={column < items.length - 1 ? GAP : 0}>
                          <Text color={item.color}>{'■ '}</Text>
                          <Text>{item.name}</Text>
                          <Text bold>{` ${item.tokens}`}</Text>
                          <Text dimColor>{` ${item.percent}`}</Text>
                        </Box>
                      ))}
                    </Box>
                  ))
                : null}
            </Box>
          )
        })}
      </Box>
    )
  })
}
