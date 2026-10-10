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

Recuadro con borde y un bloque por medida, separados por una línea en blanco. Cada bloque tiene una cabecera (`◆`, etiqueta en negrita, texto a la derecha y el porcentaje en un recuadro de color) y una barra a todo el ancho:

```
╭─────────────────────────────────────────────────────────────────────────╮
│ ◆ Contexto                                          84k de 200k   42%   │
│ ████████████████████████████████████████████████████████████████████████│
│ ■ System prompt   4k  2%   ■ Messages  80k 40%   ■ Libre  116k 58%      │
│                                                                         │
│ ◆ 5 horas                  Restablece en 2 h 10 min (hoy 18:40)   23%   │
│ ████████████████████████████████████████████████████████████████████████│
│                                                                         │
│ ◆ Semana                   Restablece en 3 d 4 h (lun 09 de oct)    7%   │
│ ████████████████████████████████████████████████████████████████████████│
╰─────────────────────────────────────────────────────────────────────────╯
```

- **Colores por medida:** el `◆` de `Contexto` va en azul (`#60a5fa`); el de `5 horas` y `Semana` en violeta (`#a78bfa`). La etiqueta va en negrita, sin color.
- **Porcentaje:** recuadro con fondo del color del umbral y texto negro: verde hasta 60%, amarillo de 60% a 80%, rojo por encima de 80%.
- **Barra:** una sola por medida, a todo el ancho; lo lleno en el color del umbral (o de la medida mientras se anima) y lo vacío en gris oscuro. En `Contexto`, la barra segmentada por categorías reemplaza a la simple. Las categorías van en una leyenda de columnas alineadas (`■ nombre tokens %`) que pasa a más filas si no cabe.
- **Animación:** el porcentaje y la barra avanzan desde el valor anterior hasta el nuevo (unos 40 ms por paso). Si el valor no cambia, no se anima. La primera vez que aparece una medida se dibuja directamente, sin animación.
- **Restablecimiento:** tiempo relativo primero y fecha entre paréntesis, en gris atenuado. El límite de 5 horas muestra la hora (`hoy 18:40`, o el día si cruza la medianoche); el semanal muestra día de la semana y fecha, sin hora (`lun 09 de oct`). Va a la derecha de la cabecera; si no cabe, pasa a una segunda línea debajo de ella.

## Tipo y fuente de datos

- **Tipo:** hook (plugin de Claude Code).
- **Evento:** `session.measure`, que entrega el contexto (`context.percent`, `context.tokens` y `context.window`) y las ventanas de límite (`rateLimits`, con `five_hour` y `seven_day` y su `percentUsed`).
- **Categorías:** `$.session.usage({ breakdown: 'summary' })`, que `session.measure` no trae; se pide al empezar la sesión y en cada medición.
- **Dibujo:** hook `ui.render` sobre `AbovePrompt` (franja sobre el prompt).

## Fuera de alcance

- Costos o historial de uso.
- Alertas o bloqueos al acercarse a un límite.

## Por decidir al construirlo

- Si el "uso del plan" es algo distinto a las ventanas de 5 horas y semanal. La API solo expone esas dos (y un `spend_limit` en gateways), así que por ahora el mod las toma como "uso del plan".

## Uso

Cargar el mod en una sesión de Claude Code (terminal):

```bash
claude --plugin-dir mods/usage-meter
```

Probar y validar:

```bash
claude plugin validate mods/usage-meter
claude plugin test mods/usage-meter
```

## Estructura

```
usage-meter/
├── .claude-plugin/plugin.json   # manifiesto
├── hooks/
│   ├── hooks.json               # apunta a register.tsx
│   ├── register.tsx             # hooks: session.start, session.measure, ui.render
│   ├── format.ts                # lógica pura: barra, color, fechas, filas, categorías, leyenda, ajuste al ancho
│   └── *.test.ts                # tests (lógica y render)
└── types/index.d.ts             # contrato del estado ($.state): usage y shown (porcentaje mostrado por fila)
```

## Limitaciones conocidas

- El tiempo relativo se recalcula en cada medición (después de cada turno), no segundo a segundo.
- Terminales angostas: si el texto de restablecimiento no cabe en la línea, pasa a una segunda línea; no se recorta.
- Los tests no cubren la animación; se verificó a mano en sesión (tema oscuro).
