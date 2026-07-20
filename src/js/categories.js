"use strict";

/* ---------- categorias para transacciones bancarias importadas ---------- */
const BANK_CATEGORIES = [
  "salario", "amazon", "walmart", "costco", "target", "restaurantes", "gasolina",
  "supermercado", "seguros", "hipoteca_renta", "electricidad", "agua", "internet",
  "telefono", "streaming", "suscripciones", "compras", "transferencias", "depositos",
  "tarjeta_credito", "otros",
];

/* palabra clave (en mayusculas, tal como suele venir en el CSV del banco) -> categoria.
   Esta lista cubre comercios comunes en EE. UU.; se usa solo si el usuario no ha
   clasificado ya ese comercio antes (las reglas aprendidas siempre tienen prioridad). */
const DEFAULT_MERCHANT_RULES = [
  [["AMAZON", "AMZN"], "amazon"],
  [["WALMART", "WAL-MART", "WM SUPERCENTER"], "walmart"],
  [["COSTCO"], "costco"],
  [["TARGET"], "target"],
  [["UBER EATS", "DOORDASH", "GRUBHUB", "MCDONALD", "CHIPOTLE", "STARBUCKS", "RESTAURANT", "PIZZA"], "restaurantes"],
  [["UBER", "LYFT"], "otros"],
  [["SHELL", "CHEVRON", "EXXON", "MOBIL", "GAS STATION", "CIRCLE K", "CITGO", "CONOCOPHILLIPS"], "gasolina"],
  [["KROGER", "SAFEWAY", "PUBLIX", "ALDI", "TRADER JOE", "WHOLE FOODS", "H-E-B", "HEB", "SUPERMARKET", "GROCERY"], "supermercado"],
  [["GEICO", "PROGRESSIVE", "STATE FARM", "ALLSTATE", "INSURANCE"], "seguros"],
  [["MORTGAGE", "RENT PAYMENT", "APARTMENTS", "PROPERTY MGMT"], "hipoteca_renta"],
  [["ELECTRIC", "POWER CO", "ENERGY"], "electricidad"],
  [["WATER DEPT", "WATER UTILITY", "WATER CO"], "agua"],
  [["COMCAST", "XFINITY", "SPECTRUM", "AT&T INTERNET", "FIBER"], "internet"],
  [["VERIZON", "T-MOBILE", "TMOBILE", "AT&T", "CRICKET", "BOOST MOBILE"], "telefono"],
  [["NETFLIX", "HULU", "DISNEY+", "DISNEY PLUS", "HBO", "PARAMOUNT+", "PEACOCK"], "streaming"],
  [["SPOTIFY", "APPLE.COM/BILL", "APPLE MUSIC", "GOOGLE *", "YOUTUBE PREMIUM", "AMAZON PRIME"], "suscripciones"],
  [["PAYROLL", "DIRECT DEP", "DIR DEP", "SALARY", "DEPOSIT PAYROLL"], "salario"],
  [["TRANSFER", "ZELLE", "VENMO", "CASH APP"], "transferencias"],
  [["CREDIT CARD PMT", "CC PAYMENT", "CARD PAYMENT"], "tarjeta_credito"],
];

function normalizeMerchant(desc) {
  return String(desc || "").toUpperCase().replace(/\s+/g, " ").trim();
}
function merchantKey(desc) {
  // usa las primeras palabras como llave estable para aprender por comercio, no por transaccion exacta
  return normalizeMerchant(desc).split(" ").slice(0, 3).join(" ");
}

function guessCategory(desc, monto) {
  const norm = normalizeMerchant(desc);
  const key = merchantKey(desc);
  if (state.categoriaAprendida && state.categoriaAprendida[key]) return state.categoriaAprendida[key];
  for (const [keywords, cat] of DEFAULT_MERCHANT_RULES) {
    if (keywords.some((kw) => norm.indexOf(kw) !== -1)) return cat;
  }
  if (toNum(monto) > 0) return "depositos";
  return null; // sin categoria: se le preguntara al usuario
}

function learnCategory(desc, categoria) {
  if (!state.categoriaAprendida) state.categoriaAprendida = {};
  state.categoriaAprendida[merchantKey(desc)] = categoria;
}
