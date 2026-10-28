import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderNode } from 'claude-code'

import type { Category, ContextReading, Lang, Usage } from '../types'
import type { Row } from './format'
import { DEFAULT_LANG, detectLang, otherLang, textsOf } from './i18n'
import {
  FREE_COLOR,
  LEGEND_GAP,
  LEGEND_TEXT,
  legendLines,
  percentBadge,
  rowsOf,
  slicesOf,
  splitNote,
  withPercent
} from './format'

const NAME = 'Usage Meter'
/** The id of the pane (1-64 of letters, digits, `_`, `-`). */
const PANE_ID = 'usage-meter'
/** The columns and body rows the pane asks for: three measures with their bars, the legend and the blank lines between them. */
const PANE_COLUMNS = 60
const PANE_ROWS = 22
const STEP_MS = 40
const EASE = 0.35

const usage = atom({ plugin: 'usage-meter', key: 'usage' } as const, null)
const shown = atom({ plugin: 'usage-meter', key: 'shown' } as const, {} as Record<string, number>)
/** Whether the pane is open: set when the button or the command opens it, cleared when it closes, whoever closes it. */
const paneOpen = atom({ plugin: 'usage-meter', key: 'paneOpen' } as const, false)
const langMode = atom({ plugin: 'usage-meter', key: 'lang' } as const, null as Lang | null)

/**
 * Whether the pane is open, as a plain module variable: the `/usage-meter` command has to decide what to do without an `await` before
 * `$.ui.open` (the engine counts an open as the person's own only when it is the handler's first asynchronous step), so it cannot `read` the
 * atom. It follows the atom: every write below sets both, and `session.start` reads it again, so a reload of the module (which loses
 * variables, not atoms) is mended with the next session. A stale value costs a redundant `ui.open` of an open pane, which the engine only retitles.
 */
let paneIsOpen = false

/** Whether what another hook drew has nothing to show: no text, no border, nothing inside. */
const isEmpty = (node: RenderNode | null | undefined): boolean => {
  if (node === null || node === undefined) return true
  if (typeof node === 'string') return node === ''
  if (node.type !== 'Box' && node.type !== 'Text') return false
  if (node.props?.borderStyle !== undefined) return false

  return (node.children ?? []).every(isEmpty)
}

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

/**
 * Settles the panel's language the first time: from settings.language, or the default when the
 * settings do not say. A switch by hand later is the person's and is not overwritten.
 */
const ensureLang = async ($: EngineInterface) => {
  if ((await read($, langMode)) !== null) return

  let language: unknown

  try {
    language = (await $.settings.read()).language
  } catch {
    // No settings to read: the default language.
  }

  await update($, langMode, current => current ?? detectLang(language))
}

/** The words of the language in force; the language is settled first, so an event or a press calls it, and a draw reads the atom itself. */
const textsFor = async ($: EngineInterface) => {
  await ensureLang($)

  return textsOf((await read($, langMode)) ?? DEFAULT_LANG)
}

/** Sets the pane's flag, atom and mirror together. */
const setPaneOpen = async ($: EngineInterface, value: boolean) => {
  paneIsOpen = value
  await update($, paneOpen, () => value)
}

/** Closes the pane if it is open and clears the flag here: the engine leaves a plugin's own hook out of the close the plugin makes, so the `ui.close` hook below only hears the person's. */
const closePane = async ($: EngineInterface) => {
  if (!(await read($, paneOpen))) return

  await $.ui.close({ id: PANE_ID })
  await setPaneOpen($, false)
}

/**
 * Opens the pane: `$.ui.open` is the first asynchronous step, so the engine still sees it as the person's own press or command and places it
 * at any width. Resolves `null` once it is on screen, or the engine's reason when this surface places no panes; nothing is left waiting then.
 */
const openPane = async ($: EngineInterface) => {
  const opened = await $.ui.open({ id: PANE_ID, columns: PANE_COLUMNS, rows: PANE_ROWS, title: NAME })

  if (opened.isPlaced) {
    await setPaneOpen($, true)

    return null
  }

  // Open but undrawn: leave nothing waiting to pop up later on its own.
  await $.ui.close({ id: PANE_ID })

  return opened.reason
}

