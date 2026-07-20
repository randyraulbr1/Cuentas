"use strict";

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
  return normalizeMerchant(desc).split(" ").slice(0, 3).join(" ");
}
function guessCategory(desc, monto, learnedMap) {
  const norm = normalizeMerchant(desc);
  const key = merchantKey(desc);
  if (learnedMap && learnedMap[key]) return learnedMap[key];
  for (const [keywords, cat] of DEFAULT_MERCHANT_RULES) {
    if (keywords.some((kw) => norm.indexOf(kw) !== -1)) return cat;
  }
  if (Number(monto) > 0) return "depositos";
  return "otros";
}

module.exports = { guessCategory, merchantKey, normalizeMerchant };
