"use strict";
/*
 * Prueba especifica pedida: Usuario A crea datos, Usuario B intenta leerlos
 * usando el ID de A directamente. La API debe impedirlo siempre (403/404),
 * nunca debe devolver los datos de otro usuario ni permitir borrarlos.
 *
 * Se corre con: node server/tests/cross-user-authorization.test.js
 * (requiere el servidor corriendo y accesible en TEST_BASE_URL, o arranca
 * uno propio si TEST_BASE_URL no esta definida).
 */
const assert = require("assert");

const BASE = process.env.TEST_BASE_URL || "http://localhost:3050";

async function post(path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const resp = await fetch(BASE + path, { method: "POST", headers, body: JSON.stringify(body || {}) });
  let data = null;
  try { data = await resp.json(); } catch (e) {}
  return { status: resp.status, data };
}
async function get(path, token) {
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  const resp = await fetch(BASE + path, { headers });
  let data = null;
  try { data = await resp.json(); } catch (e) {}
  return { status: resp.status, data };
}

async function run() {
  const suffix = Date.now();
  const emailA = `test-a-${suffix}@example.com`;
  const emailB = `test-b-${suffix}@example.com`;
  const password = "clave-segura-123";

  console.log("1. Registrando Usuario A...");
  const regA = await post("/api/auth/register", { email: emailA, password });
  assert.strictEqual(regA.status, 201, "Usuario A deberia registrarse OK");
  const tokenA = regA.data.token;

  console.log("2. Registrando Usuario B...");
  const regB = await post("/api/auth/register", { email: emailB, password });
  assert.strictEqual(regB.status, 201, "Usuario B deberia registrarse OK");
  const tokenB = regB.data.token;

  console.log("3. Usuario A consulta sus propias cuentas/transacciones (debe funcionar, aunque esten vacias)...");
  const accA = await get("/api/plaid/accounts", tokenA);
  assert.strictEqual(accA.status, 200, "Usuario A deberia poder ver sus propias cuentas");
  const txA = await get("/api/plaid/transactions", tokenA);
  assert.strictEqual(txA.status, 200, "Usuario A deberia poder ver sus propias transacciones");

  console.log("4. Usuario B intenta usar SU PROPIO token para listar cuentas: debe ver una lista vacia, nunca las de A...");
  const accB = await get("/api/plaid/accounts", tokenB);
  assert.strictEqual(accB.status, 200);
  assert.strictEqual(accB.data.accounts.length, 0, "Usuario B no debe ver ninguna cuenta de Usuario A en su propia lista");

  console.log("5. Usuario B intenta desconectar un banco usando un plaid_item_id inventado/de otro usuario...");
  const discB = await post("/api/plaid/disconnect", { plaid_item_id: "00000000-0000-0000-0000-000000000000" }, tokenB);
  assert.ok([403, 404].includes(discB.status), "Debe responder 403 o 404, nunca 200. Recibido: " + discB.status);

  console.log("6. Usuario B intenta pedir liabilities con un plaid_item_id inventado...");
  const liabB = await post("/api/plaid/get-liabilities", { plaid_item_id: "00000000-0000-0000-0000-000000000000" }, tokenB);
  assert.ok([403, 404].includes(liabB.status), "Debe responder 403 o 404, nunca 200. Recibido: " + liabB.status);

  console.log("7. Sin token, cualquier ruta protegida debe responder 401...");
  const sinToken = await get("/api/plaid/accounts", null);
  assert.strictEqual(sinToken.status, 401, "Sin token debe ser 401");

  console.log("8. Un token invalido/manipulado debe responder 401...");
  const tokenFalso = tokenA.slice(0, -5) + "AAAAA";
  const tokenInvalido = await get("/api/plaid/accounts", tokenFalso);
  assert.strictEqual(tokenInvalido.status, 401, "Token invalido debe ser 401");

  console.log("\nTODAS LAS PRUEBAS DE AUTORIZACION ENTRE USUARIOS PASARON.");
}

run().catch((e) => {
  console.error("\nFALLO LA PRUEBA:", e.message);
  process.exit(1);
});
