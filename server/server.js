import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import plaidRoutes from "./routes/plaid.js";
import { initializeTokenStore } from "./tokenStore.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const appUrl = process.env.APP_URL || `http://localhost:${port}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..");

app.disable("x-powered-by");
app.use(cors({ origin: appUrl, credentials: false }));
app.use(express.json({ limit: "100kb" }));
app.use(express.static(publicDir));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, environment: process.env.PLAID_ENV || "sandbox", persistent: Boolean(process.env.DATABASE_URL) });
});

app.use("/api/plaid", plaidRoutes);

app.use((error, _req, res, _next) => {
  console.error(error?.response?.data || error);
  const plaidError = error?.response?.data;
  res.status(Number(error?.response?.status || 500)).json({
    error: plaidError?.error_message || error?.message || "Error interno",
    code: plaidError?.error_code || "INTERNAL_ERROR",
  });
});

await initializeTokenStore();
app.listen(port, "0.0.0.0", () => {
  console.log(`Cuentas Claras activa en ${appUrl}`);
});
