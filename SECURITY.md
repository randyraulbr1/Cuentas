# Seguridad y estado de producción — 305 Save

Este documento existe para no fingir que algo está "listo para producción" sin haberlo probado.
Todo lo marcado ✅ fue implementado **y probado** en este entorno (con Postgres real, contra el
servidor corriendo). Todo lo marcado ⚠️ es una limitación conocida. Todo lo marcado ❌ no existe
todavía y requiere trabajo o decisiones que no puedo tomar por ti (crear cuentas de pago, elegir
proveedor de Redis, etc.).

## 1. Arquitectura actual

```
Frontend (PWA estática, GitHub Pages)
        |  HTTPS solamente
        v
Backend (Node/Express, Render, un solo servicio)
        |
        +--> PostgreSQL (Render)  — todos los datos del usuario
        +--> Plaid API             — solo desde el backend, nunca desde el navegador
```

El frontend **nunca** habla directo con Postgres ni con Plaid. Todo pasa por el backend.
No hay CDN, WAF, réplicas de lectura, colas ni instancia de Redis: es una arquitectura de
un solo servicio, adecuada para arrancar y para varios cientos de usuarios, no para escala alta.

## 2. Qué SÍ está implementado y probado ✅

- **Secretos fuera del código**: todo vive en variables de entorno de Render. `.gitignore` cubre
  `.env`, `.env.*`, `*.pem`, `*.key`, `secrets/`. Se encontró y se quitó del repositorio un archivo
  `.env.test2` que se había subido por accidente durante el desarrollo — **contenía solo una clave
  de prueba local (`test-secret-for-local-only`), no la clave real de tu servidor en Render**, así
  que no hace falta rotar nada en Render por esto. Aun así, si quieres estar 100% tranquilo,
  puedes rotar `JWT_SECRET` y `ENCRYPTION_KEY` en Render de todas formas (ver sección 8).
- **HTTPS**: GitHub Pages y Render fuerzan HTTPS por defecto en sus dominios propios.
- **Autenticación**: registro/login con bcrypt (coste 12), JWT de 30 días, logout limpia el token
  guardado localmente.
- **Bloqueo por intentos fallidos**: 8 intentos fallidos de login bloquean la cuenta 15 minutos.
  Probado con un script real: 8 intentos malos bloquean, y el intento 9 con la contraseña
  **correcta** sigue bloqueado hasta que pasa el tiempo.
- **Autorización por usuario**: cada consulta a la base de datos filtra por `user_id` obtenido del
  JWT verificado en el servidor — nunca de un campo que mande el frontend. Probado con un script
  automático (`server/tests/cross-user-authorization.test.js`) que crea dos usuarios y confirma que
  uno no puede ver, desconectar ni listar nada del otro (403/404 siempre).
- **Cifrado de tokens de Plaid**: AES-256-GCM con IV aleatorio por token, guardado cifrado en
  Postgres, nunca en texto plano, nunca devuelto al frontend.
- **Rate limiting**: probado con curl real — login/registro (20 en 15-60 min), sincronizar banco
  (30/hora), crear link token (20/hora), límite general de respaldo (300/15min). Se encontró y
  corrigió un bug real donde dos límites distintos compartían el mismo contador.
- **CORS restringido**: solo acepta el dominio configurado en `APP_URL`, no `*`.
- **Plaid**: solo `transactions/sync` con cursor (nunca `transactions/refresh` ni
  `accounts/balance/get` automáticamente); `/item/remove` al desconectar un banco.
