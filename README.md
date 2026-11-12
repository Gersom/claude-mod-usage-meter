English | [Español](./README.es.md)

# usage-meter

Claude Code hook that shows session and plan usage in two parts: a one-line band above the prompt, with percentages only, and a side pane with the details:

- **Context:** how much of the session's context window is used, with the tokens next to it (`84k of 200k`) and, below, a segmented bar and a legend with the breakdown by category.
- **5-hour limit:** percentage used of the plan's 5-hour window, and the date/time it resets.
- **Weekly limit:** percentage used of the plan's 7-day window, and the date/time it resets.

## Behavior

- The band and the pane update on their own, every time any of the measures changes.
- The band shows only the percentage of each measure. The pane also shows, on the two limits, the reset date/time (`resetsAt`, converted to local time) and, on the context, the tokens used over the window, in dimmed gray and abbreviated (`k`, `M`); no costs.
- **Context categories (pane):** a full-width bar with one color per category (the free part in dark gray) and a legend with name, tokens and percentage of the window, always open. Deferred categories (outside the window) are omitted, and each category with tokens takes up at least one cell. The names are the engine's (`System prompt`, `Messages`…); only `Free` and `Buffer` are translated. The breakdown is estimated locally (`breakdown: 'summary'`): it makes no network calls, and its totals may differ a little from the tokens in the row. If the session returns no breakdown, it is omitted and only the row remains.
- If the plan reports no limits (for example, a non-subscription account), those measures are omitted and only the context remains.
- **The pane never opens on its own:** only with the `[ ◧ Open ]` button on the band or with the `/usage-meter` command.

## Design

### Band above the prompt

A single line, no border: the fixed name `Usage Meter:`, the three measures with their short title and the percentage, and at the end the `[ ◧ Open ]` (or `[ ◧ Close ]`) and language buttons:

```
Usage Meter: Contexto 42% · Límite 5h 23% · Semanal 7%      [ ◧ Abrir ] [ES]
```

- **Name:** `Usage Meter` is fixed and is not translated; the short titles (`Context`, `5-hour limit`, `Weekly`) are.
- **Percentage:** a box with a background in the threshold color and black text, in bold: green up to 60%, yellow from 60% to 80%, red above 80%. No data in parentheses: that goes in the pane.
- **Buttons:** at the end and fixed; if the line does not fit, the text in the middle is cut with `…`, never the buttons, and it does not wrap to another line.
- **Coexistence:** whatever other hooks draw in the strip is kept and the band goes below it. If there is a survey or there are no readings yet, it draws nothing.

### Side pane

Always the full view. It has no border of its own and no buttons. One block per measure, separated by two blank lines. Each block has a header (`◆`, bold label, text on the right and the percentage in a colored box) and a full-width bar. The subtitle of each measure (the context tokens, the reset text of the limits) always goes on a line below the bar, flush left and with no indentation. Under the `Context window` subtitle, with a blank line in between, goes the category legend, always open:

```
◆ Ventana de contexto                                   42%
████████████████████████████████████████████████████████████
84k de 200k

■ System prompt (2% ≈ 4k)  ■ Messages (40% ≈ 80k)
■ Libre (58% ≈ 116k)


◆ Límite de 5 horas                                     23%
████████████████████████████████████████████████████████████
Restablece en 2 h 10 min (hoy 18:40)


◆ Límite semanal                                         7%
████████████████████████████████████████████████████████████
Restablece en 3 d 4 h (lun 09 de oct)
```

