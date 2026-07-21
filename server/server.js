"use strict";
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { ensureExtensions, getDbStatus } = require("./db");
const { rateLimit } = require("./middleware/rateLimit");
const authRoutes = require("./routes/auth");
const plaidRoutes = require("./routes/plaid");
const webhookRoutes = require("./routes/webhooks");

const app = express();
app.set("trust proxy", 1);

const allowedOrigin = process.env.APP_URL || "*";
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "200kb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// Limite general de respaldo para toda la API (ademas de los limites mas
// estrictos en rutas sensibles como login, sync o crear link token).
app.use("/api", rateLimit(300, 15 * 60 * 1000));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, env: process.env.PLAID_ENV || "sandbox", time: new Date().toISOString(), database: getDbStatus() });
});

app.use("/api/auth", authRoutes);
app.use("/api/plaid", plaidRoutes);
app.use("/api/webhooks", webhookRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log("Cuentas Claras backend escuchando en puerto " + PORT);
    ensureExtensions().then((ok) => {
      if (ok) console.log("Base de datos lista.");
      else console.error("La base de datos no quedo lista; revisa DATABASE_URL.");
    });
  });
}

module.exports = app;
