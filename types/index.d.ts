export type UsageLimit = { kind: string; percentUsed: number; resetsAt?: string }
export type Usage = { context: number | null; limits: UsageLimit[] }

declare module 'claude-code' {
  interface PluginState {
    'usage-meter': { usage: Usage | null }
  }
}
