export type UsageLimit = { kind: string; percentUsed: number; resetsAt?: string }
export type Usage = { context: number | null; limits: UsageLimit[] }

declare module 'claude-code' {
  interface PluginState {
    'usage-meter': {
      usage: Usage | null
      /** Percent each row is showing now, by row key; it steps toward the reading during an animation. */
      shown: Record<string, number>
    }
  }
}
