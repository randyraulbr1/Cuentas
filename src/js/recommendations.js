"use strict";

function ingresoTrabajoParaFecha(fechaStr) {
  return state.turnos.filter((tn) => tn.fecha === fechaStr).reduce((a, tn) => a + turnoPagoBruto(tn).bruto, 0);
}

function buildCashflowBuckets(period, monthOffset) {
  monthOffset = Math.max(parseInt(monthOffset, 10) || 0, 0);
  const today = new Date(); today.setHours(23, 59, 59, 999);
  const monthStart = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
  const effectiveEnd = monthOffset === 0 ? today : monthEnd;
  const events = [];

  state.cloudTransactions.forEach((tx, index) => {
    const rawDate = String(tx.fecha_hora || tx.datetime || tx.fecha || "");
    const dateKey = rawDate.slice(0, 10);
    if (!dateKey) return;
    const hasTime = rawDate.indexOf("T") !== -1;
    const when = new Date(hasTime ? rawDate : dateKey + "T12:00:00");
    if (!isFinite(when.getTime()) || when < monthStart || when > effectiveEnd) return;
    const amount = toNum(tx.monto);
    if (!amount) return;
    events.push({
      when, amount, value: Math.abs(amount), type: amount > 0 ? "income" : "expense",
      description: tx.descripcion || tx.merchant_name || "", index
    });
  });
  for (let cursor = new Date(monthStart); cursor <= effectiveEnd; cursor.setDate(cursor.getDate() + 1)) {
    const earned = ingresoTrabajoParaFecha(dateKeyOf(cursor));
    if (earned > 0) {
      const when = new Date(cursor); when.setHours(18, 0, 0, 0);
      events.push({ when, amount: earned, value: earned, type: "income", description: LANG === "es" ? "Trabajo" : "Work", index: 100000 + events.length });
    }
  }
  events.sort((x, y) => x.when - y.when || x.index - y.index);

  let filtered = events;
  if (period === "week") {
    const anchor = events.length ? events[events.length - 1].when : effectiveEnd;
    const day = anchor.getDay();
    const weekStart = new Date(anchor); weekStart.setDate(anchor.getDate() - (day === 0 ? 6 : day - 1)); weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
    filtered = events.filter((event) => event.when >= weekStart && event.when < weekEnd);
  } else if (period === "day") {
    const anchor = events.length ? events[events.length - 1].when : effectiveEnd;
    const selectedDay = dateKeyOf(anchor);
    filtered = events.filter((event) => dateKeyOf(event.when) === selectedDay);
  }

  let running = 0;
  return filtered.map((event) => {
    const open = running;
    const close = running + event.amount;
    running = close;
    let label;
    if (period === "day") {
      const hasRealTime = String(event.when.toISOString()).slice(11, 16) !== "12:00";
      label = hasRealTime ? event.when.toLocaleTimeString(LANG === "es" ? "es-ES" : "en-US", { hour: "2-digit", minute: "2-digit" }) : String(event.when.getDate());
    } else {
      label = String(event.when.getDate()) + "/" + String(event.when.getMonth() + 1);
    }
    return {
      etiqueta: label, open, close, high: Math.max(open, close), low: Math.min(open, close),
      ingresos: event.type === "income" ? event.value : 0,
      gastos: event.type === "expense" ? event.value : 0,
      tipo: event.type, valor: event.value, descripcion: event.description,
      rangeStart: dateKeyOf(event.when), rangeEnd: dateKeyOf(event.when)
    };
  });
}