- **Cabeceras de seguridad básicas**: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`. Límite de tamaño de petición (200kb).
- **Política de privacidad, términos, y páginas legales** publicadas (`privacy.html`,
  `data-policy.html`, `terms.html`).
- **Eliminación de cuenta y desconexión de banco** disponibles para el usuario.

## 3. Limitaciones conocidas ⚠️

- **Un solo servidor, sin Redis**: el rate limiting y el bloqueo de cuentas viven en memoria del
  proceso (los intentos fallidos si están en la base de datos, pero los contadores de rate limit
  no). Si en algún momento corres **más de una instancia** del backend a la vez, cada instancia
  tendría su propio contador — el límite dejaría de ser exacto entre instancias. Para 1
  instancia (que es lo normal en Render Free/Starter) esto funciona bien.
- **JWT de 30 días sin rotación**: no hay refresh token, no hay forma de "cerrar sesión en todos
  los dispositivos" sin cambiar `JWT_SECRET` (lo cual cerraría la sesión de TODOS los usuarios a
  la vez). Para una app de un usuario personal esto es aceptable; para producción multiusuario
  seria, no.
- **No hay recuperación de contraseña**: si un usuario olvida su contraseña, hoy no hay forma de
  recuperarla (necesitaría enviar correos, lo cual requiere un proveedor de email que no está
  configurado).
- **No hay verificación de correo real**: cualquier correo con formato válido puede registrarse.
- **Validación de entradas básica, no exhaustiva**: hay checks de formato de correo y longitud de
  contraseña, pero no una capa completa tipo Zod/Joi validando cada campo de cada ruta.
- **No hay backups configurados**: Render solo hace backups automáticos con retención en planes
  de base de datos **pagados**; en el plan Free no hay backup automático. Si la base de datos se
  borra o corrompe, hoy no hay forma de recuperarla.

## 4. Lo que NO existe y por qué no lo construí ❌

Estas piezas del documento que me pasaste requieren infraestructura, cuentas o decisiones tuyas
que no puedo crear por ti desde aquí:

- **Redis + colas (BullMQ)**: requiere provisionar una instancia de Redis (de pago o un plan
  gratuito limitado de algún proveedor) y decidir dónde correrla. Sin eso, no hay a qué conectar
  las colas.
- **Sentry / monitoreo y alertas**: requiere crear una cuenta de Sentry (o similar) y pegar su
  clave en las variables de entorno.
- **Staging separado**: requeriría un segundo servicio de Render + una segunda base de datos +
  variables de entorno separadas — technically posible pero es una decisión de infraestructura
  tuya (implica más costo mensual).
- **MFA para administradores**: no hay panel de administración construido todavía (no existe
  ningún rol `admin`/`support` en el sistema ahora mismo — todo usuario tiene los mismos permisos
  sobre sus propios datos). No fabriqué un sistema de roles falso solo para "tacharlo de la
  lista"; si en algún momento quieres un panel de administración, es su propio proyecto.
- **CI/CD con pruebas automáticas en cada cambio**: es viable agregar un workflow de GitHub
  Actions que corra `node --check` y la prueba de autorización en cada push — puedo hacerlo si me
  lo pides, pero no se ejecuta solo sin que tú actives Actions en el repositorio.
- **Pentest externo / auditoría independiente**: por definición, tiene que hacerlo alguien
  distinto a quien construyó el sistema.
- **Prueba de restauración de backup real**: no puedo probarla porque no hay backups configurados
  todavía (ver sección 3).

## 5. Endpoints (inventario)

| Ruta | Método | Auth | Límite |
|---|---|---|---|
| `/api/health` | GET | No | 300/15min (general) |
| `/api/auth/register` | POST | No | 20/hora por IP |
| `/api/auth/login` | POST | No | 20/15min por IP + bloqueo de cuenta a los 8 fallos |
| `/api/auth/me` | GET | Sí | 300/15min |
| `/api/auth/consent` | POST | Sí | 300/15min |
| `/api/auth/delete-account` | DELETE | Sí | 300/15min |
| `/api/plaid/create-link-token` | POST | Sí | 20/hora |
| `/api/plaid/exchange-public-token` | POST | Sí | 300/15min |
| `/api/plaid/sync-transactions` | POST | Sí | 30/hora |
| `/api/plaid/get-liabilities` | POST | Sí | 300/15min |
| `/api/plaid/liabilities-all` | GET | Sí | 300/15min |
| `/api/plaid/disconnect` | POST | Sí | 300/15min |
| `/api/plaid/accounts` | GET | Sí | 300/15min |
| `/api/plaid/transactions` | GET | Sí | 300/15min |
| `/api/plaid/institutions-status` | GET | Sí | 300/15min |
| `/api/webhooks/plaid` | POST | No (verificación propia de Plaid pendiente) | — |

No hay rutas administrativas: no existen porque no hay sistema de roles todavía.

## 6. Matriz de permisos

Con el diseño actual (sin roles), la matriz es simple: **todo usuario autenticado puede leer y
modificar únicamente sus propios datos**, filtrados siempre por el `user_id` del JWT. No hay
ningún usuario con permisos elevados.

## 7. Variables de entorno requeridas

Ver `server/.env.example`. Resumen: `DATABASE_URL`, `DATABASE_SSL`, `JWT_SECRET`,
`ENCRYPTION_KEY`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `APP_URL`, `PORT`.
El servidor **no verifica todavía** al arrancar que todas estén presentes (pendiente, ver sección
9).

## 8. Procedimiento de rotación de claves

1. Genera una nueva clave (`openssl rand -base64 32` para `ENCRYPTION_KEY`, similar para
   `JWT_SECRET`).
2. **`JWT_SECRET`**: al cambiarla, todas las sesiones activas se invalidan de inmediato (todos
   tienen que volver a iniciar sesión). No hay forma de rotarla sin este efecto con el diseño
   actual.
3. **`ENCRYPTION_KEY`**: al cambiarla, los tokens de Plaid ya guardados con la clave vieja dejan
   de poder descifrarse. Hoy no hay migración automática — rotarla implicaría que los usuarios
   tengan que reconectar sus bancos. Si esto es importante para ti, es una mejora futura
   (versionar claves, como pide el documento original) que no está construida todavía.
4. Actualiza la variable en Render → Environment → guarda → espera el redeploy.

## 9. Riesgos pendientes más importantes (en orden de importancia)

1. **Sin backups**: si se pierde la base de datos, se pierden todos los datos de todos los
   usuarios. Esto es lo más urgente de resolver antes de tener usuarios reales que te importen.
2. **Sin recuperación de contraseña**: un usuario que olvida su contraseña pierde el acceso a sus
   datos para siempre (a menos que tú entres a la base de datos manualmente).
3. **Rate limiting en memoria**: deja de ser exacto si algún día corres más de una instancia del
   servidor a la vez.
4. **Sin monitoreo/alertas**: si el servidor falla o Plaid empieza a rechazar llamadas, no te
   enteras hasta que un usuario se queje.
5. **Sin CI que bloquee errores antes de desplegar**: hoy un error de sintaxis solo se detecta si
   yo lo pruebo antes de subirlo.

## 10. Capacidad estimada

Con esta arquitectura (un servicio de Render en el plan gratis/starter, una base de datos Postgres
básica):

- **~100 usuarios**: sin problema, el diseño actual aguanta esto sin cambios.
- **~1,000 usuarios**: probablemente funciona, pero el plan gratis de Render duerme el servicio
  tras inactividad (causa la demora de 30-60s que ya viste) y tiene límites de CPU/memoria bajos.
  En este punto conviene pasar a un plan pagado de Render (Starter o superior) como mínimo.
- **~10,000 usuarios**: el diseño actual **no** está pensado para esto. Se necesitaría: plan de
  base de datos con más conexiones, revisar índices bajo carga real, y probablemente ya sí hace
  falta Redis para rate limiting compartido entre instancias, y separar el trabajo de
  sincronización de Plaid a un proceso aparte para no bloquear peticiones normales.

Estas cifras son estimaciones razonadas, no until se hizo una prueba de carga real — el documento
original pide pruebas de carga como parte de la Fase 3, que no se han corrido.

## 11. Costo estimado (Plaid, aproximado, ver conversación previa para la tabla completa)

Por conexión bancaria activa: ~$0.65/mes (Transactions + Recurring + Liabilities, suscripción fija,
no por llamada). Actualizaciones manuales del usuario ("Actualizar") usan `/transactions/sync`,
que no tiene cargo adicional por llamada. No se usa `/transactions/refresh` ni
`/accounts/balance/get` en ningún flujo automático de la app, que son las dos llamadas que sí
cobran por uso.

## 12. Procedimiento de despliegue

1. Push a `main` en GitHub → GitHub Pages despliega el frontend solo.
2. Render → "Manual Deploy" → "Deploy latest commit" (o automático si tienes Auto-Deploy activado)
   para el backend.
3. El esquema de base de datos se aplica solo al arrancar el servidor (ver `server/db.js`,
   `ensureExtensions()`), no requiere ningún paso manual.

## 13. Procedimiento de rollback

- **Frontend**: en GitHub, revertir el commit (`git revert`) y hacer push — GitHub Pages
  redespliega la versión anterior.
- **Backend**: en Render, la pestaña de "Deploys" permite volver a un deploy anterior con
  "Rollback" directamente desde el dashboard.
- **Base de datos**: no hay procedimiento de rollback de datos porque no hay backups (ver
  riesgo #1 en la sección 9).

## 14. Cómo correr las pruebas

```bash
cd server
node tests/cross-user-authorization.test.js
```

Requiere el servidor corriendo (localmente contra una base de datos de prueba, o contra Render).
Configura `TEST_BASE_URL` si no es `http://localhost:3050`. **Nunca lo corras contra tu base de
datos de producción real** — crea usuarios de prueba de verdad.
