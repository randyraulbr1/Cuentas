"use strict";

// Limitador simple en memoria, por usuario (si esta autenticado) o por IP.
// Suficiente para un solo servidor (como Render en su plan basico). Si en el
// futuro se corre en varias instancias a la vez, esto habria que moverlo a
// un almacen compartido (ej. Redis) para que el limite sea real entre todas.

const buckets = new Map();

// Limpieza periodica para no acumular memoria con usuarios viejos.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.windowStart > entry.windowMs) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

let limiterSeq = 0;
function rateLimit(maxRequests, windowMs) {
  const limiterId = "L" + (limiterSeq++); // evita que dos limitadores distintos compartan la misma llave
  return (req, res, next) => {
    const key = limiterId + ":" + (req.userId || req.ip || "anon") + ":" + req.baseUrl + req.path;
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 0, windowStart: now, windowMs };
      buckets.set(key, entry);
    }
    entry.count++;
    if (entry.count > maxRequests) {
      const retryAfterSec = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({ error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos.", retryAfterSec });
    }
    next();
  };
}

module.exports = { rateLimit };