function computeSmartAdvice() {
  const cash = Math.max(toNum(state.ahorroActual) + toNum(state.debito), 0);
  const income = Math.max(toNum(state.ingreso), 0);
  const reserve = Math.max(200, Math.min(1000, income > 0 ? income * 0.10 : 300));
  const unpaid = state.subs.filter((sub) => sub.pagadoMes !== monthKey());
  const unpaidTotal = unpaid.reduce((sum, sub) => sum + Math.max(toNum(sub.monto), 0), 0);
  const available = Math.max(cash - reserve, 0);
  const creditCards = state.cloudAccounts.filter((account) => account.type === "credit" && toNum(account.balance_current) > 0)
    .sort((x, y) => toNum(y.liab_apr) - toNum(x.liab_apr));
  const advice = [];

  if (unpaidTotal > 0) {
    if (available < unpaidTotal) advice.push({ level: "urgent", text: (LANG === "es" ? "Te faltan " : "You need ") + sym() + fmt0(unpaidTotal - available) + (LANG === "es" ? " para cubrir los pagos pendientes del mes sin tocar tu reserva." : " to cover this month's pending bills without using your reserve.") });
    else advice.push({ level: "priority", text: (LANG === "es" ? "Aparta " : "Set aside ") + sym() + fmt0(unpaidTotal) + (LANG === "es" ? " para renta y pagos pendientes antes de pagar deuda extra." : " for rent and pending bills before making extra debt payments.") });
  }
  if (cash <= reserve) advice.push({ level: "urgent", text: LANG === "es" ? "Pausa gastos no esenciales este mes; estás en el mínimo de dinero disponible." : "Pause non-essential spending this month; you are at your minimum cash level." });
  else advice.push({ level: "safe", text: (LANG === "es" ? "Mantén al menos " : "Keep at least ") + sym() + fmt0(reserve) + (LANG === "es" ? " disponibles para imprevistos." : " available for unexpected costs.") });

  if (creditCards.length && available > unpaidTotal) {
    const card = creditCards[0];
    const extraCapacity = Math.max(available - unpaidTotal, 0);
    const suggested = Math.min(Math.max(toNum(card.liab_pago_minimo), Math.min(extraCapacity, Math.max(25, toNum(card.balance_current) * 0.05))), extraCapacity);
    if (suggested > 0) advice.push({ level: "credit", text: (LANG === "es" ? "Después de cubrir el mes, paga " : "After covering this month, pay ") + sym() + fmt0(suggested) + (LANG === "es" ? " a " : " to ") + (card.name || (LANG === "es" ? "la tarjeta con mayor interés" : "the highest-interest card")) + (card.liab_apr ? " (" + card.liab_apr + "% APR)." : ".") });
  }
  if (state.objetivo === "ahorro" && available > unpaidTotal) advice.push({ level: "save", text: (LANG === "es" ? "Puedes mover hasta " : "You can move up to ") + sym() + fmt0(Math.max(available - unpaidTotal, 0)) + (LANG === "es" ? " al ahorro sin quedarte sin efectivo." : " to savings without running out of cash.") });
  if (state.objetivo === "equilibrado" && !unpaidTotal && available > reserve) advice.push({ level: "safe", text: LANG === "es" ? "Divide el dinero libre entre ahorro y la tarjeta con mayor APR; no aceleres deudas largas todavía." : "Split free cash between savings and the highest-APR card; do not accelerate long-term debt yet." });
  return advice.slice(0, 4);
}

