"use strict";

function parseISODate(s) { if (!s) return null; const d = new Date(s + "T00:00:00"); return isNaN(d) ? null : d; }

function occurrenciasSemana(dia) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) { if (new Date(year, month, d).getDay() === dia) count++; }
  return count;
}

function semanaOcurrenciasEsteMes() {
  const last = parseISODate(state.ultimoPago);
  if (!last) return 0;
  return occurrenciasSemana(last.getDay());
}

function ingresosEsteMes() {
  const mk = monthKey();
  return state.ingresosLog.filter((x) => x.month === mk);
}

function expectedPagosEsteMes() {
  if (state.payFrequency === "quincenal") return 2;
  if (state.payFrequency === "semanal") { const n = semanaOcurrenciasEsteMes(); return n > 0 ? n : 4; }
  return 1;
}

function ingresoActivo() {
  if (state.payFrequency === "mensual") return toNum(state.ingreso);
  return ingresosEsteMes().reduce((a, x) => a + toNum(x.monto), 0);
}

function proximosPagos() {
  const items = [];
  state.loans.forEach((l) => {
    if (toNum(l.saldoTotal) <= 0 || toNum(l.montoPago) <= 0) return;
    const np = nextGenericPayInfo(l.ultimoPago, l.frecuencia);
    if (np) items.push({ nombre: l.nombre || t("loanNombrePh"), monto: toNum(l.montoPago), fecha: np.date, diffDays: np.diffDays });
  });
  cloudCreditCards().forEach((c) => {
    if (c.liab_fecha_limite) {
      const d = new Date(c.liab_fecha_limite);
      const now = new Date(); now.setHours(0, 0, 0, 0);
      items.push({ nombre: c.name || t("cardNombrePh"), monto: toNum(c.liab_pago_minimo) || toNum(c.balance_current), fecha: d, diffDays: Math.round((d - now) / 86400000) });
    }
  });
  items.sort((a, b) => a.fecha - b.fecha);
  return items;
}

function agruparPorMes(transacciones) {
  const grupos = {};
  transacciones.forEach((tx) => {
    const mk = String(tx.fecha).slice(0, 7);
    if (!grupos[mk]) grupos[mk] = [];
    grupos[mk].push(tx);
  });
  return Object.keys(grupos).sort((a, b) => (a < b ? 1 : -1)).map((mk) => ({ monthKey: mk, label: monthLabel(mk), items: grupos[mk] }));
}

function nextGenericPayInfo(ultimoPagoStr, frecuencia) {
  const last = parseISODate(ultimoPagoStr);
  if (!last) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let next = new Date(last);
  if (frecuencia === "mensual") {
    while (next < now) next.setMonth(next.getMonth() + 1);
  } else {
    const interval = frecuencia === "semanal" ? 7 : 15;
    while (next < now) next.setDate(next.getDate() + interval);
  }
  const diffDays = Math.round((next - now) / 86400000);
  return { date: next, diffDays };
}

function nextPayInfo() {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const ajuste = parseISODate(state.proximoPagoAjuste);
  if (ajuste && ajuste >= now) {
    return { date: ajuste, diffDays: Math.round((ajuste - now) / 86400000), ajustado: true };
  }
  return nextGenericPayInfo(state.ultimoPago, state.payFrequency);
}

function formatDate(d) { return d.toLocaleDateString(LANG === "es" ? "es-ES" : "en-US", { day: "numeric", month: "short" }); }

function diasLabel(n) { if (n === 0) return t("hoy"); if (n === 1) return t("manana"); return t("enDias")(n); }

function cloudCreditCards() {
  return state.cloudAccounts.filter((a) => a.type === "credit");
}

