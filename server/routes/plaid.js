"use strict";
const express = require("express");
const { plaidClient, envName } = require("../plaidClient");
const { query } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");
const { encrypt, decrypt } = require("../crypto");
const { guessCategory, merchantKey } = require("../categories");
const { Products, CountryCode } = require("plaid");

const router = express.Router();

router.post("/create-link-token", requireAuth, rateLimit(20, 60 * 60 * 1000), async (req, res) => {
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
    console.error("PLAID_LINK_TOKEN_ERROR:", JSON.stringify(e.response ? e.response.data : e.message));
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
       ON CONFLICT (user_id, item_id) DO UPDATE SET
         institution_id = EXCLUDED.institution_id,
         institution_name = EXCLUDED.institution_name,
         access_token_enc = EXCLUDED.access_token_enc,
         access_token_iv = EXCLUDED.access_token_iv,
         access_token_tag = EXCLUDED.access_token_tag,
         environment = EXCLUDED.environment,
         cursor = NULL,
         status = 'active',
         updated_at = now()
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

async function savePlaidAccount(userId, plaidItemId, acc) {
  await query(
    `INSERT INTO accounts (user_id, plaid_item_id, account_id, name, official_name, mask, type, subtype, balance_available, balance_current, balance_limit, currency)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (user_id, account_id) DO UPDATE SET
       plaid_item_id = EXCLUDED.plaid_item_id,
       name = EXCLUDED.name,
       official_name = EXCLUDED.official_name,
       mask = EXCLUDED.mask,
       type = EXCLUDED.type,
       subtype = EXCLUDED.subtype,
       balance_available = EXCLUDED.balance_available,
       balance_current = EXCLUDED.balance_current,
       balance_limit = EXCLUDED.balance_limit,
       currency = EXCLUDED.currency,
       updated_at = now()`,
    [userId, plaidItemId, acc.account_id, acc.name, acc.official_name, acc.mask, acc.type, acc.subtype,
      acc.balances && acc.balances.available, acc.balances && acc.balances.current,
      acc.balances && acc.balances.limit, acc.balances && acc.balances.iso_currency_code]
  );
}

router.post("/sync-transactions", requireAuth, rateLimit(30, 60 * 60 * 1000), async (req, res) => {
  const { plaid_item_id } = req.body || {};
  try {
    const itemsResult = plaid_item_id
      ? await query("SELECT * FROM plaid_items WHERE id = $1 AND user_id = $2 AND status = 'active'", [plaid_item_id, req.userId])
      : await query("SELECT * FROM plaid_items WHERE user_id = $1 AND status = 'active'", [req.userId]);

    let totalAdded = 0, totalModified = 0, totalRemoved = 0;

    for (const item of itemsResult.rows) {
      const accessToken = await getDecryptedAccessToken(item);

      // /accounts/get esta disponible inmediatamente despues de Link. No esperamos a que
      // Plaid termine la actualizacion inicial de Transactions para mostrar cuentas y saldos.
      const accountsResp = await plaidClient.accountsGet({ access_token: accessToken });
      for (const acc of accountsResp.data.accounts || []) {
        await savePlaidAccount(req.userId, item.id, acc);
      }

      let cursor = item.cursor || undefined;
      let hasMore = true;

      while (hasMore) {
        const resp = await plaidClient.transactionsSync({ access_token: accessToken, cursor: cursor });
        const data = resp.data;

        for (const acc of data.accounts || []) {
          await savePlaidAccount(req.userId, item.id, acc);
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
            `INSERT INTO transactions (user_id, account_id, plaid_tx_id, fecha, descripcion, merchant_name, monto, categoria, pendiente, fecha_hora, source)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'plaid')
             ON CONFLICT (user_id, plaid_tx_id) DO UPDATE SET
               fecha = EXCLUDED.fecha, descripcion = EXCLUDED.descripcion, monto = EXCLUDED.monto,
               pendiente = EXCLUDED.pendiente, fecha_hora = EXCLUDED.fecha_hora, updated_at = now()`,
            [req.userId, accRow.rows[0].id, tx.transaction_id, tx.date, tx.name, tx.merchant_name, monto, categoria, tx.pending, tx.datetime || tx.authorized_datetime || null]
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

      // Respaldo para conexiones nuevas: /transactions/sync puede responder vacío
      // durante la preparación inicial. Consultamos directamente seis meses de historial.
      const existingTx = await query(
        "SELECT COUNT(*)::int AS total FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE t.user_id = $1 AND a.plaid_item_id = $2 AND t.removed = false",
        [req.userId, item.id]
      );
      if (Number(existingTx.rows[0].total || 0) === 0) {
        try {
          const endDate = new Date();
          const startDate = new Date(endDate); startDate.setDate(startDate.getDate() - 180);
          const endKey = endDate.toISOString().slice(0, 10);
          const startKey = startDate.toISOString().slice(0, 10);
          let offset = 0, totalAvailable = 1;
          const learnedResult = await query("SELECT merchant_key, categoria FROM category_rules WHERE user_id = $1", [req.userId]);
          const learnedMap = {};
          learnedResult.rows.forEach((row) => { learnedMap[row.merchant_key] = row.categoria; });

          while (offset < totalAvailable && offset < 1000) {
            const historyResp = await plaidClient.transactionsGet({
              access_token: accessToken,
              start_date: startKey,
              end_date: endKey,
              options: { count: 500, offset: offset },
            });
            const history = historyResp.data.transactions || [];
            totalAvailable = Number(historyResp.data.total_transactions || history.length);
            for (const tx of history) {
              const accRow = await query("SELECT id FROM accounts WHERE user_id = $1 AND account_id = $2", [req.userId, tx.account_id]);
              if (accRow.rows.length === 0) continue;
              const monto = -tx.amount;
              const categoria = guessCategory(tx.merchant_name || tx.name, monto, learnedMap);
              await query(
                `INSERT INTO transactions (user_id, account_id, plaid_tx_id, fecha, descripcion, merchant_name, monto, categoria, pendiente, fecha_hora, source)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'plaid')
                 ON CONFLICT (user_id, plaid_tx_id) DO UPDATE SET
                   fecha = EXCLUDED.fecha, descripcion = EXCLUDED.descripcion, merchant_name = EXCLUDED.merchant_name,
                   monto = EXCLUDED.monto, categoria = EXCLUDED.categoria, pendiente = EXCLUDED.pendiente,
                   fecha_hora = EXCLUDED.fecha_hora, removed = false, updated_at = now()`,
                [req.userId, accRow.rows[0].id, tx.transaction_id, tx.date, tx.name, tx.merchant_name, monto, categoria, tx.pending, tx.datetime || tx.authorized_datetime || null]
              );
            }
            totalAdded += history.length;
            offset += history.length;
            if (history.length === 0) break;
          }
        } catch (historyError) {
          const detail = historyError.response ? historyError.response.data : historyError.message;
          const code = detail && detail.error_code;
          if (code === "PRODUCT_NOT_READY") {
            try { await plaidClient.transactionsRefresh({ access_token: accessToken }); } catch (refreshError) {}
            console.log("PLAID_HISTORY_PENDING:", item.item_id);
          } else {
            console.error("PLAID_HISTORY_FALLBACK_ERROR:", JSON.stringify(detail));
          }
        }
      }

      await query("UPDATE plaid_items SET cursor = $1, last_synced_at = now(), updated_at = now() WHERE id = $2", [cursor, item.id]);
      await query("INSERT INTO sync_logs (user_id, plaid_item_id, tipo, detalle) VALUES ($1,$2,'sync',$3)",
        [req.userId, item.id, `added=${totalAdded} modified=${totalModified} removed=${totalRemoved}`]);

      try {
        const liabResp = await plaidClient.liabilitiesGet({ access_token: accessToken });
        const liab = liabResp.data.liabilities || {};
        const todas = [].concat(liab.credit || [], liab.mortgage || [], liab.student || []);
        for (const l of todas) {
          const apr = l.aprs ? (l.aprs.find((a) => a.apr_percentage) || {}).apr_percentage : (l.interest_rate ? l.interest_rate.percentage : l.interest_rate_percentage);
          const pagoMinimo = l.minimum_payment_amount != null ? l.minimum_payment_amount : l.next_monthly_payment;
          const fechaLimite = l.next_payment_due_date || null;
          const ultimoSaldo = l.last_statement_balance != null ? l.last_statement_balance : null;
          await query(
            `UPDATE accounts SET liab_apr = $1, liab_pago_minimo = $2, liab_fecha_limite = $3, liab_ultimo_saldo = $4, liab_actualizado_en = now()
             WHERE user_id = $5 AND account_id = $6`,
            [apr || null, pagoMinimo || null, fechaLimite, ultimoSaldo, req.userId, l.account_id]
          );
        }
      } catch (e) { /* no todas las instituciones dan liabilities; no bloquea el sync */ }
    }

    res.json({ ok: true, added: totalAdded, modified: totalModified, removed: totalRemoved });
  } catch (e) {
    const detail = e.response ? e.response.data : e.message;
    console.error("PLAID_SYNC_ERROR:", JSON.stringify(detail));
    const code = detail && detail.error_code ? " (" + detail.error_code + ")" : "";
    res.status(502).json({ error: "No se pudo sincronizar" + code, detail });
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

router.get("/liabilities-all", requireAuth, async (req, res) => {
  try {
    const itemsResult = await query("SELECT * FROM plaid_items WHERE user_id = $1 AND status = 'active'", [req.userId]);
    const porCuenta = {};
    for (const item of itemsResult.rows) {
      try {
        const accessToken = await getDecryptedAccessToken(item);
        const resp = await plaidClient.liabilitiesGet({ access_token: accessToken });
        const liab = resp.data.liabilities || {};
        (liab.credit || []).forEach((c) => {
          porCuenta[c.account_id] = {
            tipo: "credito",
            apr: (c.aprs && c.aprs.find((a) => a.apr_percentage) || {}).apr_percentage || null,
            pago_minimo: c.minimum_payment_amount,
            fecha_limite: c.next_payment_due_date,
            ultimo_saldo: c.last_statement_balance,
          };
        });
        (liab.mortgage || []).forEach((m) => {
          porCuenta[m.account_id] = { tipo: "hipoteca", apr: m.interest_rate ? m.interest_rate.percentage : null, pago_minimo: m.next_monthly_payment, fecha_limite: m.next_payment_due_date };
        });
        (liab.student || []).forEach((s) => {
          porCuenta[s.account_id] = { tipo: "estudiantil", apr: s.interest_rate_percentage, pago_minimo: s.minimum_payment_amount, fecha_limite: s.next_payment_due_date };
        });
      } catch (e) { /* si un banco no soporta liabilities, seguimos con los demas */ }
    }
    res.json({ liabilities: porCuenta });
  } catch (e) {
    res.status(502).json({ error: "No se pudieron obtener los datos de intereses", detail: e.message });
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
    "SELECT id, institution_name, status, last_synced_at FROM plaid_items WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC",
    [req.userId]
  );
  res.json({ items: result.rows });
});

router.get("/accounts", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT a.id, a.account_id, a.name, a.official_name, a.mask, a.type, a.subtype,
            a.balance_available, a.balance_current, a.balance_limit, a.currency,
            a.liab_apr, a.liab_pago_minimo, a.liab_fecha_limite, a.liab_ultimo_saldo,
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
    `SELECT t.id, t.fecha, t.fecha_hora, t.descripcion, t.merchant_name, t.monto, t.categoria, t.pendiente, a.id as account_id, a.name as account_name, a.mask as account_mask
     FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE t.user_id = $1 AND t.removed = false
     ORDER BY t.fecha DESC, t.created_at DESC
     LIMIT $2`,
    [req.userId, limit]
  );
  res.json({ transactions: result.rows });
});

module.exports = router;