function computeInsights() {
  const now = new Date();
  const mesActualKey = monthKey();
  const mesAnteriorDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mesAnteriorKey = mesAnteriorDate.getFullYear() + "-" + String(mesAnteriorDate.getMonth() + 1).padStart(2, "0");

  function txMonthKey(fecha) { return String(fecha || "").slice(0, 7); }

  const gastosMesActual = state.cloudTransactions.filter((tx) => txMonthKey(tx.fecha) === mesActualKey && toNum(tx.monto) < 0);
  const gastosMesAnterior = state.cloudTransactions.filter((tx) => txMonthKey(tx.fecha) === mesAnteriorKey && toNum(tx.monto) < 0);
  const totalActual = gastosMesActual.reduce((a, tx) => a + Math.abs(toNum(tx.monto)), 0);
  const totalAnterior = gastosMesAnterior.reduce((a, tx) => a + Math.abs(toNum(tx.monto)), 0);
  const cambioPct = totalAnterior > 0 ? ((totalActual - totalAnterior) / totalAnterior) * 100 : null;

  const porCategoria = {};
  gastosMesActual.forEach((tx) => { const c = tx.categoria || "otros"; porCategoria[c] = (porCategoria[c] || 0) + Math.abs(toNum(tx.monto)); });
  let topCategoria = null, topMonto = 0;
  Object.keys(porCategoria).forEach((c) => { if (porCategoria[c] > topMonto) { topMonto = porCategoria[c]; topCategoria = c; } });

  const porComercio = {};
  state.cloudTransactions.forEach((tx) => {
    if (toNum(tx.monto) >= 0) return;
    const key = merchantKey(tx.descripcion);
    if (!porComercio[key]) porComercio[key] = [];
    porComercio[key].push(tx);
  });
  const FREQ_DIAS = { semanal: 7, quincenal: 15, mensual: 30, trimestral: 90, anual: 365 };
  function inferirFrecuencia(fechas) {
    const ordenadas = fechas.map((f) => new Date(f)).sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < ordenadas.length; i++) gaps.push((ordenadas[i] - ordenadas[i - 1]) / 86400000);
    const avg = gaps.reduce((a, g) => a + g, 0) / gaps.length;
    if (avg <= 10) return "semanal";
    if (avg <= 20) return "quincenal";
    if (avg <= 50) return "mensual";
    if (avg <= 150) return "trimestral";
    return "anual";
  }

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const suscripcionesAuto = Object.keys(porComercio)
    .map((k) => ({ key: k, txs: porComercio[k] }))
    .filter(({ txs }) => txs.length >= 2 && (txs[0].categoria === "suscripciones" || txs[0].categoria === "streaming"))
    .map(({ key, txs }) => {
      const ordenadas = txs.slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      const ultimaFecha = ordenadas[0].fecha;
      const frecuencia = state.suscripcionesFrecuencia[key] || inferirFrecuencia(txs.map((t) => t.fecha));
      const intervalo = FREQ_DIAS[frecuencia] || 30;
      const proxima = new Date(ultimaFecha); proxima.setDate(proxima.getDate() + intervalo);
      const diasFaltan = Math.round((proxima - hoy) / 86400000);
      return { key: key, origen: "auto", nombre: ordenadas[0].descripcion, monto: Math.abs(toNum(ordenadas[0].monto)), frecuencia, proxima, diasFaltan, cancelada: state.suscripcionesCanceladas.indexOf(key) !== -1 };
    });

  const suscripcionesManualesCalc = state.suscripcionesManuales.map((s) => {
    const intervalo = FREQ_DIAS[s.frecuencia] || 30;
    const proxima = new Date(s.ultimaFecha || new Date()); proxima.setDate(proxima.getDate() + intervalo);
    const diasFaltan = Math.round((proxima - hoy) / 86400000);
    return { key: s.id, origen: "manual", id: s.id, nombre: s.nombre, monto: toNum(s.monto), frecuencia: s.frecuencia, proxima, diasFaltan, cancelada: state.suscripcionesCanceladas.indexOf(s.id) !== -1 };
  });

  const suscripcionesDetectadas = suscripcionesAuto.concat(suscripcionesManualesCalc).sort((a, b) => a.proxima - b.proxima);

  const suscripcionesTotalMensual = suscripcionesDetectadas
    .filter((s) => !s.cancelada)
    .reduce((a, s) => {
      const factor = { semanal: 52 / 12, quincenal: 26 / 12, mensual: 1, trimestral: 1 / 3, anual: 1 / 12 }[s.frecuencia] || 1;
      return a + s.monto * factor;
    }, 0);

  const tendenciaMeses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const total = state.cloudTransactions.filter((tx) => txMonthKey(tx.fecha) === key && toNum(tx.monto) < 0).reduce((a, tx) => a + Math.abs(toNum(tx.monto)), 0);
    tendenciaMeses.push({ etiqueta: (LANG === "es" ? MESES_ES : MESES_EN)[d.getMonth()].slice(0, 3), valor: total, monthKey: key });
  }
  const categoriasOrdenadas = Object.keys(porCategoria).sort((a, b) => porCategoria[b] - porCategoria[a]).slice(0, 6).map((c) => ({ etiqueta: t("cat_" + c), valor: porCategoria[c], categoria: c }));

  return { totalActual, totalAnterior, cambioPct, topCategoria, topMonto, suscripcionesDetectadas, suscripcionesTotalMensual, tendenciaMeses, categoriasOrdenadas };
}

