import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Category, ContextReading, Usage } from '../types'
import { FREE_COLOR, LEGEND_GAP, LEGEND_TEXT, inlineFits, legendLines, percentBadge, rowsOf, slicesOf, withPercent } from './format'

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
    const slices = slicesOf(current.context?.categories ?? [], Math.max(BAR_MIN, columns))
    const total = slices.reduce((sum, slice) => sum + slice.tokens, 0)
    const rows = targets.map(target => {
      const row = withPercent(target, values[target.key] ?? target.percent)

      return { target, row, inline: inlineFits(row, columns) }
    })

    // The band holds `maxRows`, and a taller one scrolls its last rows out of view, so what
    // the measures need comes first, then the legend, and the blank lines between them last.
    const base = rows.reduce((sum, { row, inline }) => sum + 2 + (!inline && row.reset ? 1 : 0), 0)
    const spare = Math.max(0, e.props.maxRows - 2 - base)
    const separated = spare >= rows.length - 1
    const legend = legendLines(slices, columns, spare - (separated ? rows.length - 1 : 0))

    return (
      <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column">
        {rows.map(({ target, row, inline }, index) => {
          const moving = row.percent !== target.percent
          const note = row.reset || row.detail
          const segmented = row.key === 'context' && slices.length > 0

          return (
            <Box key={row.key} flexDirection="column" marginTop={index > 0 && separated ? 1 : 0}>
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
              {/* The bars are Boxes that share the line by flex, so they fill it however wide it really is. */}
              {segmented ? (
                <Box height={1}>
                  {slices.map((slice, at) => (
                    <Box
                      key={at}
                      flexGrow={Math.round((slice.tokens / total) * 1000)}
                      flexShrink={0}
                      minWidth={slice.kind === 'used' && slice.tokens > 0 ? 1 : 0}
                      backgroundColor={slice.color}
                    />
                  ))}
                </Box>
              ) : (
                <Box height={1}>
                  <Box flexGrow={row.percent} flexShrink={0} backgroundColor={moving ? row.accent : row.level} />
                  <Box flexGrow={100 - row.percent} flexShrink={0} backgroundColor={FREE_COLOR} />
                </Box>
              )}
              {segmented
                ? legend.lines.map((items, at) => (
                    <Box key={at}>
                      {items.map((item, column) => (
                        <Box key={column} marginRight={column < items.length - 1 ? LEGEND_GAP : 0}>
                          <Text color={item.color}>{'■ '}</Text>
                          <Text color={LEGEND_TEXT}>{`${item.name} `}</Text>
                          <Text color={LEGEND_TEXT} dimColor>{`${item.percent} `}</Text>
                          <Text color={LEGEND_TEXT} bold>
                            {item.tokens}
                          </Text>
                        </Box>
                      ))}
                      {legend.hidden > 0 && at === legend.lines.length - 1 ? (
                        <Text dimColor>{`${' '.repeat(LEGEND_GAP)}+${legend.hidden} más`}</Text>
                      ) : null}
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
