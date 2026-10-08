import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Usage } from '../types'
import { contextRow, fitReset, head, rowOf } from './format'
import type { Row } from './format'

const usage = atom({ plugin: 'usage-meter', key: 'usage' } as const, null)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      const now = await $.session.usage()

      await update($, usage, () => ({ context: now.context.percent ?? null, limits: now.rateLimits }))
    } catch {
      // No reading yet: the band appears with the first session.measure.
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const next_: Usage = { context: e.context.percent ?? null, limits: e.rateLimits }

    await update($, usage, () => next_)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, usage)

    if (e.props.hasSurvey || current === null) {
      return next(e)
    }

    const nowMs = await $.clock.now()
    const rows: Row[] = []

    if (current.context !== null) rows.push(contextRow(current.context))

    for (const limit of current.limits) {
      const row = rowOf(limit, nowMs)

      if (row) rows.push(row)
    }

    if (rows.length === 0) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const columns = e.props.bodyColumns - 4

    return (
      <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column">
        {rows.map(row => (
          <Box key={row.label}>
            <Text>{row.label.padEnd(9)} </Text>
            <Text color={row.level}>{row.bar}</Text>
            <Text> {String(row.percent).padStart(3)}%</Text>
            <Text dimColor>{fitReset(row, columns) ? `   ${fitReset(row, columns)}` : ''}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}
