# 305 Save — guía de diseño

Referencia rápida para que cada cambio nuevo se vea coherente con el resto de la app.

## Tipografía
- Texto general: **Inter**
- Números grandes y títulos (`h1`, `h2`, montos): **Manrope** (más geométrica, look "banca premium")
- Cargadas desde Google Fonts en `index.html`; fallback a system-ui si no cargan.

## Color — blanco y negro (estilo "1%")
Paleta monocromática, inspirada en los videos de motivación/disciplina en blanco y negro. Tokens en `src/css/base.css`, dentro de `:root` (claro) y `[data-theme="dark"]`.
- `--accent`: negro puro en tema claro, blanco puro en tema oscuro (siempre el máximo contraste posible). `--accent-contrast` es el color de texto que va sobre `--accent` (blanco sobre negro, negro sobre blanco).
- `--accent-soft`: gris muy claro/oscuro para fondos suaves (placas de icono, sellos).
- `--bg`, `--card-bg`, `--card-bg-2`: grises neutros, sin tinte de color.
- `--text`, `--text-muted`: negro/gris oscuro (claro) o blanco/gris claro (oscuro).
- **Un solo color de acento permitido fuera de la escala de grises: rojo, y solo para alertas reales** (deuda que nunca se paga, gasto sobre el límite, saldo negativo). Nunca usar rojo decorativo.
- Nada de verde, azul, morado o dorado decorativos. Antes existían para "estado bien/mal"; ahora ese contraste se logra con negro sólido (bien) vs. gris con borde (alerta) vs. rojo (grave) — ver `.status-pill`, `.rule-msg`, `.top-action`.
- `--radius` bajó a 4px / `--radius-sm` a 3px: bordes casi rectos, look editorial, no "burbuja".
- Tarjetas de crédito (`.cc-card`): son la única superficie con color — gradientes que imitan bancos reales (azul, rojo, gris, verde, morado), porque representan datos reales del banco, no la marca de la app. Ver `render.js`, array `ccGrads`.
- `.hero-card` (patrimonio neto en Inicio): bloque sólido negro (blanco en tema oscuro) — la pieza más dramática de la app.

## Formas
- `--radius` (18px): tarjetas y paneles.
- `--radius-sm` (12px): botones, chips, inputs.
- `--shadow`: sombra normal de panel.
- `--shadow-lift`: sombra elevada, solo para el hero de patrimonio y elementos protagonistas.

## Componentes clave
- `.hero-card`: tarjeta principal de Inicio (patrimonio neto). Fondo degradado con `--accent`, es la única superficie con texto blanco.
- `.panel`: contenedor estándar blanco/oscuro con borde sutil.
- `.sub-item` / `.sub-edit`: fila de pago recurrente — icono en placa de color a la izquierda, nombre + categoría al centro, monto a la derecha.
- `.icon-picker` / `.icon-opt`: selector de 52 iconos SVG (`ICON_PICKER` en `state.js`).
- `.cc-card`: tarjeta de banco apilada y expandible.
- `.debt-*`: calculadora de deudas (plan de pago).
- `.rule-*`: panel de la regla 50/30/20.

## Reglas de contenido
- **Sin emojis en la interfaz.** Todo ícono es SVG de `src/js/icons.js`, invocado con `icon("nombre")`.
- No repetir el mismo aviso/hint en más de una pantalla.
- Todo texto pasa por `t("clave")` en `src/js/i18n.js`, con versión ES y EN.
- Los cálculos financieros (regla 50/30/20, fondo de emergencia, plan de deudas) se basan en estándares reales de educación financiera, no en números inventados — ver comentarios en `recommendations.js` y `calculations.js`.

## Versionado
Cada cambio publicado sube el número de versión en `index.html` y `sw.js` (`?v=vNN`), y se documenta en el mensaje del commit.
