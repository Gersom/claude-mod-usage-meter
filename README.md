# usage-meter

Hook para Claude Code que muestra, en un recuadro dentro del chat, solo porcentajes de uso, sin detalles:

- **Contexto:** cuánto de la ventana de contexto de la sesión está usado.
- **Límite de 5 horas:** porcentaje usado de la ventana de 5 horas del plan, y la fecha/hora en que se restablece.
- **Límite semanal:** porcentaje usado de la ventana de 7 días del plan, y la fecha/hora en que se restablece.

## Comportamiento

- El recuadro se actualiza solo, cada vez que cambia alguna de las medidas.
- Muestra el porcentaje de cada medida y, en los dos límites, la fecha/hora de restablecimiento (`resetsAt`, convertida a la hora local). Sin tokens, sin costos, sin desglose por categoría.
- Si el plan no reporta límites (por ejemplo, una cuenta que no es de suscripción), esas medidas se omiten y queda solo el contexto.

## Diseño

Recuadro con borde y una barra por medida, con el texto de restablecimiento al lado:

```
╭───────────────────────────────────────────────────────────────────╮
│ Uso                                                               │
│ Contexto  ████░░░░░░  42%                                         │
│ 5 horas   ██░░░░░░░░  23%   Restablece en 2 h 10 min (hoy 18:40)  │
│ Semana    █░░░░░░░░░   7%   Restablece en 3 d 4 h (lun 09 de oct) │
╰───────────────────────────────────────────────────────────────────╯
```

- **Color por umbral:** verde hasta 70%, amarillo de 70% a 90%, rojo desde 90%.
- **Restablecimiento:** tiempo relativo primero y fecha entre paréntesis. El límite de 5 horas muestra la hora (`hoy 18:40`, o el día si cruza la medianoche); el semanal muestra día de la semana y fecha, sin hora (`lun 09 de oct`).

## Tipo y fuente de datos

- **Tipo:** hook (plugin de Claude Code).
- **Evento:** `session.measure`, que entrega el contexto (`context.percent`) y las ventanas de límite (`rateLimits`, con `five_hour` y `seven_day` y su `percentUsed`).
- **Dibujo:** hook `ui.render` sobre `AbovePrompt` (franja sobre el prompt).

## Fuera de alcance

- Detalles de tokens, costos o historial de uso.
- Alertas o bloqueos al acercarse a un límite.

## Por decidir al construirlo

- Si el "uso del plan" es algo distinto a las ventanas de 5 horas y semanal. La API solo expone esas dos (y un `spend_limit` en gateways), así que por ahora el mod las toma como "uso del plan".
- Ancho del recuadro en terminales angostas (la línea de restablecimiento puede pasar a una segunda línea o recortar el tiempo relativo).

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
│   ├── format.ts                # lógica pura: barra, color, fechas, ajuste al ancho
│   └── *.test.ts                # tests (lógica y render)
└── types/index.d.ts             # contrato del estado ($.state)
```

## Limitaciones conocidas

- El tiempo relativo se recalcula en cada medición (después de cada turno), no segundo a segundo.
- Terminales angostas: si el texto de restablecimiento no cabe, se quita primero la fecha entre paréntesis y luego todo el texto.