function comparaConPromedioCategoria(tx) {
  if (!tx.categoria || toNum(tx.monto) >= 0) return null;
  const mismos = state.cloudTransactions.filter((t) => t.categoria === tx.categoria && toNum(t.monto) < 0 && t.id !== tx.id);
  if (mismos.length < 2) return null;
  const promedio = mismos.reduce((a, t) => a + Math.abs(toNum(t.monto)), 0) / mismos.length;
  if (promedio <= 0) return null;
  const pct = ((Math.abs(toNum(tx.monto)) - promedio) / promedio) * 100;
  return { promedio, pct };
}

function buildSugerencias(t2, resultado) {
  const s = [];
  const r = resultado;
  if (!r) return s;
  if (state.payFrequency !== "mensual") {
    const logged = ingresosEsteMes().length;
    const esperados = expectedPagosEsteMes();
    if (logged < esperados) s.push(t("pagosIncompletos"));
  }
  if (r.insuficiente) {
    s.push(t("faltan") + " " + sym() + fmt0(r.faltante) + ".");
    const debito = toNum(state.debito);
    const ahorro = toNum(state.ahorroActual);
    const completos = pagosCompletosEsteMes();
    if (!completos) s.push(t("esperaAntesDeUsar"));
    else if (debito >= r.faltante) s.push(t("usaDebito")(fmt0(r.faltante)));
    else if (debito > 0 && debito + ahorro >= r.faltante) s.push(t("usaDebitoYAhorro")(fmt0(debito), fmt0(r.faltante - debito)));
    else if (ahorro > 0) s.push(t("usaAhorro")(fmt0(ahorro)));
    else s.push(t("sinAhorroRecorta"));
  } else {
    const conExtra = r.asignaciones.filter((c) => c.pagoExtra > 0);
    const prioridad = conExtra[0] || r.asignaciones[0];
    if (prioridad) {
      if (prioridad.pagoExtra > 0) {
        const fuente = toNum(state.debito) >= prioridad.pagoTotal ? t("fuenteDebito") : t("fuenteIngreso");
        s.push(t("pagaPrimeroExtra")(prioridad.nombre || t("tarjetaFallback"), fmt0(prioridad.apr), fmt0(prioridad.pagoTotal)) + " " + fuente);
      } else s.push(t("pagaPrimeroSinExtra")(prioridad.nombre || t("tarjetaFallback"), fmt0(prioridad.apr)));
    }
    if (t2.liveStatus.key === "verde") s.push(t("vaBien"));
    else if (t2.liveStatus.key === "amarillo") s.push(t("vasAjustado"));
    else s.push(t("mesApretado"));
    if (toNum(state.metaAhorro) > 0) {
      const falta = toNum(state.metaAhorro) - toNum(state.ahorroActual);
      if (falta <= 0) s.push(t("metaCumplida")(fmt0(toNum(state.metaAhorro))));
      else if (r.ahorro > 0) s.push(t("ritmoMeta")(fmt0(r.ahorro), fmt0(toNum(state.metaAhorro)), Math.ceil(falta / r.ahorro)));
      else s.push(t("sinAhorroMeta"));
    }
  }
  const np = nextPayInfo();
  if (np && np.diffDays > 0 && np.diffDays <= 14) s.push(t("proximoPagoSug")(np.diffDays));
  return s;
}

function pagosCompletosEsteMes() {
  if (state.payFrequency === "mensual") return true;
  return ingresosEsteMes().length >= expectedPagosEsteMes();
}

