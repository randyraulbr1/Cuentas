"use strict";
const express = require("express");
const { plaidClient, envName } = require("../plaidClient");
const { query } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { encrypt, decrypt } = require("../crypto");
const { guessCategory, merchantKey } = require("../categories");
const { Products, CountryCode } = require("plaid");

const router = express.Router();

router.post("/create-link-token", requireAuth, async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.userId },
      client_name: "Cuentas Claras",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    res.json({ link_token: response.data.link_token });
  } catch (e) {
    res.status(502).json({ error: "No se pudo crear el link token de Plaid", detail: e.response ? e.response.data : e.message });
  }
});

router.post("/exchange-public-token", requireAuth, async (req, res) => {
  const { public_token } = req.body || {};
  if (!public_token) return res.status(400).json({ error: "Falta public_token" });
  try {
    const exchange = await plaidClient.itemPublicTokenExchange({ public_token });
    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    let institutionId = null, institutionName = null;
    try {
      const itemInfo = await plaidClient.itemGet({ access_token: accessToken });
      institutionId = itemInfo.data.item.institution_id || null;
      if (institutionId) {
        const inst = await plaidClient.institutionsGetById({ institution_id: institutionId, country_codes: [CountryCode.Us] });
        institutionName = inst.data.institution.name;
      }
    } catch (e) { /* informacion opcional, no bloquea la conexion */ }

    const enc = encrypt(accessToken);
    const result = await query(
      `INSERT INTO plaid_items (user_id, item_id, institution_id, institution_name, access_token_enc, access_token_iv, access_token_tag, environment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id, item_id) DO UPDATE SET status = 'active', updated_at = now()
       RETURNING id, institution_name`,
      [req.userId, itemId, institutionId, institutionName, enc.ciphertext, enc.iv, enc.tag, envName]
    );
    res.json({ ok: true, plaid_item: result.rows[0] });
  } catch (e) {
    res.status(502).json({ error: "No se pudo intercambiar el token", detail: e.response ? e.response.data : e.message });
  }
});

async function getDecryptedAccessToken(plaidItemRow) {
  return decrypt(plaidItemRow.access_token_enc, plaidItemRow.access_token_iv, plaidItemRow.access_token_tag);
}

router.post("/sync-transactions", requireAuth, async (req, res) => {
  const { plaid_item_id } = req.body || {};
  try {
    const itemsResult = plaid_item_id
      ? await query("SELECT * FROM plaid_items WHERE id = $1 AND user_id = $2 AND status = 'active'", [plaid_item_id, req.userId])
      : await query("SELECT * FROM plaid_items WHERE user_id = $1 AND status = 'active'", [req.userId]);

    let totalAdded = 0, totalModified = 0, totalRemoved = 0;

    for (const item of itemsResult.rows) {
      const accessToken = await getDecryptedAccessToken(item);
      let cursor = item.cursor || undefined;
      let hasMore = true;

      while (hasMore) {
        const resp = await plaidClient.transactionsSync({ access_token: accessToken, cursor: cursor });
        const data = resp.data;

        for (const acc of data.accounts || []) {
          await query(
            `INSERT INTO accounts (user_id, plaid_item_id, account_id, name, official_name, mask, type, subtype, balance_available, balance_current, balance_limit, currency)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             ON CONFLICT (user_id, account_id) DO UPDATE SET
               balance_available = EXCLUDED.balance_available, balance_current = EXCLUDED.balance_current,
               balance_limit = EXCLUDED.balance_limit, updated_at = now()`,
            [req.userId, item.id, acc.account_id, acc.name, acc.official_name, acc.mask, acc.type, acc.subtype,
              acc.balances.available, acc.balances.current, acc.balances.limit, acc.balances.iso_currency_code]
          );
        }

        const learnedResult = await query("SELECT merchant_key, categoria FROM category_rules WHERE user_id = $1", [req.userId]);
        const learnedMap = {};
        learnedResult.rows.forEach((r) => { learnedMap[r.merchant_key] = r.categoria; });

        for (const tx of data.added.concat(data.modified)) {
          const accRow = await query("SELECT id FROM accounts WHERE user_id = $1 AND account_id = $2", [req.userId, tx.account_id]);
          if (accRow.rows.length === 0) continue;
          const monto = -tx.amount; // Plaid: positivo = salida de dinero. En la app: negativo = gasto.
          const categoria = guessCategory(tx.merchant_name || tx.name, monto, learnedMap);
          await query(
            `INSERT INTO transactions (user_id, account_id, plaid_tx_id, fecha, descripcion, merchant_name, monto, categoria, pendiente, source)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'plaid')
             ON CONFLICT (user_id, plaid_tx_id) DO UPDATE SET
               fecha = EXCLUDED.fecha, descripcion = EXCLUDED.descripcion, monto = EXCLUDED.monto,
               pendiente = EXCLUDED.pendiente, updated_at = now()`,
            [req.userId, accRow.rows[0].id, tx.transaction_id, tx.date, tx.name, tx.merchant_name, monto, categoria, tx.pending]
          );
        }
        totalAdded += data.added.length;
        totalModified += data.modified.length;

        for (const rem of data.removed) {
          await query("UPDATE transactions SET removed = true, updated_at = now() WHERE user_id = $1 AND plaid_tx_id = $2", [req.userId, rem.transaction_id]);
          totalRemoved++;
        }

        cursor = data.next_cursor;
        hasMore = data.has_more;
      }

      await query("UPDATE plaid_items SET cursor = $1, last_synced_at = now(), updated_at = now() WHERE id = $2", [cursor, item.id]);
      await query("INSERT INTO sync_logs (user_id, plaid_item_id, tipo, detalle) VALUES ($1,$2,'sync',$3)",
        [req.userId, item.id, `added=${totalAdded} modified=${totalModified} removed=${totalRemoved}`]);
    }

    res.json({ ok: true, added: totalAdded, modified: totalModified, removed: totalRemoved });
  } catch (e) {
    res.status(502).json({ error: "No se pudo sincronizar", detail: e.response ? e.response.data : e.message });
  }
});

