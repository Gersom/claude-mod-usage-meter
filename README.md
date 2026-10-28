# usage-meter

Hook para Claude Code que muestra el uso de la sesión y del plan en dos partes: una banda de una línea sobre el prompt, solo con porcentajes, y un panel lateral con el detalle:

- **Contexto:** cuánto de la ventana de contexto de la sesión está usado, con los tokens al lado (`84k de 200k`) y, debajo, una barra segmentada y una leyenda con el desglose por categorías.
- **Límite de 5 horas:** porcentaje usado de la ventana de 5 horas del plan, y la fecha/hora en que se restablece.
- **Límite semanal:** porcentaje usado de la ventana de 7 días del plan, y la fecha/hora en que se restablece.

## Comportamiento

- La banda y el panel se actualizan solos, cada vez que cambia alguna de las medidas.
- La banda muestra solo el porcentaje de cada medida. El panel, además, en los dos límites la fecha/hora de restablecimiento (`resetsAt`, convertida a la hora local) y, en el contexto, los tokens usados sobre la ventana, en gris atenuado y abreviados (`k`, `M`); sin costos.
- **Categorías del contexto (panel):** barra a todo el ancho con un color por categoría (la parte libre en gris oscuro) y una leyenda con nombre, tokens y porcentaje de la ventana, siempre abierta. Las categorías diferidas (fuera de la ventana) se omiten, y cada categoría con tokens ocupa al menos una celda. Los nombres son los del motor (`System prompt`, `Messages`…); solo `Libre` y `Búfer` se traducen. El desglose se estima en local (`breakdown: 'summary'`): no hace llamadas de red, y sus totales pueden diferir un poco de los tokens de la fila. Si la sesión no entrega desglose, se omite y queda la fila sola.
- Si el plan no reporta límites (por ejemplo, una cuenta que no es de suscripción), esas medidas se omiten y queda solo el contexto.
- **El panel nunca se abre solo:** solo con el botón `[ ◧ Abrir ]` de la banda o con el comando `/usage-meter`.

## Diseño

### Banda sobre el prompt

Una sola línea, sin borde: el nombre fijo `Usage Meter:`, las tres medidas con su título corto y el porcentaje, y al final los botones `[ ◧ Abrir ]` (o `[ ◧ Cerrar ]`) e idioma:

```
Usage Meter: Contexto 42% · Límite 5h 23% · Semanal 7%      [ ◧ Abrir ] [ES]
```

- **Nombre:** `Usage Meter` es fijo y no se traduce; los títulos cortos (`Contexto`, `Límite 5h`, `Semanal`) sí.
- **Porcentaje:** recuadro con fondo del color del umbral y texto negro, en negrita: verde hasta 60%, amarillo de 60% a 80%, rojo por encima de 80%. Sin datos entre paréntesis: eso va en el panel.
- **Botones:** al final y fijos; si la línea no cabe, se corta el texto del medio con `…`, nunca los botones, y no pasa a otra línea.
- **Convivencia:** lo que otros hooks dibujen en la franja se conserva y la banda va debajo. Si hay una encuesta o aún no hay lecturas, no dibuja nada.

### Panel lateral

Siempre la vista completa. No lleva borde propio ni botones. Un bloque por medida, separados por dos líneas en blanco. Cada bloque tiene una cabecera (`◆`, etiqueta en negrita, texto a la derecha y el porcentaje en un recuadro de color) y una barra a todo el ancho. El subtítulo de cada medida (los tokens del contexto, el texto de restablecimiento de los límites) va siempre en una línea debajo de la barra, pegado a la izquierda y sin sangría. Bajo el subtítulo de `Contexto`, con una línea en blanco de por medio, va la leyenda de categorías, siempre abierta:

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

