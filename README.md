# Cuentas Claras

App web (PWA) para controlar ingreso, trabajo, pagos fijos, tarjetas, préstamos y ahorro. Sin backend: corre entera en el navegador y se publica como sitio estático en GitHub Pages.

## Cómo se ejecuta

No hace falta instalar nada ni correr un servidor. Es HTML/CSS/JS puro:

```
python3 -m http.server 8000
```

y abre `http://localhost:8000`. También puedes abrir `index.html` directo en algunos navegadores, aunque `fetch`/service worker funcionan mejor servidos por HTTP.

## Estructura

```
index.html              punto de entrada, enlaza todo lo de abajo
manifest.json, sw.js     PWA (instalable, funciona sin conexión)
src/css/
  base.css               variables, reset, tipografía, layout general, barra inferior
  components.css         botones, inputs, tarjetas, formularios reutilizables
  pages.css               resumen, historial, selector de perfil, panel de opciones
src/js/
  i18n.js                textos ES/EN
  storage.js              capa central de almacenamiento (IndexedDB + localStorage)
  migrations.js           control de versión de esquema
  state.js                estado en memoria, constantes, deshacer
  calculations.js         fórmulas: disponible, ingreso, fechas de pago
  work.js                 turnos de trabajo, cronómetro, cálculo de pago
  payments.js             tarjetas, préstamos, pagos fijos, pagos automáticos
  history.js               guardar/borrar historial mensual
  recommendations.js       sugerencias y banner de "qué hacer"
  render.js                toda la interfaz (HTML generado desde el estado)
  app.js                  perfiles, ajustes, eventos de clic/entrada, arranque
```

## Almacenamiento

Los datos financieros (tarjetas, préstamos, pagos, historial, trabajo) viven en **IndexedDB**, por perfil. `localStorage` se usa solo para cosas pequeñas: lista de perfiles, tema, idioma, moneda y objetivo financiero.

La primera vez que abres un perfil después de esta versión, si IndexedDB está vacío, la app recupera automáticamente tus datos del respaldo anterior en `localStorage` (formato v2/v3) y los copia a IndexedDB — **sin borrar nunca ese respaldo original**.

## Backend (Fase 2, no activa)

Este proyecto no tiene servidor. `.env.example` y los scripts `dev`/`start` de `package.json` son solo un plan documentado para una futura integración bancaria (Plaid u otra), que **requeriría un hosting con servidor real** (Render, Railway, Vercel, etc.) además de GitHub Pages, y credenciales reales que el usuario debe generar — nada de eso está implementado ni activo todavía.

## Limitaciones conocidas

- Edición de horas de entrada/salida y de cada break por separado en un turno: pendiente (por ahora se edita propinas/bonos/notas).
- Sin vista de calendario semanal/mensual para turnos, solo lista.
