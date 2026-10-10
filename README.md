# usage-meter

Hook para Claude Code que muestra, en un recuadro dentro del chat, solo porcentajes de uso, sin detalles:

- **Contexto:** cuánto de la ventana de contexto de la sesión está usado, con los tokens al lado (`84k de 200k`) y, debajo, una barra segmentada y una leyenda con el desglose por categorías.
- **Límite de 5 horas:** porcentaje usado de la ventana de 5 horas del plan, y la fecha/hora en que se restablece.
- **Límite semanal:** porcentaje usado de la ventana de 7 días del plan, y la fecha/hora en que se restablece.

## Comportamiento

- El recuadro se actualiza solo, cada vez que cambia alguna de las medidas.
- Muestra el porcentaje de cada medida y, en los dos límites, la fecha/hora de restablecimiento (`resetsAt`, convertida a la hora local). En el contexto, además, los tokens usados sobre la ventana, en gris atenuado y abreviados (`k`, `M`); sin costos.
- **Categorías del contexto:** barra a todo el ancho con un color por categoría (la parte libre en gris oscuro) y una leyenda con nombre, tokens y porcentaje de la ventana. Las categorías diferidas (fuera de la ventana) se omiten, y cada categoría con tokens ocupa al menos una celda. Los nombres son los del motor (`System prompt`, `Messages`…); solo `Libre` y `Búfer` se traducen. El desglose se estima en local (`breakdown: 'summary'`): no hace llamadas de red, y sus totales pueden diferir un poco de los tokens de la fila. Si la sesión no entrega desglose, se omite y queda la fila sola.
- Si el plan no reporta límites (por ejemplo, una cuenta que no es de suscripción), esas medidas se omiten y queda solo el contexto.

## Diseño

Lleva un borde redondeado gris oscuro (`#4b5563`) en todas las superficies (terminal y app de escritorio). Un bloque por medida, separados por una línea en blanco. Cada bloque tiene una cabecera (`◆`, etiqueta en negrita, texto a la derecha y el porcentaje en un recuadro de color) y una barra a todo el ancho. Bajo `Contexto` hay un texto `▸ Categorías` que se pulsa para abrir la leyenda (`▾ Categorías`) y se vuelve a pulsar para cerrarla; por defecto está cerrada:

```
 ◆ Ventana de contexto                                 84k de 200k   42%
 ██████████████████████████████████████████████████████████████████████
 ▸ Categorías

 ◆ Límite de 5 horas         Restablece en 2 h 10 min (hoy 18:40)   23%
 ██████████████████████████████████████████████████████████████████████

 ◆ Límite semanal            Restablece en 3 d 4 h (lun 09 de oct)   7%
 ██████████████████████████████████████████████████████████████████████
```

Con las categorías abiertas, bajo `▾ Categorías`:

```
 ■ System prompt (2% ≈ 4k)  ■ Messages (40% ≈ 80k)  ■ Libre (58% ≈ 116k)
```

- **Títulos:** `Ventana de contexto`, `Límite de 5 horas` y `Límite semanal`.
- **Colores por medida:** el `◆` de `Ventana de contexto` va en azul (`#60a5fa`); el de los dos límites en violeta (`#a78bfa`). La etiqueta va en negrita, sin color.
- **Texto de la derecha:** en gris atenuado, salvo el dato principal, que va en el blanco del título (sin negrita): los tokens usados (`84k` de `84k de 200k`) y el tiempo que falta (`2 h 10 min`, `3 d 4 h`).
- **Porcentaje:** recuadro con fondo del color del umbral y texto negro: verde hasta 60%, amarillo de 60% a 80%, rojo por encima de 80%.
- **Barra:** una sola por medida, a todo el ancho; lo lleno en el color del umbral (o de la medida mientras se anima) y lo vacío en gris oscuro. En `Contexto`, la barra segmentada por categorías reemplaza a la simple. Las barras son cajas que se reparten la línea por proporción (no texto repetido), así que llenan el ancho real sin partirse en dos líneas.
- **Leyenda:** las categorías van seguidas (`■ nombre (% ≈ tokens)`), y pasan a otra línea cuando no caben; no van en columnas. Todo el texto va en gris (`#9ca3af`), más oscuro que el normal, para que destaquen los cuadros de color; los tokens en negrita. Solo se dibuja con las categorías abiertas (el estado `expanded`, cerrado al empezar).
- **Colores de las categorías:** por nombre: `System prompt` azul, `System tools` celeste, `MCP server instructions` naranja, `Custom agents` verde, `Memory files` amarillo, `Skills` rosa, `Messages` violeta. Una categoría que el mod no conoce toma el siguiente color de reserva. `Libre` y `Búfer` van en gris oscuro.
- **Alto del recuadro:** la franja admite `maxRows` filas y, si el contenido es más alto, las últimas se desplazan fuera de vista (los límites de 5 horas y semanal quedaban ocultos). Por eso las líneas en blanco entre medidas se quitan cuando ni las cabeceras y barras caben con holgura. La leyenda, abierta, muestra siempre todas las categorías, así que con muchas puede desplazar fuera de vista las últimas medidas: se cierra con `▾ Categorías` o se compacta.
- **Vistas y botones:** al pie, alineados a la derecha, hay dos botones; cada uno activa su vista y, pulsado de nuevo (`[+] Expandir`), vuelve a la completa. El panel empieza en la completa; las categorías conservan si estaban abiertas.
  - `[-] Compactar`: una sola línea por medida (título, texto de la derecha y porcentaje), sin barras, sin `▸ Categorías`, sin leyenda y sin líneas en blanco.
  - `[=] Una línea`: todo el panel en una sola línea, con títulos cortos, el porcentaje en su recuadro de color de umbral y entre paréntesis el dato breve: `Contexto 30% (245k) · Límite 5h 17% (1h 52m) · Semanal 26% (3d 20h)`, con los botones al final de esa misma línea. Es una sola línea de verdad: si no cabe, se corta al final (`…`) en vez de pasar a otra. Sin el dato (por ejemplo, sin hora de restablecimiento), se omite el paréntesis.
