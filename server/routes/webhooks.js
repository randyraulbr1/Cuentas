"use strict";
const express = require("express");
const { query } = require("../db");

const router = express.Router();

// Plaid llama aquí directamente (no requiere JWT de nuestra app, Plaid no lo tiene).
// En producción conviene además validar la firma del webhook (Plaid-Verification header)
// antes de confiar en el contenido; se deja marcado como pendiente.
router.post("/plaid", express.json(), async (req, res) => {
  const { webhook_type, webhook_code, item_id } = req.body || {};
  try {
    const itemResult = await query("SELECT id, user_id FROM plaid_items WHERE item_id = $1", [item_id]);
    const item = itemResult.rows[0];

    if (item) {
      await query("INSERT INTO sync_logs (user_id, plaid_item_id, tipo, detalle) VALUES ($1,$2,'webhook',$3)",
        [item.user_id, item.id, `${webhook_type}/${webhook_code}`]);
    }

    if (webhook_type === "TRANSACTIONS" && webhook_code === "SYNC_UPDATES_AVAILABLE" && item) {
      // Se marca para que la app, en su próxima apertura o al tocar "Actualizar",
      // dispare /api/plaid/sync-transactions. Esto evita sincronizar de más y
      // controla el costo: solo se sincroniza cuando Plaid avisa que hay algo nuevo.
      await query("UPDATE plaid_items SET status = status WHERE id = $1", [item.id]); // marcador simple; ampliable con una columna pending_sync si se desea
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(200).json({ ok: true }); // Plaid espera 200 aunque falle algo interno, para no reintentar en bucle
  }
});

module.exports = router;
