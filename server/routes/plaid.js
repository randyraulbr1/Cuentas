import { Router } from "express";
import { CountryCode, Products } from "plaid";
import { plaidClient, plaidEnvironment } from "../plaidClient.js";
import { getItem, removeItem, saveItem } from "../tokenStore.js";

const router = Router();

function requireProfileId(req, res) {
  const profileId = String(req.body?.profileId || req.query?.profileId || "").trim();
  if (!profileId) {
    res.status(400).json({ error: "profileId es obligatorio" });
    return null;
  }
  return profileId;
}

router.get("/status", async (req, res, next) => {
  try {
    const profileId = requireProfileId(req, res);
    if (!profileId) return;
    res.json({ connected: Boolean(await getItem(profileId)), environment: plaidEnvironment });
  } catch (error) { next(error); }
});

router.post("/create-link-token", async (req, res, next) => {
  try {
    const profileId = requireProfileId(req, res);
    if (!profileId) return;
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: profileId },
      client_name: "Cuentas Claras",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "es",
    });
    res.json({ linkToken: response.data.link_token, expiration: response.data.expiration, environment: plaidEnvironment });
  } catch (error) { next(error); }
});

router.post("/exchange-public-token", async (req, res, next) => {
  try {
    const profileId = requireProfileId(req, res);
    if (!profileId) return;
    const publicToken = String(req.body?.publicToken || "").trim();
    if (!publicToken) return res.status(400).json({ error: "publicToken es obligatorio" });
    const exchange = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    await saveItem(profileId, {
      accessToken: exchange.data.access_token,
      itemId: exchange.data.item_id,
      cursor: null,
      environment: plaidEnvironment,
    });
    res.json({ connected: true, itemId: exchange.data.item_id, environment: plaidEnvironment });
  } catch (error) { next(error); }
});

router.post("/sync-transactions", async (req, res, next) => {
  try {
    const profileId = requireProfileId(req, res);
    if (!profileId) return;
    const item = await getItem(profileId);
    if (!item) return res.status(404).json({ error: "No hay banco conectado para este perfil" });
    let cursor = item.cursor || undefined;
    let hasMore = true;
    const added = [], modified = [], removed = [];
    const accounts = new Map();
    while (hasMore) {
      const response = await plaidClient.transactionsSync({ access_token: item.accessToken, cursor, count: 100 });
      for (const account of response.data.accounts || []) accounts.set(account.account_id, account);
      added.push(...response.data.added);
      modified.push(...response.data.modified);
      removed.push(...response.data.removed);
      cursor = response.data.next_cursor;
      hasMore = response.data.has_more;
    }
    await saveItem(profileId, { ...item, cursor });
    res.json({ accounts: Array.from(accounts.values()), added, modified, removed, nextCursor: cursor, syncedAt: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post("/disconnect", async (req, res, next) => {
  try {
    const profileId = requireProfileId(req, res);
    if (!profileId) return;
    res.json({ disconnected: await removeItem(profileId) });
  } catch (error) { next(error); }
});

export default router;