function computeTotals() {
  const ingresoEfectivo = ingresoActivo();
  const totalSubs = state.subs.reduce((a, s) => a + toNum(s.monto), 0);
  const cloudCards = cloudCreditCards();
  const totalMinimosCloud = cloudCards.reduce((a, c) => { const liab = c.liab_apr != null || c.liab_pago_minimo != null ? { apr: c.liab_apr, pago_minimo: c.liab_pago_minimo } : null; return a + (liab && liab.pago_minimo ? toNum(liab.pago_minimo) : 0); }, 0);
  const totalMinimos = state.cards.reduce((a, c) => a + toNum(c.minimo), 0) + totalMinimosCloud;
  const totalPrestamos = state.loans.reduce((a, l) => a + (toNum(l.saldoTotal) > 0 ? toNum(l.montoPago) : 0), 0);
  const totalDeudaCloud = cloudCards.reduce((a, c) => a + toNum(c.balance_current), 0);
  const totalDeuda = state.cards.reduce((a, c) => a + toNum(c.saldo), 0) + totalDeudaCloud;
  const cardsConLimite = state.cards.filter((c) => toNum(c.limite) > 0);
  const cloudCardsConLimite = cloudCards.filter((c) => toNum(c.balance_limit) > 0);
  const creditoDisponible = cardsConLimite.reduce((a, c) => a + Math.max(toNum(c.limite) - toNum(c.saldo), 0), 0)
    + cloudCardsConLimite.reduce((a, c) => a + Math.max(toNum(c.balance_limit) - toNum(c.balance_current), 0), 0);
  const disponibleBruto = ingresoEfectivo - totalSubs - totalPrestamos;
  const ratioComprometido = ingresoEfectivo > 0 ? (totalSubs + totalPrestamos + totalMinimos) / ingresoEfectivo : (totalSubs + totalPrestamos + totalMinimos > 0 ? 1.5 : 0);
  const insuficienteLive = disponibleBruto - totalMinimos < 0;
  const liveStatus = statusFromRatio(ratioComprometido, insuficienteLive);
  return { ingresoEfectivo, totalSubs, totalMinimos, totalPrestamos, totalDeuda, cardsConLimite, cloudCardsConLimite, creditoDisponible, disponibleBruto, ratioComprometido, liveStatus };
}

function computeResultado(t2) {
  const restoTrasMinimos = t2.disponibleBruto - t2.totalMinimos;
  if (restoTrasMinimos < 0) return { insuficiente: true, faltante: Math.abs(restoTrasMinimos) };

  let effectiveRate = state.savingsRate;
  if (state.objetivo === "ahorro") effectiveRate = 100;
  else if (state.objetivo === "credito") effectiveRate = 0;

  const ahorroCrudo = restoTrasMinimos * (effectiveRate / 100);
  const ahorro = Math.round(ahorroCrudo / 10) * 10;
  let extraParaTarjetas = Math.round((restoTrasMinimos - ahorro) * 100) / 100;
  if (extraParaTarjetas < 0) extraParaTarjetas = 0;

  const ordenBase = state.cards
    .map((c) => ({ ...c, saldo: toNum(c.saldo), apr: toNum(c.apr), minimo: toNum(c.minimo), limite: toNum(c.limite) }))
    .filter((c) => c.saldo > 0 || c.minimo > 0 || c.nombre);
  const ordenAvalancha = state.objetivo === "credito"
    ? ordenBase.sort((a, b) => (b.limite > 0 ? b.saldo / b.limite : b.apr / 100) - (a.limite > 0 ? a.saldo / a.limite : a.apr / 100))
    : ordenBase.sort((a, b) => b.apr - a.apr);

  let restante = extraParaTarjetas;
  const asignaciones = ordenAvalancha.map((c) => {
    const espacio = Math.max(c.saldo - c.minimo, 0);
    const pagoExtra = Math.min(restante, espacio);
    restante = Math.round((restante - pagoExtra) * 100) / 100;
    return Object.assign({}, c, { pagoExtra, pagoTotal: Math.round((c.minimo + pagoExtra) * 100) / 100 });
  });
  const ahorroFinal = Math.round((ahorro + restante) / 10) * 10;
  return { insuficiente: false, ahorro: ahorroFinal, asignaciones };
}