- **Tamaño:** pide 60 columnas y 22 filas (`PANE_COLUMNS`, `PANE_ROWS`); el ancho del contenido es el que da el motor (`bodyColumns`).
- **Títulos:** `Ventana de contexto`, `Límite de 5 horas` y `Límite semanal`.
- **Colores por medida:** el `◆` de `Ventana de contexto` va en azul (`#60a5fa`); el de los dos límites en violeta (`#a78bfa`). La etiqueta va en negrita, sin color.
- **Subtítulo:** debajo de la barra, en gris atenuado, salvo el dato principal, que va en el blanco del título (sin negrita): los tokens usados (`84k` de `84k de 200k`) y el tiempo que falta (`2 h 10 min`, `3 d 4 h`).
- **Barra:** una sola por medida, a todo el ancho; lo lleno en el color del umbral (o de la medida mientras se anima) y lo vacío en gris oscuro. En `Contexto`, la barra segmentada por categorías reemplaza a la simple. Las barras son cajas que se reparten la línea por proporción (no texto repetido), así que llenan el ancho real sin partirse en dos líneas.
- **Leyenda:** las categorías van seguidas (`■ nombre (% ≈ tokens)`), y pasan a otra línea cuando no caben; no van en columnas. Todo el texto va en gris (`#9ca3af`), más oscuro que el normal, para que destaquen los cuadros de color; los tokens en negrita.
- **Colores de las categorías:** por nombre: `System prompt` azul, `System tools` celeste, `MCP server instructions` naranja, `Custom agents` verde, `Memory files` amarillo, `Skills` rosa, `Messages` violeta. Una categoría que el mod no conoce toma el siguiente color de reserva. `Libre` y `Búfer` van en gris oscuro.
- **Sin lecturas:** si se abre antes de la primera medición, dice `Aún no hay lecturas.` (`No readings yet.`).
- **Animación:** el porcentaje y la barra avanzan desde el valor anterior hasta el nuevo (unos 40 ms por paso). Si el valor no cambia, no se anima. La primera vez que aparece una medida se dibuja directamente, sin animación.
- **Restablecimiento:** tiempo relativo primero y fecha entre paréntesis, en gris atenuado. El límite de 5 horas muestra la hora (`hoy 18:40`, o el día si cruza la medianoche); el semanal muestra día de la semana y fecha, sin hora (`lun 09 de oct`). Va como subtítulo, debajo de la barra.

### Vistas y botones

- **`[ ◧ Abrir ]` / `[ ◧ Cerrar ]`:** abre el panel o lo cierra, según esté abierto. Nunca se abre solo.
- **`[ES]` / `[EN]`:** cambia el idioma de la banda y del panel (ver Idioma).
- **`/usage-meter`:** sin argumento alterna el panel; `/usage-meter open` solo lo abre y `/usage-meter close` solo lo cierra. Se registra al empezar la sesión.
- **Sin soporte de paneles:** si la superficie no coloca el panel, no queda nada pendiente y un aviso (toast) da el motivo. Un panel que el propio mod abriera solo no se colocaría por debajo de 144 columnas, por eso solo se abre a petición.
- **Cierre:** el panel se cierra con el botón, con el comando o con su marca o tecla de cierre; el botón de la banda sigue siempre su estado.

## Idioma

La banda y el panel hablan español o inglés. Lo decide el propio mod, con diccionarios fijos en `hooks/i18n.ts`: ningún agente ni subagente traduce nada, no hay llamadas a modelos y no consume tokens.

- **Automático:** al empezar la sesión (y, si hiciera falta, en la primera medición) lee `settings.language` de la configuración de Claude Code (`$.settings.read()`, ya fusionada: usuario, proyecto, política…). Es texto libre, así que reconoce el español en varias formas (`Español`, `spanish`, `es`, `es-MX`, `castellano`, sin importar mayúsculas ni tildes).
- **Por defecto, inglés:** si no hay `settings.language`, no se puede leer o nombra un idioma que el panel no tiene (`japanese`, `french`…), el panel va en inglés.
- **A mano:** el botón `[ES]` / `[EN]`, al final de la banda, a la derecha del botón de abrir, cambia el idioma de la banda y del panel. Una medición nueva no lo revierte, y se conserva mientras el mod siga cargado, aunque cambie la sesión (por ejemplo con `/clear`); al recargar el mod vuelve al automático.
- **Qué cambia:** títulos (`Ventana de contexto` / `Context window`, `Límite de 5 horas` / `5-hour limit`, `Límite semanal` / `Weekly limit`), `Restablece en` / `Resets in`, `hoy` / `today`, días y fechas (`lun 09 de oct` / `Mon, Oct 09`), `de` / `of`, `Libre` / `Free`, `Búfer` / `Buffer`, los títulos cortos de la banda (`Contexto` / `Context`, `Límite 5h` / `5-hour limit`, `Semanal` / `Weekly`), `Abrir` / `Open`, `Cerrar` / `Close` y los textos del comando y de los avisos. `Usage Meter` no se traduce.
- **Qué no cambia:** los nombres de las categorías (`System prompt`, `Messages`…) los entrega el motor en inglés y se muestran tal cual en ambos idiomas. Las unidades de tiempo (`2 h 10 min`, `3 d 4 h`) son iguales en los dos.
- **Agregar otro idioma:** un diccionario más en `TEXTS` (`hooks/i18n.ts`), su código en `Lang` (`types/index.d.ts`) y cómo se reconoce en `detectLang`.

Los diagramas de este README están en español.

## Tipo y fuente de datos