function computeTopAction(t2, resultado) {
  if (t2.ingresoEfectivo <= 0) return null;
  const faltante = t2.totalMinimos - t2.disponibleBruto;
  if (faltante > 0) {
    const debito = toNum(state.debito);
    if (debito >= faltante) {
      if (!pagosCompletosEsteMes()) return { level: "amarillo", text: t("topEsperaPago") };
      return { level: "amarillo", text: t("topUsaDebito")(fmt0(faltante)) };
    }
    return { level: "rojo", text: t("topFaltante")(fmt0(faltante)) };
  }
  const sobreLimite = t2.cardsConLimite
    .map((c) => ({ nombre: c.nombre, uso: (toNum(c.saldo) / toNum(c.limite)) * 100, monto: Math.max(toNum(c.saldo) - toNum(c.limite) * 0.3, 0) }))
    .filter((c) => c.monto > 0)
    .sort((a, b) => b.uso - a.uso);
  if (sobreLimite.length > 0 && (state.objetivo === "credito" || sobreLimite[0].uso >= 70)) {
    const top = sobreLimite[0];
    return { level: top.uso >= 70 ? "rojo" : "amarillo", text: t("topCuidarCredito")(top.nombre || t("tarjetaFallback"), fmt0(top.monto)) };
  }
  if (t2.liveStatus.key !== "verde" && resultado && !resultado.insuficiente) {
    const conExtra = resultado.asignaciones.filter((c) => c.pagoExtra > 0);
    const top = conExtra[0] || resultado.asignaciones[0];
    if (top && top.pagoTotal > 0) return { level: t2.liveStatus.key, text: t("topPrioriza")(top.nombre || t("tarjetaFallback"), fmt0(top.pagoTotal)) };
  }
  return null;
}


function computeResumenSemanal() {
  if (!state.cloudTransactions || state.cloudTransactions.length === 0) return null;
  const hoy = new Date();
  const dia = (hoy.getDay() + 6) % 7; // lunes = 0
  const iniSemana = new Date(hoy); iniSemana.setDate(hoy.getDate() - dia); iniSemana.setHours(0, 0, 0, 0);
  const iniPrev = new Date(iniSemana); iniPrev.setDate(iniSemana.getDate() - 7);
  const key = (d) => d.toISOString().slice(0, 10);
  const kIni = key(iniSemana), kPrev = key(iniPrev);
  const dias = [0, 0, 0, 0, 0, 0, 0];
  let total = 0, prev = 0;
  const porCat = {};
  state.cloudTransactions.forEach((tx) => {
    const m = toNum(tx.monto);
    if (m >= 0) return;
    const f = String(tx.fecha).slice(0, 10);
    if (f >= kIni) {
      const gasto = Math.abs(m);
      total += gasto;
      const d = new Date(f + "T12:00:00");
      dias[(d.getDay() + 6) % 7] += gasto;
      const c = tx.categoria || "otros";
      porCat[c] = (porCat[c] || 0) + gasto;
    } else if (f >= kPrev) {
      prev += Math.abs(m);
    }
  });
  if (total === 0 && prev === 0) return null;
  let topCat = null, topMonto = 0;
  Object.keys(porCat).forEach((c) => { if (porCat[c] > topMonto) { topCat = c; topMonto = porCat[c]; } });
  const cambioPct = prev > 0 ? ((total - prev) / prev) * 100 : null;
  const nombresDias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(iniSemana); d.setDate(iniSemana.getDate() + i);
    nombresDias.push(formatDate(d));
  }
  return { total, prev, cambioPct, topCat, topMonto, dias, diaHoy: dia, nombresDias };
}

