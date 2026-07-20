-- Esquema de Cuentas Claras (backend). Diseñado para Postgres (Render Postgres o cualquier
-- Postgres administrado). Ejecutar una sola vez al aprovisionar la base de datos.
-- Todas las tablas tienen created_at/updated_at; las que representan datos por usuario
-- llevan user_id con ON DELETE CASCADE, así "eliminar cuenta" limpia todo con una sola sentencia.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  consent_accepted_at TIMESTAMPTZ,           -- consentimiento de Plaid/privacidad
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un "item" de Plaid = una conexión bancaria autorizada (puede tener varias cuentas dentro).
CREATE TABLE IF NOT EXISTS plaid_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id           TEXT NOT NULL,           -- item_id de Plaid
  institution_id    TEXT,
  institution_name  TEXT,
  access_token_enc  TEXT NOT NULL,           -- access_token cifrado con AES-256-GCM (ver crypto.js)
  access_token_iv   TEXT NOT NULL,
  access_token_tag  TEXT NOT NULL,
  cursor            TEXT,                    -- cursor de /transactions/sync
  status            TEXT NOT NULL DEFAULT 'active', -- active | disconnected | error
  environment       TEXT NOT NULL DEFAULT 'sandbox',
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plaid_item_id UUID NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
  account_id    TEXT NOT NULL,               -- account_id de Plaid
  name          TEXT,
  official_name TEXT,
  mask          TEXT,                        -- ultimos 4 digitos solamente
  type          TEXT,
  subtype       TEXT,
  balance_available NUMERIC(14,2),
  balance_current    NUMERIC(14,2),
  balance_limit      NUMERIC(14,2),
  currency      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plaid_tx_id     TEXT NOT NULL,             -- transaction_id de Plaid (llave para evitar duplicados)
  fecha           DATE NOT NULL,
  descripcion     TEXT NOT NULL,
  merchant_name   TEXT,
  monto           NUMERIC(14,2) NOT NULL,    -- positivo = ingreso, negativo = gasto (igual que en la app)
  categoria       TEXT,                      -- categoria propia de la app (ver categories.js)
  pendiente       BOOLEAN NOT NULL DEFAULT false,
  removed         BOOLEAN NOT NULL DEFAULT false, -- Plaid la marco como eliminada; no se borra fisico, se marca
  tipo            TEXT NOT NULL DEFAULT 'expense', -- income | expense | transfer | refund | payment | adjustment
  source          TEXT NOT NULL DEFAULT 'plaid',   -- manual | plaid_sandbox | plaid | csv | system
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, plaid_tx_id)
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_fecha ON transactions (user_id, fecha DESC);

CREATE TABLE IF NOT EXISTS category_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_key TEXT NOT NULL,                -- misma llave que merchantKey() en categories.js
  categoria    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, merchant_key)
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plaid_item_id UUID REFERENCES plaid_items(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,                 -- sync | webhook | error
  detalle     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