- **Animación:** el porcentaje y la barra avanzan desde el valor anterior hasta el nuevo (unos 40 ms por paso). Si el valor no cambia, no se anima. La primera vez que aparece una medida se dibuja directamente, sin animación.
- **Restablecimiento:** tiempo relativo primero y fecha entre paréntesis, en gris atenuado. El límite de 5 horas muestra la hora (`hoy 18:40`, o el día si cruza la medianoche); el semanal muestra día de la semana y fecha, sin hora (`lun 09 de oct`). Va a la derecha de la cabecera; si no cabe, pasa a una segunda línea debajo de ella.

## Idioma

El panel habla español o inglés. Lo decide el propio mod, con diccionarios fijos en `hooks/i18n.ts`: ningún agente ni subagente traduce nada, no hay llamadas a modelos y no consume tokens.

- **Automático:** al empezar la sesión (y, si hiciera falta, en la primera medición) lee `settings.language` de la configuración de Claude Code (`$.settings.read()`, ya fusionada: usuario, proyecto, política…). Es texto libre, así que reconoce el español en varias formas (`Español`, `spanish`, `es`, `es-MX`, `castellano`, sin importar mayúsculas ni tildes).
- **Por defecto, inglés:** si no hay `settings.language`, no se puede leer o nombra un idioma que el panel no tiene (`japanese`, `french`…), el panel va en inglés.
- **A mano:** el botón `[ES]` / `[EN]`, al pie junto a los otros, cambia el idioma. Una medición nueva no lo revierte; se pierde al reiniciar la sesión, que vuelve al automático.
- **Qué cambia:** títulos (`Ventana de contexto` / `Context window`, `Límite de 5 horas` / `5-hour limit`, `Límite semanal` / `Weekly limit`), `Restablece en` / `Resets in`, `hoy` / `today`, días y fechas (`lun 09 de oct` / `Mon, Oct 09`), `de` / `of`, `Libre` / `Free`, `Búfer` / `Buffer`, `Categorías` / `Categories` y los botones.
- **Qué no cambia:** los nombres de las categorías (`System prompt`, `Messages`…) los entrega el motor en inglés y se muestran tal cual en ambos idiomas. Las unidades compactas (`1h 52m`, `3d 20h`) son iguales en los dos.
- **Agregar otro idioma:** un diccionario más en `TEXTS` (`hooks/i18n.ts`), su código en `Lang` (`types/index.d.ts`) y cómo se reconoce en `detectLang`.

Los diagramas de este README están en español.

## Tipo y fuente de datos

- **Tipo:** hook (plugin de Claude Code).
- **Evento:** `session.measure`, que entrega el contexto (`context.percent`, `context.tokens` y `context.window`) y las ventanas de límite (`rateLimits`, con `five_hour` y `seven_day` y su `percentUsed`).
- **Categorías:** `$.session.usage({ breakdown: 'summary' })`, que `session.measure` no trae; se pide al empezar la sesión y en cada medición.
- **Idioma:** `$.settings.read()`, clave `language`; se lee una vez por sesión.
- **Dibujo:** hook `ui.render` sobre `AbovePrompt` (franja sobre el prompt).

## Consumo de tokens

El mod no consume tokens del modelo ni agrega nada al contexto:

- El manifiesto no declara skills, agentes, comandos ni servidores MCP, así que no suma descripciones ni herramientas al prompt del sistema.
- Los tres hooks (`session.start`, `session.measure`, `ui.render`) solo observan: devuelven `next(e)` sin modificar el evento, no inyectan mensajes ni recordatorios, y `ui.render` solo dibuja la franja en la interfaz.
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
│   ├── register.tsx             # hooks: session.start, session.measure, ui.render
│   ├── i18n.ts                  # textos en español e inglés y detección del idioma
│   ├── format.ts                # lógica pura: color, fechas, filas, categorías, leyenda, ajuste al ancho
│   └── *.test.ts                # tests (lógica y render)
└── types/index.d.ts             # contrato del estado ($.state): usage, shown (porcentaje mostrado por fila), expanded (leyenda abierta) view (vista: completa, compacta o una línea) y lang (idioma)
```

## Limitaciones conocidas

- El tiempo relativo se recalcula en cada medición (después de cada turno), no segundo a segundo.
- Terminales angostas: si el texto de restablecimiento no cabe en la línea, pasa a una segunda línea; no se recorta.
- Los tests no cubren la animación; se verificó a mano en sesión (tema oscuro).