- **Size:** asks for 60 columns and 22 rows (`PANE_COLUMNS`, `PANE_ROWS`); the content width is the one the engine gives (`bodyColumns`).
- **Titles:** `Context window`, `5-hour limit` and `Weekly limit`.
- **Colors per measure:** the `◆` of `Context window` is blue (`#60a5fa`); the one of the two limits is violet (`#a78bfa`). The label is bold, with no color.
- **Subtitle:** below the bar, in dimmed gray, except for the main figure, which is in the title's white (not bold): the tokens used (`84k` of `84k of 200k`) and the time left (`2 h 10 min`, `3 d 4 h`).
- **Bar:** a single one per measure, full width; the filled part in the threshold color (or the measure's color while animating) and the empty part in dark gray. In `Context`, the bar segmented by category replaces the simple one. The bars are boxes that share the line by proportion (not repeated text), so they fill the real width without splitting onto two lines.
- **Legend:** the categories run one after another (`■ name (% ≈ tokens)`), and wrap onto another line when they do not fit; they are not in columns. All the text is gray (`#9ca3af`), darker than normal, so the colored squares stand out; the tokens in bold.
- **Category colors:** by name: `System prompt` blue, `System tools` light blue, `MCP server instructions` orange, `Custom agents` green, `Memory files` yellow, `Skills` pink, `Messages` violet. A category the mod does not know takes the next spare color. `Free` and `Buffer` are dark gray.
- **No readings:** if it is opened before the first measurement, it says `No readings yet.` (`Aún no hay lecturas.`).
- **Animation:** the percentage and the bar advance from the previous value to the new one (about 40 ms per step). If the value does not change, it is not animated. The first time a measure appears it is drawn directly, with no animation.
- **Reset:** relative time first and the date in parentheses, in dimmed gray. The 5-hour limit shows the time (`today 18:40`, or the day if it crosses midnight); the weekly one shows the weekday and date, with no time (`Mon, Oct 09`). It goes as a subtitle, below the bar.

### Views and buttons

- **`[ ◧ Open ]` / `[ ◧ Close ]`:** opens the pane or closes it, depending on whether it is open. It never opens on its own.
- **`[ES]` / `[EN]`:** switches the language of the band and the pane (see Language).
- **`/usage-meter`:** with no argument it toggles the pane; `/usage-meter open` only opens it and `/usage-meter close` only closes it. It is registered when the session starts.
- **No pane support:** if the surface does not place the pane, nothing is left pending and a notice (toast) gives the reason. A pane that the mod itself opened on its own would not be placed below 144 columns, which is why it only opens on request.
- **Closing:** the pane is closed with the button, with the command, or with its close mark or key; the band's button always follows its state.

## Language

The band and the pane speak Spanish or English. The mod itself decides, with fixed dictionaries in `hooks/i18n.ts`: no agent or subagent translates anything, there are no model calls and it consumes no tokens.

- **Automatic:** when the session starts (and, if needed, on the first measurement) it reads `settings.language` from Claude Code's configuration (`$.settings.read()`, already merged: user, project, policy…). It is free text, so it recognizes Spanish in several forms (`Español`, `spanish`, `es`, `es-MX`, `castellano`, regardless of case or accents).
- **English by default:** if there is no `settings.language`, it cannot be read or it names a language the pane does not have (`japanese`, `french`…), the pane is in English.
- **By hand:** the `[ES]` / `[EN]` button, at the end of the band, to the right of the open button, switches the language of the band and the pane. A new measurement does not revert it, and it is kept while the mod stays loaded, even if the session changes (for example with `/clear`); when the mod is reloaded it goes back to automatic.
- **What changes:** titles (`Ventana de contexto` / `Context window`, `Límite de 5 horas` / `5-hour limit`, `Límite semanal` / `Weekly limit`), `Restablece en` / `Resets in`, `hoy` / `today`, days and dates (`lun 09 de oct` / `Mon, Oct 09`), `de` / `of`, `Libre` / `Free`, `Búfer` / `Buffer`, the band's short titles (`Contexto` / `Context`, `Límite 5h` / `5-hour limit`, `Semanal` / `Weekly`), `Abrir` / `Open`, `Cerrar` / `Close` and the texts of the command and the notices. `Usage Meter` is not translated.
- **What does not change:** the category names (`System prompt`, `Messages`…) are given by the engine in English and are shown as they are in both languages. The time units (`2 h 10 min`, `3 d 4 h`) are the same in both.
- **Adding another language:** one more dictionary in `TEXTS` (`hooks/i18n.ts`), its code in `Lang` (`types/index.d.ts`) and how it is recognized in `detectLang`.

The diagrams in this README are in Spanish.

## Type and data source

- **Type:** hook (Claude Code plugin).
- **Events:** `session.start` (initial reading and command registration) and `session.measure`, which delivers the context (`context.percent`, `context.tokens` and `context.window`) and the limit windows (`rateLimits`, with `five_hour` and `seven_day` and their `percentUsed`).
- **Categories:** `$.session.usage({ breakdown: 'summary' })`, which `session.measure` does not bring; it is requested when the session starts and on every measurement.
- **Language:** `$.settings.read()`, key `language`; it is read once per session.
- **Drawing:** `ui.render` hook on `AbovePrompt` (the one-line band) and on `Pane` with `requestId: 'usage-meter'` (the side pane, which is opened with `$.ui.open`).
- **Pane and command:** `$.ui.open` / `$.ui.close`, the `ui.close` hook (to clear the `paneOpen` state when the person closes it), `$.command.register` in `session.start` and the `command.run` hook of `/usage-meter`.

## Token consumption

The mod does not consume model tokens or add anything to the context:

- The manifest declares no skills, agents, commands or MCP servers, so it adds no descriptions or tools to the system prompt.
- The `session.start`, `session.measure` and `ui.close` hooks only observe: they return `next(e)` without modifying the event, and inject no messages or reminders. `ui.render` only draws the band and the pane in the interface. The `/usage-meter` command is registered by the mod at runtime (it is not in the manifest) and answers with fixed text, without calling the model: it consumes no tokens.
- `$.session.usage()` without a breakdown costs nothing, and `{ breakdown: 'summary' }` estimates locally (unlike `'full'`, which uses the token-counting API), so calling it on every measurement makes no network calls. There is no need to optimize it.

## Out of scope

- Costs or usage history.
- Alerts or blocks when approaching a limit.

## To decide when building it

- Whether "plan usage" is something other than the 5-hour and weekly windows. The API only exposes those two (and a `spend_limit` on gateways), so for now the mod takes them as "plan usage".

## Installation

Requires Claude Code 2.1.287 or higher. It is installed in one step (Claude Code 2.1.275 or higher):

```
/plugin install usage-meter --marketplace Gersom/claude-mod-usage-meter
```

Or in two steps:

```
/plugin marketplace add Gersom/claude-mod-usage-meter
/plugin install usage-meter@usage-meter
```

It is also part of the [`gersom-claude-mods`](https://github.com/Gersom/gersom-claude-mods) collection: `/plugin marketplace add Gersom/gersom-claude-mods` and then `/plugin install usage-meter@gersom-claude-mods`.

**In the desktop app:**

1. Add the marketplace: **Settings → Plugins → Add → Add marketplace → Add from a repository**, paste the repo URL (`https://github.com/Gersom/claude-mod-usage-meter`) and click **Sync**. For the whole collection, use `https://github.com/Gersom/gersom-claude-mods`.
2. Find the mod: in **Plugins → Discover**, open the filter and choose **Source →** the marketplace name (`usage-meter` or `gersom-claude-mods`). There `usage-meter` appears for installing.

This mod runs with your permissions, like any plugin; `claude plugin validate` lists the hooks and the calls it makes before you install it.

## Usage

To develop, load the mod from the repo folder in a Claude Code session (terminal):

```bash
claude --plugin-dir .
```

Test and validate:

```bash
claude plugin validate .
claude plugin test .
```

## License and support

[MIT](./LICENSE) © Gersom. If it is useful to you, you can support the project with a donation through [PayPal](https://paypal.me/gersomalaja).

## Structure

```
usage-meter/
├── LICENSE                      # licencia MIT
├── .claude-plugin/
│   ├── plugin.json              # manifiesto del plugin
│   └── marketplace.json         # marketplace de un solo plugin (instalación suelta)
├── hooks/
│   ├── hooks.json               # apunta a register.tsx
│   ├── register.tsx             # hooks: session.start, session.measure, ui.close, command.run, ui.render (banda y panel)
│   ├── i18n.ts                  # textos en español e inglés y detección del idioma
│   ├── format.ts                # lógica pura: color, fechas, filas, categorías, leyenda, ajuste al ancho (en el panel)
│   └── *.test.ts                # tests (lógica y render)
└── types/index.d.ts             # contrato del estado ($.state): usage, shown (porcentaje mostrado por fila), paneOpen (panel abierto) y lang (idioma)
```

## Known limitations

- The relative time is recalculated on every measurement (after each turn), not second by second.
- Narrow terminals: in the band, if the three measures do not fit, the end of their text is cut with `…` (the buttons are kept).
- The pane is only placed if the surface supports panes; if not, the button and the command warn with the reason. Since the mod never opens it on its own, you have to press `[ ◧ Open ]` or use `/usage-meter` in every session: the `paneOpen` state follows the real pane, but the mod does not reopen it at start.
- The pane height (18 rows) covers the three measures with a legend of up to about five lines; with more categories or a narrower width, the last lines may fall out of view.
- The tests do not cover the animation or the real drawing of the pane (only its content and opening and closing with a simulated engine). Nor do they cover the person closing the pane (`ui.close` hook) or `$.ui.open` being the first `await` of the button: the test harness offers no `$.ui.close` and does not let that order be observed, so it is checked by hand. What does cover the order is the command's test.
