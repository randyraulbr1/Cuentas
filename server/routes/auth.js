"use strict";
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

router.post("/register", rateLimit(20, 60 * 60 * 1000), async (req, res) => {
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

const MAX_INTENTOS_FALLIDOS = 8;
const BLOQUEO_MINUTOS = 15;

router.post("/login", rateLimit(20, 15 * 60 * 1000), async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Correo y contraseña requeridos" });

  const result = await query("SELECT id, email, password_hash, failed_login_attempts, locked_until FROM users WHERE email = $1", [String(email).toLowerCase()]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "Correo o contraseña incorrectos" });

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutosRestantes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    return res.status(423).json({ error: "Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta de nuevo en " + minutosRestantes + " minuto(s).", locked: true });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const intentos = (user.failed_login_attempts || 0) + 1;
    if (intentos >= MAX_INTENTOS_FALLIDOS) {
      await query("UPDATE users SET failed_login_attempts = 0, locked_until = now() + interval '" + BLOQUEO_MINUTOS + " minutes' WHERE id = $1", [user.id]);
      return res.status(423).json({ error: "Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta de nuevo en " + BLOQUEO_MINUTOS + " minutos.", locked: true });
    }
    await query("UPDATE users SET failed_login_attempts = $1 WHERE id = $2", [intentos, user.id]);
    return res.status(401).json({ error: "Correo o contraseña incorrectos" });
  }

  await query("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1", [user.id]);
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
