export type UsageLimit = { kind: string; percentUsed: number; resetsAt?: string }
export type ContextReading = { percent: number; tokens: number | null; window: number }
export type Usage = { context: ContextReading | null; limits: UsageLimit[] }

declare module 'claude-code' {
  interface PluginState {
    'usage-meter': {
      usage: Usage | null
      /** Percent each row is showing now, by row key; it steps toward the reading during an animation. */
      shown: Record<string, number>
    }
  }
}