/** The band's button: opens the pane, or closes it if it is open. Only a press or the command opens it, never the meter on its own. A surface that places no panes gets a toast. */
const togglePane = async ($: EngineInterface, isOpen: boolean) => {
  // `isOpen` is what the band drew, so the open call is the handler's first await.
  if (isOpen) return closePane($)

  const reason = await openPane($)

  if (reason !== null) $.ui.toast((await textsFor($)).paneUnavailable(reason))
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
  const targets = rowsOf(current, await $.clock.now(), textsOf(DEFAULT_LANG))
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
    await ensureLang($)

    // The command's mirror follows the atom again (a reload loses it).
    paneIsOpen = await read($, paneOpen)

    try {
      const now = await $.session.usage()
      const reading: Usage = { context: contextOf(now.context, await categoriesOf($)), limits: now.rateLimits }

      await update($, usage, () => reading)
      await sync($, reading)
    } catch {
      // No reading yet: the band appears with the first session.measure.
    }

    await $.command.register({
      argumentHint: '[open|close]',
      description: (await textsFor($)).commandDescription,
      name: 'usage-meter'
    })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await ensureLang($)

    const next_: Usage = { context: contextOf(e.context, await categoriesOf($)), limits: e.rateLimits }

    await update($, usage, () => next_)
    await sync($, next_)

    return next(e)
  })

  // The person's close mark or key leaves the flag, and so the button, in step with the pane (the button's own close clears it in `closePane`).
  on('ui.close', { id: PANE_ID }, async ($, e, next) => {
    const closed = await next(e)

    await setPaneOpen($, false)

    return closed
  })

  // `/usage-meter` opens or closes the pane: with no argument it toggles, `open` only opens, `close` only closes. Its person's own
  // request places the pane at any width. The decision uses the mirror, so `$.ui.open` is the first `await` of an opening.
  on('command.run', { command: 'usage-meter' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const isKnown = arg === '' || arg === 'open' || arg === 'close'

    if (isKnown && !paneIsOpen && arg !== 'close') {
      const reason = await openPane($)
      const t = await textsFor($)

      if (reason === null) return { text: t.paneOpened }

      $.ui.toast(t.paneUnavailable(reason))

      return { text: t.paneUnavailable(reason) }
    }

    const t = await textsFor($)

    if (!isKnown) return { text: t.commandUsage }

    // Open already (`open`, or the toggle's turn to close), or closed already (`close`).
    if (arg !== 'open') await closePane($)

    return { text: arg === 'open' || paneIsOpen ? t.paneOpened : t.paneClosed }
  })

  // The band is one line: the name, the three percentages and the two buttons. The detail is in the pane, which only the button or the
  // command opens: a pane the mod opened by itself would not be placed under 144 columns, so nothing is ever opened unasked.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // What other hooks draw in the band (cache-watch's) stays; the meter goes under it.
    const below = await next(e)
    const current = await read($, usage)

    if (e.props.hasSurvey || current === null) {
      return below
    }

    const nowMs = await $.clock.now()
    const values = await read($, shown)
    const lang = (await read($, langMode)) ?? DEFAULT_LANG
    const t = textsOf(lang)
    const targets = rowsOf(current, nowMs, t)

    if (targets.length === 0) {
      return below
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const isPaneOpen = await read($, paneOpen)
    const rows = targets.map(target => withPercent(target, values[target.key] ?? target.percent))

    const meter = (
      <Box>
        {/* One line, the buttons at its right end: what does not fit is cut off, never wrapped. */}
        <Box flexGrow={1} flexShrink={1}>
          <Text wrap="truncate-end">
            <Text bold dimColor>{`${NAME}: `}</Text>
            {rows.map((row, index) => (
              <Text key={row.key}>
                {index > 0 ? <Text dimColor>{' · '}</Text> : null}
                <Text bold>{`${row.short} `}</Text>
                <Text bold color="black" backgroundColor={row.level}>
                  {percentBadge(row.percent)}
                </Text>
              </Text>
            ))}
          </Text>
        </Box>
        <Box flexShrink={0} marginLeft={2}>
          <Button key="pane" plain dimColor onPress={() => void togglePane($, isPaneOpen)}>
            {`[ ◧ ${isPaneOpen ? t.close : t.open} ]`}
          </Button>
          <Box marginLeft={1}>
            <Button
              key="lang"
              plain
              dimColor
              onPress={() => void update($, langMode, value => otherLang(value ?? DEFAULT_LANG))}
            >
              {`[${lang.toUpperCase()}]`}
            </Button>
          </Box>
        </Box>
      </Box>
    )

    return isEmpty(below) ? meter : <Box flexDirection="column">{below}{meter}</Box>
  })

  // The pane, opened only by the band's button or the command: every measure with its bar, and under Contexto the segmented bar with
  // the legend of categories, always open. It has no frame of its own and only reads.
  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const current = await read($, usage)
    const nowMs = await $.clock.now()
    const values = await read($, shown)
    const t = textsOf((await read($, langMode)) ?? DEFAULT_LANG)
    const targets = current === null ? [] : rowsOf(current, nowMs, t)
    const { Box, Text } = $.ui.resolve(e)

    if (current === null || targets.length === 0) {
      return (
        <Box flexDirection="column">
          <Text wrap="truncate-end" dimColor>
            {t.nothing}
          </Text>
        </Box>
      )
    }

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
    const columns = e.props.bodyColumns
    const slices = slicesOf(current.context?.categories ?? [], t)
    const total = slices.reduce((sum, slice) => sum + slice.tokens, 0)
    const legend = legendLines(slices, columns)

    return (
      <Box flexDirection="column">
        {targets.map((target, index) => {
          const row = withPercent(target, values[target.key] ?? target.percent)
          const moving = row.percent !== target.percent
          const note = row.reset || row.detail
          const segmented = row.key === 'context' && slices.length > 0

          return (
            <Box key={row.key} flexDirection="column" marginTop={index > 0 ? 2 : 0}>
              <Box justifyContent="space-between">
                <Box>
                  <Text color={row.accent}>{'◆ '}</Text>
                  <Text bold>{row.label}</Text>
                </Box>
                <Box>
                  <Text bold color="black" backgroundColor={row.level}>
                    {percentBadge(row.percent)}
                  </Text>
                </Box>
              </Box>
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
              {/* The subtitle (tokens, time left) sits under the bar, flush left. */}
              {note ? noteOf(row, '', '') : null}
              {segmented
                ? legend.map((items, at) => (
                    <Box key={at} marginTop={at === 0 ? 1 : 0}>
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
      </Box>
    )
  })
}