- **Tipo:** hook (plugin de Claude Code).
- **Eventos:** `session.start` (lectura inicial y registro del comando) y `session.measure`, que entrega el contexto (`context.percent`, `context.tokens` y `context.window`) y las ventanas de límite (`rateLimits`, con `five_hour` y `seven_day` y su `percentUsed`).
- **Categorías:** `$.session.usage({ breakdown: 'summary' })`, que `session.measure` no trae; se pide al empezar la sesión y en cada medición.
- **Idioma:** `$.settings.read()`, clave `language`; se lee una vez por sesión.
- **Dibujo:** hook `ui.render` sobre `AbovePrompt` (la banda de una línea) y sobre `Pane` con `requestId: 'usage-meter'` (el panel lateral, que se abre con `$.ui.open`).
- **Panel y comando:** `$.ui.open` / `$.ui.close`, el hook `ui.close` (para limpiar el estado `paneOpen` cuando la persona lo cierra), `$.command.register` en `session.start` y el hook `command.run` de `/usage-meter`.

## Consumo de tokens

El mod no consume tokens del modelo ni agrega nada al contexto:

- El manifiesto no declara skills, agentes, comandos ni servidores MCP, así que no suma descripciones ni herramientas al prompt del sistema.
- Los hooks `session.start`, `session.measure` y `ui.close` solo observan: devuelven `next(e)` sin modificar el evento, y no inyectan mensajes ni recordatorios. `ui.render` solo dibuja la banda y el panel en la interfaz. El comando `/usage-meter` lo registra el mod en tiempo de ejecución (no está en el manifiesto) y responde con un texto fijo, sin llamar al modelo: no consume tokens.
- `$.session.usage()` sin desglose no cuesta nada, y `{ breakdown: 'summary' }` estima en local (a diferencia de `'full'`, que usa la API de conteo de tokens), así que llamarlo en cada medición no hace llamadas de red. No hace falta optimizarlo.

## Fuera de alcance

- Costos o historial de uso.
- Alertas o bloqueos al acercarse a un límite.

## Por decidir al construirlo

- Si el "uso del plan" es algo distinto a las ventanas de 5 horas y semanal. La API solo expone esas dos (y un `spend_limit` en gateways), así que por ahora el mod las toma como "uso del plan".

## Instalación

Requiere Claude Code 2.1.287 o superior. Se instala en un paso (Claude Code 2.1.275 o superior):

```
/plugin install usage-meter --marketplace Gersom/claude-mod-usage-meter
```

O en dos pasos:

```
/plugin marketplace add Gersom/claude-mod-usage-meter
/plugin install usage-meter@usage-meter
```

También forma parte de la colección [`gersom-claude-mods`](https://github.com/Gersom/gersom-claude-mods): `/plugin marketplace add Gersom/gersom-claude-mods` y luego `/plugin install usage-meter@gersom-claude-mods`.

**En la app de escritorio:**

1. Agregar el marketplace: **Configuración → Plugins → Añadir → Añadir marketplace → Añadir desde un repositorio**, pegar la URL del repo (`https://github.com/Gersom/claude-mod-usage-meter`) y pulsar **Sincronizar**. Para toda la colección, usar `https://github.com/Gersom/gersom-claude-mods`.
2. Encontrar el mod: en **Plugins → Descubrir**, abrir el filtro y elegir **Origen →** el nombre del marketplace (`usage-meter` o `gersom-claude-mods`). Ahí aparece `usage-meter` para instalarlo.

Este mod corre con tus permisos, como cualquier plugin; `claude plugin validate` lista los hooks y las llamadas que hace antes de instalarlo.

## Uso

Para desarrollar, cargar el mod desde la carpeta del repo en una sesión de Claude Code (terminal):

```bash
claude --plugin-dir .
```

Probar y validar:

```bash
claude plugin validate .
claude plugin test .
```

## Licencia y apoyo

[MIT](./LICENSE) © Gersom. Si te sirve, puedes apoyar el proyecto con una donación por [PayPal](https://paypal.me/gersomalaja).

## Estructura

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

## Limitaciones conocidas

- El tiempo relativo se recalcula en cada medición (después de cada turno), no segundo a segundo.
- Terminales angostas: en la banda, si no caben las tres medidas, se corta el final de su texto con `…` (los botones se conservan).
- El panel solo se coloca si la superficie admite paneles; si no, el botón y el comando avisan con el motivo. Como el mod nunca lo abre solo, hay que pulsar `[ ◧ Abrir ]` o usar `/usage-meter` en cada sesión: el estado `paneOpen` sigue al panel real, pero el mod no lo reabre al empezar.
- El alto del panel (18 filas) cubre las tres medidas con una leyenda de hasta unas cinco líneas; con más categorías o un ancho menor, las últimas líneas pueden quedar fuera de vista.
- Los tests no cubren la animación ni el dibujo real del panel (solo su contenido y la apertura y el cierre con un motor simulado). Tampoco cubren que la persona cierre el panel (hook `ui.close`) ni que `$.ui.open` sea el primer `await` del botón: el arnés de pruebas no ofrece `$.ui.close` ni deja observar ese orden, así que se verifica a mano. Lo que sí cubre el orden es el test del comando.
