import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Category, ContextReading, Usage, View } from '../types'
import type { Row } from './format'
import {
  FREE_COLOR,
  LEGEND_GAP,
  LEGEND_TEXT,
  inlineFits,
  legendLines,
  percentBadge,
  rowsOf,
  slicesOf,
  splitNote,
  withPercent
} from './format'

const BORDER_COLOR = '#4b5563'
const BAR_MIN = 10
const INDENT = 2
const GAP = 3
const STEP_MS = 40
const EASE = 0.35

const usage = atom({ plugin: 'usage-meter', key: 'usage' } as const, null)
const shown = atom({ plugin: 'usage-meter', key: 'shown' } as const, {} as Record<string, number>)
const expanded = atom({ plugin: 'usage-meter', key: 'expanded' } as const, false)
const viewMode = atom({ plugin: 'usage-meter', key: 'view' } as const, 'full' as View)

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

    const { Box, Button, Text } = $.ui.resolve(e)
    const open = await read($, expanded)
    const view = await read($, viewMode)

    /** The row's note, dim but for its strong part (tokens, time left), which takes the label's color. */
    const noteOf = (row: Row, before: string, after: string) => {
      const [head, strong, tail] = splitNote(row.reset || row.detail, row.strong)

      return (
        <Box>
          <Text dimColor>{`${before}${head}`}</Text>
          {strong ? <Text>{strong}</Text> : null}
          {tail || after ? <Text dimColor>{`${tail}${after}`}</Text> : null}
        </Box>
      )
    }
    // The terminal draws a gray border around the band; the desktop draws none.
    const bordered = e.surface === 'terminal'
    const columns = e.props.bodyColumns - (bordered ? 4 : 2)
    const slices = slicesOf(current.context?.categories ?? [], Math.max(BAR_MIN, columns))
    const total = slices.reduce((sum, slice) => sum + slice.tokens, 0)
    const rows = targets.map(target => {
      const row = withPercent(target, values[target.key] ?? target.percent)

      return { target, row, inline: inlineFits(row, columns) }
    })

    // Folded, the band keeps only each measure's header line. The band holds `maxRows`, and a taller
    // one scrolls its last rows out of view, so the blank lines between measures go when even the
    // measures barely fit; the legend, open, is always whole.
    const detailed = view === 'full'
    const toggle = detailed && slices.length > 0 ? 1 : 0
    const base = rows.reduce(
      (sum, { row, inline }) => sum + (detailed ? 2 : 1) + (!inline && row.reset ? 1 : 0),
      toggle + 1
    )
    const separated = detailed && e.props.maxRows - (bordered ? 2 : 0) - base >= rows.length - 1
    const legend = open ? legendLines(slices, columns) : []

    const frame = bordered ? { borderStyle: 'round' as const, borderColor: BORDER_COLOR } : {}

    // Each button toggles its own view and, pressed again, goes back to the full one.
    const controls = (
      <Box justifyContent="flex-end">
        <Button
          key="compact"
          plain
          dimColor
          onPress={() => void update($, viewMode, value => (value === 'compact' ? 'full' : 'compact'))}
        >
          {view === 'compact' ? '[+] Expandir' : '[-] Compactar'}
        </Button>
        <Box marginLeft={2}>
          <Button
            key="line"
            plain
            dimColor
            onPress={() => void update($, viewMode, value => (value === 'line' ? 'full' : 'line'))}
          >
            {view === 'line' ? '[+] Expandir' : '[=] Una línea'}
          </Button>
        </Box>
      </Box>
    )

    if (view === 'line') {
      return (
        <Box {...frame} paddingX={1}>
          {/* One line, the buttons at its right end: what does not fit is cut off, never wrapped. */}
          <Box flexGrow={1} flexShrink={1}>
            <Text wrap="truncate-end">
              {rows.map(({ row }, index) => (
                <Text key={row.key}>
                  {index > 0 ? <Text dimColor>{' · '}</Text> : null}
                  <Text bold>{`${row.short} `}</Text>
                  <Text bold color="black" backgroundColor={row.level}>
                    {percentBadge(row.percent)}
                  </Text>
                  {row.brief ? <Text dimColor>{` (${row.brief})`}</Text> : null}
                </Text>
              ))}
            </Text>
          </Box>
          <Box flexShrink={0} marginLeft={2}>
            {controls}
          </Box>
        </Box>
      )
    }

    return (
      <Box {...frame} paddingX={1} flexDirection="column">
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
                  {inline && note ? noteOf(row, '', ' '.repeat(GAP)) : null}
                  <Text bold color="black" backgroundColor={row.level}>
                    {percentBadge(row.percent)}
                  </Text>
                </Box>
              </Box>
              {!inline && row.reset ? (
                noteOf(row, ' '.repeat(INDENT), '')
              ) : null}
              {/* The bars are Boxes that share the line by flex, so they fill it however wide it really is. */}
              {!detailed ? null : segmented ? (
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
              {detailed && segmented ? (
                <Box>
                  <Button key="categories" plain dimColor onPress={() => void update($, expanded, value => !value)}>
                    {open ? '▾ Categorías' : '▸ Categorías'}
                  </Button>
                </Box>
              ) : null}
              {detailed && segmented
                ? legend.map((items, at) => (
                    <Box key={at}>
                      {items.map((item, column) => (
                        <Box key={column} marginRight={column < items.length - 1 ? LEGEND_GAP : 0}>
                          <Text color={item.color}>{'■ '}</Text>
                          <Text color={LEGEND_TEXT}>{`${item.name} (${item.percent} ≈ `}</Text>
                          <Text color={LEGEND_TEXT} bold>
                            {item.tokens}
                          </Text>
                          <Text color={LEGEND_TEXT}>{')'}</Text>
                        </Box>
                      ))}
                    </Box>
                  ))
                : null}
            </Box>
          )
        })}
        {controls}
      </Box>
    )
  })
}
