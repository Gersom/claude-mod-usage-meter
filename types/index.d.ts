export type UsageLimit = { kind: string; percentUsed: number; resetsAt?: string }
/** One row of the context breakdown: `used` content fills the window, `free` is what is left, `buffer` the compaction reserve, `deferred` lies outside it. */
export type Category = { name: string; tokens: number; kind: 'used' | 'free' | 'buffer' | 'deferred' }
export type ContextReading = { percent: number; tokens: number | null; window: number; categories: Category[] }
export type View = 'full' | 'compact' | 'line'
export type Lang = 'es' | 'en'
export type Usage ={ context: ContextReading | null; limits: UsageLimit[] }

declare module 'claude-code' {
  interface PluginState {
    'usage-meter': {
      usage: Usage | null
      /** Percent each row is showing now, by row key; it steps toward the reading during an animation. */
      shown: Record<string, number>
      /** Whether the category legend under Contexto is open; closed until the person opens it. */
      expanded: boolean
      /** How much the band shows: everything, one line per measure, or all the measures on a single line. */
      view: View
      /** The panel's language: from settings.language at the start, or the one the person switched to; null until read. */
      lang: Lang | null
    }
  }
}
