# usage-meter

Hook para Claude Code que muestra, en un recuadro dentro del chat, solo porcentajes de uso, sin detalles:

- **Contexto:** cuánto de la ventana de contexto de la sesión está usado.
- **Límite de 5 horas:** porcentaje usado de la ventana de 5 horas del plan.
- **Límite semanal:** porcentaje usado de la ventana de 7 días del plan.

## Comportamiento

- El recuadro se actualiza solo, cada vez que cambia alguna de las medidas.
- Muestra únicamente el porcentaje de cada una (ej. `Contexto 42% · 5h 23% · Semana 7%`). Sin tokens, sin costos, sin desglose por categoría.
- Si el plan no reporta límites (por ejemplo, una cuenta que no es de suscripción), esas medidas se omiten y queda solo el contexto.

## Tipo y fuente de datos

- **Tipo:** hook (plugin de Claude Code).
- **Evento:** `session.measure`, que entrega el contexto (`context.percent`) y las ventanas de límite (`rateLimits`, con `five_hour` y `seven_day` y su `percentUsed`).
- **Dibujo:** hook `ui.render` sobre `AbovePrompt` (franja sobre el prompt).

## Fuera de alcance

- Detalles de tokens, costos o historial de uso.
- Alertas o bloqueos al acercarse a un límite.

## Por decidir al construirlo

- Si el "uso del plan" es algo distinto a las ventanas de 5 horas y semanal. La API solo expone esas dos (y un `spend_limit` en gateways), así que por ahora el mod las toma como "uso del plan".
- Formato visual exacto del recuadro (barra, solo número, colores por umbral).
