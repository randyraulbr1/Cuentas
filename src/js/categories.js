"use strict";

/* ---------- categorias para transacciones bancarias importadas ---------- */
const BANK_CATEGORIES = [
  "salario", "amazon", "walmart", "costco", "target", "restaurantes", "gasolina",
  "supermercado", "farmacia", "transporte", "seguros", "hipoteca_renta", "electricidad", "agua", "internet",
  "telefono", "streaming", "suscripciones", "compras", "transferencias", "depositos",
  "tarjeta_credito", "otros",
];

/* icono + color asociado a cada categoria. El color es solo un tono conocido de la
   marca dominante de esa categoria (ej. azul de Walmart) - nunca un logo. Sirve para
   distinguir gastos de un vistazo en el historial. */
const CATEGORY_ICON_MAP = {
  salario: { icon: "bills", color: "#2E7D32" },
  amazon: { icon: "store", color: "#FF9900" },
  walmart: { icon: "cart", color: "#0071CE" },
  costco: { icon: "cart", color: "#E31837" },
  target: { icon: "store", color: "#CC0000" },
  restaurantes: { icon: "utensils", color: "#D35400" },
  gasolina: { icon: "fuel", color: "#FBC02D" },
  supermercado: { icon: "cart", color: "#43A047" },
  farmacia: { icon: "medcross", color: "#C62828" },
  transporte: { icon: "car", color: "#000000" },
  seguros: { icon: "medcross", color: "#1565C0" },
  hipoteca_renta: { icon: "home", color: "#6D4C41" },
  electricidad: { icon: "bulb", color: "#F9A825" },
  agua: { icon: "bulb", color: "#0288D1" },
  internet: { icon: "bulb", color: "#5E35B1" },
  telefono: { icon: "phone", color: "#00897B" },
  streaming: { icon: "clapper", color: "#E50914" },
  suscripciones: { icon: "clapper", color: "#1DB954" },
  compras: { icon: "store", color: "#8E24AA" },
  transferencias: { icon: "bills", color: "#546E7A" },
  depositos: { icon: "bills", color: "#2E7D32" },
  tarjeta_credito: { icon: "card", color: "#37474F" },
  otros: { icon: "store", color: "#5C6BC0" },
};
function categoriaIconoColor(cat) { return CATEGORY_ICON_MAP[cat] || CATEGORY_ICON_MAP.otros; }

/* palabra clave (en mayusculas, tal como suele venir en el CSV del banco) -> categoria.
   Esta lista cubre comercios comunes en EE. UU.; se usa solo si el usuario no ha
   clasificado ya ese comercio antes (las reglas aprendidas siempre tienen prioridad). */
const DEFAULT_MERCHANT_RULES = [
  [["AMAZON", "AMZN"], "amazon"],
  [["WALMART", "WAL-MART", "WM SUPERCENTER"], "walmart"],
  [["COSTCO"], "costco"],
  [["TARGET"], "target"],
  [["UBER EATS", "DOORDASH", "GRUBHUB", "MCDONALD", "CHIPOTLE", "STARBUCKS", "RESTAURANT", "PIZZA"], "restaurantes"],
  [["UBER", "LYFT"], "transporte"],
  [["SHELL", "CHEVRON", "EXXON", "MOBIL", "GAS STATION", "CIRCLE K", "CITGO", "CONOCOPHILLIPS"], "gasolina"],
  [["KROGER", "SAFEWAY", "PUBLIX", "ALDI", "TRADER JOE", "WHOLE FOODS", "H-E-B", "HEB", "SUPERMARKET", "GROCERY"], "supermercado"],
  [["CVS", "WALGREENS", "PHARMACY", "RITE AID"], "farmacia"],
  [["GEICO", "PROGRESSIVE", "STATE FARM", "ALLSTATE", "INSURANCE"], "seguros"],
  [["MORTGAGE", "RENT PAYMENT", "APARTMENTS", "PROPERTY MGMT"], "hipoteca_renta"],
  [["ELECTRIC", "POWER CO", "ENERGY"], "electricidad"],
  [["WATER DEPT", "WATER UTILITY", "WATER CO"], "agua"],
  [["COMCAST", "XFINITY", "SPECTRUM", "AT&T INTERNET", "FIBER"], "internet"],
  [["VERIZON", "T-MOBILE", "TMOBILE", "AT&T", "CRICKET", "BOOST MOBILE"], "telefono"],
  [["NETFLIX", "HULU", "DISNEY+", "DISNEY PLUS", "HBO", "PARAMOUNT+", "PEACOCK"], "streaming"],
  [["SPOTIFY", "APPLE.COM/BILL", "APPLE MUSIC", "GOOGLE *", "YOUTUBE PREMIUM", "AMAZON PRIME"], "suscripciones"],
  [["HOME DEPOT", "LOWE'S", "LOWES"], "compras"],
  [["PAYPAL"], "transferencias"],
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
