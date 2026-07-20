"use strict";
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

router.post("/register", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: "Correo inválido" });
  if (!password || password.length < 8) return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });

  const existing = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
  if (existing.rows.length > 0) return res.status(409).json({ error: "Ya existe una cuenta con ese correo" });

  const hash = await bcrypt.hash(password, 12);
  const result = await query(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at",
    [email.toLowerCase(), hash]
  );
  const user = result.rows[0];
  const token = signToken(user.id);
  res.status(201).json({ token, user: { id: user.id, email: user.email } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Correo y contraseña requeridos" });

  const result = await query("SELECT id, email, password_hash FROM users WHERE email = $1", [String(email).toLowerCase()]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "Correo o contraseña incorrectos" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Correo o contraseña incorrectos" });

  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email } });
});

router.get("/me", requireAuth, async (req, res) => {
  const result = await query("SELECT id, email, consent_accepted_at, created_at FROM users WHERE id = $1", [req.userId]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json({ user: result.rows[0] });
});

router.post("/consent", requireAuth, async (req, res) => {
  await query("UPDATE users SET consent_accepted_at = now(), updated_at = now() WHERE id = $1", [req.userId]);
  res.json({ ok: true });
});

// Elimina al usuario y, por las relaciones ON DELETE CASCADE del esquema,
// todas sus conexiones bancarias, cuentas, transacciones y reglas de categoría.
router.delete("/delete-account", requireAuth, async (req, res) => {
  await query("DELETE FROM users WHERE id = $1", [req.userId]);
  res.json({ ok: true });
});

module.exports = router;