router.post("/get-liabilities", requireAuth, async (req, res) => {
  const { plaid_item_id } = req.body || {};
  try {
    const itemResult = await query("SELECT * FROM plaid_items WHERE id = $1 AND user_id = $2", [plaid_item_id, req.userId]);
    if (itemResult.rows.length === 0) return res.status(404).json({ error: "Conexión no encontrada" });
    const accessToken = await getDecryptedAccessToken(itemResult.rows[0]);
    const resp = await plaidClient.liabilitiesGet({ access_token: accessToken });
    res.json({ liabilities: resp.data.liabilities });
  } catch (e) {
    res.status(502).json({ error: "No se pudo obtener préstamos/tarjetas", detail: e.response ? e.response.data : e.message });
  }
});

router.post("/disconnect", requireAuth, async (req, res) => {
  const { plaid_item_id, keep_transactions } = req.body || {};
  try {
    const itemResult = await query("SELECT * FROM plaid_items WHERE id = $1 AND user_id = $2", [plaid_item_id, req.userId]);
    if (itemResult.rows.length === 0) return res.status(404).json({ error: "Conexión no encontrada" });
    const item = itemResult.rows[0];
    const accessToken = await getDecryptedAccessToken(item);
    try { await plaidClient.itemRemove({ access_token: accessToken }); } catch (e) { /* si ya estaba invalido, seguimos igual */ }

    if (!keep_transactions) {
      await query("DELETE FROM transactions WHERE user_id = $1 AND account_id IN (SELECT id FROM accounts WHERE plaid_item_id = $2)", [req.userId, item.id]);
      await query("DELETE FROM accounts WHERE plaid_item_id = $1", [item.id]);
    }
    await query("UPDATE plaid_items SET status = 'disconnected', access_token_enc = '', access_token_iv = '', access_token_tag = '', updated_at = now() WHERE id = $1", [item.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: "No se pudo desconectar", detail: e.response ? e.response.data : e.message });
  }
});

router.get("/institutions-status", requireAuth, async (req, res) => {
  const result = await query(
    "SELECT id, institution_name, status, last_synced_at FROM plaid_items WHERE user_id = $1 ORDER BY created_at DESC",
    [req.userId]
  );
  res.json({ items: result.rows });
});

router.get("/accounts", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT a.id, a.name, a.official_name, a.mask, a.type, a.subtype,
            a.balance_available, a.balance_current, a.balance_limit, a.currency,
            pi.institution_name
     FROM accounts a JOIN plaid_items pi ON pi.id = a.plaid_item_id
     WHERE a.user_id = $1 AND pi.status = 'active'
     ORDER BY a.created_at ASC`,
    [req.userId]
  );
  res.json({ accounts: result.rows });
});

router.get("/transactions", requireAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
  const result = await query(
    `SELECT id, fecha, descripcion, merchant_name, monto, categoria, pendiente
     FROM transactions
     WHERE user_id = $1 AND removed = false
     ORDER BY fecha DESC, created_at DESC
     LIMIT $2`,
    [req.userId, limit]
  );
  res.json({ transactions: result.rows });
});

module.exports = router;