/* Comercios donde mas gastas este mes, agrupando por nombre normalizado */
function computeTopComercios(limite) {
  if (!state.cloudTransactions || state.cloudTransactions.length === 0) return [];
  const mesActual = new Date().toISOString().slice(0, 7);
  const mapa = {};
  state.cloudTransactions.forEach((tx) => {
    const m = toNum(tx.monto);
    if (m >= 0) return;
    if (String(tx.fecha).slice(0, 7) !== mesActual) return;
    const limpio = String(tx.descripcion || "")
      .replace(/[0-9#*]+/g, " ")
      .replace(/\b(purchase|payment|debit|card|pos|recurring|autopay)\b/gi, " ")
      .replace(/\s+/g, " ").trim();
    const nombre = (limpio || t("cat_otros")).slice(0, 24);
    const k = nombre.toLowerCase();
    if (!mapa[k]) mapa[k] = { nombre: nombre, total: 0, veces: 0, categoria: tx.categoria || "otros" };
    mapa[k].total += Math.abs(m);
    mapa[k].veces += 1;
  });
  return Object.keys(mapa).map((k) => mapa[k]).sort((a, b) => b.total - a.total).slice(0, limite || 5);
}

/* Grupo 50/30/20: a que grupo pertenece cada categoria bancaria y manual.
   Basado en la regla 50/30/20 (necesidades / deseos / ahorro-deuda), el metodo
   de presupuesto mas usado en educacion financiera. */
const GRUPO_5030 = {
  hipoteca_renta: "necesidad", electricidad: "necesidad", agua: "necesidad", internet: "necesidad",
  telefono: "necesidad", seguros: "necesidad", supermercado: "necesidad", farmacia: "necesidad",
  transporte: "necesidad", gasolina: "necesidad", tarjeta_credito: "deuda",
  renta: "necesidad", luz: "necesidad", gas: "necesidad", wifi: "necesidad", carro: "necesidad", seguro: "necesidad", salud: "necesidad",
  restaurantes: "deseo", amazon: "deseo", walmart: "necesidad", costco: "necesidad", target: "deseo",
  streaming: "deseo", suscripciones: "deseo", compras: "deseo", entretenimiento: "deseo", gym: "deseo", otro: "deseo", otros: "deseo",
};

/* Compara el gasto real del mes contra la regla 50/30/20 (50% necesidades, 30% deseos, 20% ahorro/deuda) */
function compute503020() {
  const ingreso = ingresoActivo();
  if (!ingreso || ingreso <= 0) return null;
  const mesActual = new Date().toISOString().slice(0, 7);
  let necesidad = 0, deseo = 0;
  (state.cloudTransactions || []).forEach((tx) => {
    const m = toNum(tx.monto);
    if (m >= 0) return;
    if (String(tx.fecha).slice(0, 7) !== mesActual) return;
    const grupo = GRUPO_5030[tx.categoria] || "deseo";
    if (grupo === "necesidad") necesidad += Math.abs(m);
    else if (grupo === "deseo") deseo += Math.abs(m);
  });
  state.subs.forEach((s) => { necesidad += toNum(s.monto); });
  const ahorroMes = Math.max(ingreso - necesidad - deseo, 0);
  const pctNecesidad = (necesidad / ingreso) * 100;
  const pctDeseo = (deseo / ingreso) * 100;
  const pctAhorro = (ahorroMes / ingreso) * 100;
  return { ingreso, necesidad, deseo, ahorroMes, pctNecesidad, pctDeseo, pctAhorro };
}

/* Fondo de emergencia: estandar de 3 a 6 meses de gastos esenciales cubiertos en efectivo/ahorro liquido */
function computeFondoEmergencia() {
  const r = compute503020();
  const gastoEsencialMensual = r ? r.necesidad : null;
  if (!gastoEsencialMensual || gastoEsencialMensual <= 0) return null;
  const liquido = toNum(state.ahorroActual);
  const mesesCubiertos = liquido / gastoEsencialMensual;
  const metaMeses = 6;
  const metaMonto = gastoEsencialMensual * metaMeses;
  return { liquido, gastoEsencialMensual, mesesCubiertos, metaMeses, metaMonto, faltante: Math.max(metaMonto - liquido, 0) };
}
