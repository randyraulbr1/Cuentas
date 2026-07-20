# Backend de Cuentas Claras

Servidor Node/Express que conecta la app con Plaid. Nunca corre en GitHub Pages —
necesita un host con servidor real (probado aquí para Render).

## Probado localmente

- Registro, login, sesión (JWT), consentimiento, eliminar cuenta: probados end-to-end
  contra PostgreSQL real.
- Cifrado AES-256-GCM de tokens: probado (cifrar/descifrar).
- Esquema SQL: probado, se crea sin errores.
- Rutas de Plaid: probadas para que fallen de forma controlada sin credenciales reales
  (nunca tumban el servidor). **La llamada real a la API de Plaid (Sandbox o Production)
  no se ha podido probar todavía** porque este entorno de desarrollo no tiene salida de
  red hacia `sandbox.plaid.com`. Debe probarse desde tu máquina o ya desplegado en Render.

## Variables de entorno (`.env`, nunca subir a git)

Ver `.env.example`. Resumen:

- `DATABASE_URL`: cadena de conexión de Postgres (Render la genera sola al crear la base de datos).
- `JWT_SECRET`: cualquier cadena larga y aleatoria (`openssl rand -base64 32`).
- `ENCRYPTION_KEY`: 32 bytes en base64 (`openssl rand -base64 32`). Cifra los access_token de Plaid.
- `PLAID_CLIENT_ID` / `PLAID_SECRET`: de dashboard.plaid.com.
- `PLAID_ENV`: `sandbox` para pruebas, `production` cuando Plaid apruebe el acceso.
- `APP_URL`: origen exacto de tu frontend (para CORS), ej. `https://randyraulbr1.github.io`.

## Cómo correr localmente

```
cd server
npm install
cp .env.example .env   # y rellena los valores
npm start
```

## Cómo desplegar en Render

1. Crea una base de datos Postgres en Render (plan gratis sirve para empezar).
2. Copia su "Internal Database URL" o "External Database URL" a `DATABASE_URL`.
3. Ejecuta `schema.sql` una vez contra esa base (Render te da un botón "Connect" con
   instrucciones, o usa `psql` con la External Database URL desde tu máquina).
4. Crea un "Web Service" en Render, apuntando a la carpeta `server/` de este repo.
5. Build command: `npm install`. Start command: `npm start`.
6. En "Environment", agrega todas las variables de `.env.example` con sus valores reales.
7. Cuando el servicio esté arriba, copia su URL pública y ponla como `API_BASE_URL`
   en el frontend (`src/js/state.js`), y regístrala como webhook URL en el dashboard
   de Plaid: `https://tu-servicio.onrender.com/api/webhooks/plaid`.

## Endpoints

- `GET  /api/health`
- `POST /api/auth/register` `{ email, password }`
- `POST /api/auth/login` `{ email, password }`
- `GET  /api/auth/me` (requiere `Authorization: Bearer <token>`)
- `POST /api/auth/consent`
- `DELETE /api/auth/delete-account`
- `POST /api/plaid/create-link-token`
- `POST /api/plaid/exchange-public-token` `{ public_token }`
- `POST /api/plaid/sync-transactions` `{ plaid_item_id? }`
- `POST /api/plaid/get-liabilities` `{ plaid_item_id }`
- `POST /api/plaid/disconnect` `{ plaid_item_id, keep_transactions }`
- `GET  /api/plaid/institutions-status`
- `POST /api/webhooks/plaid` (lo llama Plaid, no el frontend)

## Alcance de esta primera versión (MVP)

Solo lectura: nunca mueve dinero ni programa pagos automáticos. Solo lee cuentas,
saldos, tarjetas, préstamos y transacciones para mostrar análisis y recomendaciones.
