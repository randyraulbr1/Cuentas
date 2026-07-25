# 305 Save — guía de diseño

Referencia rápida para que cada cambio nuevo se vea coherente con el resto de la app.

## Tipografía
- Texto general: **Inter**
- Números grandes y títulos (`h1`, `h2`, montos): **Manrope** (más geométrica, look "banca premium")
- Cargadas desde Google Fonts en `index.html`; fallback a system-ui si no cargan.

## Color
Tokens en `src/css/base.css`, dentro de `:root` (claro) y `[data-theme="dark"]`.
- `--accent` / `--accent-strong` / `--accent-soft`: verde-teal, color de marca. Nunca usar azul/morado como acento principal.
- `--bg`, `--card-bg`, `--card-bg-2`: fondos.
- `--text`, `--text-muted`: texto.
- `--border`, `--input-bg`, `--input-border`: líneas y campos.
- Semáforo de estado (uso de tarjeta, fondo de emergencia, etc.): verde `#34C759` / amarillo `#FF9500` / rojo `#FF3B30`.
- Tarjetas de crédito (`.cc-card`): gradientes fijos que imitan bancos reales (azul, rojo, gris, verde, morado) — ver `render.js`, array `ccGrads`.

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
