import { Router } from "express";
import {
  CountryCode,
  Products,
} from "plaid";
import { plaidClient, plaidEnvironment } from "../plaidClient.js";
import { getItem, removeItem, saveItem } from "../tokenStore.js";

const router = Router();

function requireProfileId(req, res) {
  const profileId = String(req.body?.profileId || "").trim();
  if (!profileId) {
    res.status(400).json({ error: "profileId es obligatorio" });
    return null;
  }
  return profileId;
}

router.post("/create-link-token", async (req, res, next) => {
  try {
    const profileId = requireProfileId(req, res);
    if (!profileId) return;

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: profileId },
      client_name: "Asistente financiero personal",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    res.json({
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
      environment: plaidEnvironment,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/exchange-public-token", async (req, res, next) => {
  try {
    const profileId = requireProfileId(req, res);
    if (!profileId) return;

    const publicToken = String(req.body?.publicToken || "").trim();
    if (!publicToken) {
      return res.status(400).json({ error: "publicToken es obligatorio" });
    }

    const exchange = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    saveItem(profileId, {
      accessToken: exchange.data.access_token,
      itemId: exchange.data.item_id,
      cursor: null,
      environment: plaidEnvironment,
    });

    res.json({
      connected: true,
      itemId: exchange.data.item_id,
      environment: plaidEnvironment,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/sync-transactions", async (req, res, next) => {
  try {
    const profileId = requireProfileId(req, res);
    if (!profileId) return;

    const item = getItem(profileId);
    if (!item) {
      return res.status(404).json({ error: "No hay banco conectado para este perfil" });
    }

    const originalCursor = item.cursor || undefined;
    let cursor = originalCursor;
    let hasMore = true;
    const added = [];
    const modified = [];
    const removed = [];
    const accounts = new Map();

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: item.accessToken,
        cursor,
        count: 100,
      });

      for (const account of response.data.accounts || []) {
        accounts.set(account.account_id, account);
      }
      added.push(...response.data.added);
      modified.push(...response.data.modified);
      removed.push(...response.data.removed);
      cursor = response.data.next_cursor;
      hasMore = response.data.has_more;
    }

    saveItem(profileId, { ...item, cursor });

    res.json({
      accounts: Array.from(accounts.values()),
      added,
      modified,
      removed,
      nextCursor: cursor,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error?.response?.data?.error_code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION") {
      return res.status(409).json({
        error: "Las transacciones cambiaron durante la sincronización. Intenta actualizar otra vez.",
        retryable: true,
      });
    }
    next(error);
  }
});

router.post("/disconnect", (req, res) => {
  const profileId = requireProfileId(req, res);
  if (!profileId) return;
  const removed = removeItem(profileId);
  res.json({ disconnected: removed });
});

export default router;
