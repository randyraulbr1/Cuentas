import crypto from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const memoryItems = new Map();
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false })
  : null;

function encryptionKey() {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || "";
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("TOKEN_ENCRYPTION_KEY es obligatoria en producción");
  }
  return crypto.createHash("sha256").update(secret || "sandbox-development-only").digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((x) => x.toString("base64url")).join(".");
}

function decrypt(value) {
  const [ivText, tagText, encryptedText] = String(value).split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export async function initializeTokenStore() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plaid_items (
      profile_id TEXT PRIMARY KEY,
      access_token_enc TEXT NOT NULL,
      item_id TEXT NOT NULL,
      cursor TEXT,
      environment TEXT NOT NULL,
      connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function saveItem(profileId, data) {
  const normalized = {
    ...data,
    profileId,
    connectedAt: data.connectedAt || new Date().toISOString(),
  };
  if (!pool) {
    memoryItems.set(profileId, normalized);
    return;
  }
  await pool.query(
    `INSERT INTO plaid_items(profile_id, access_token_enc, item_id, cursor, environment, connected_at, updated_at)
     VALUES($1,$2,$3,$4,$5,$6,NOW())
     ON CONFLICT(profile_id) DO UPDATE SET
       access_token_enc=EXCLUDED.access_token_enc,
       item_id=EXCLUDED.item_id,
       cursor=EXCLUDED.cursor,
       environment=EXCLUDED.environment,
       updated_at=NOW()`,
    [profileId, encrypt(normalized.accessToken), normalized.itemId, normalized.cursor || null, normalized.environment, normalized.connectedAt]
  );
}

export async function getItem(profileId) {
  if (!pool) return memoryItems.get(profileId) || null;
  const result = await pool.query("SELECT * FROM plaid_items WHERE profile_id=$1", [profileId]);
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    profileId,
    accessToken: decrypt(row.access_token_enc),
    itemId: row.item_id,
    cursor: row.cursor,
    environment: row.environment,
    connectedAt: row.connected_at?.toISOString?.() || row.connected_at,
  };
}

export async function removeItem(profileId) {
  if (!pool) return memoryItems.delete(profileId);
  const result = await pool.query("DELETE FROM plaid_items WHERE profile_id=$1", [profileId]);
  return result.rowCount > 0;
}

export async function hasItem(profileId) {
  return Boolean(await getItem(profileId));
}
