"use strict";

function ingresoTrabajoParaFecha(fechaStr) {
  return state.turnos.filter((tn) => tn.fecha === fechaStr).reduce((a, tn) => a + turnoPagoBruto(tn).bruto, 0);
}

function buildCashflowBuckets(period) {
  const now = new Date(); now.setHours(23, 59, 59, 999);
  const events = [];

  state.cloudTransactions.forEach((tx, index) => {
    const rawDate = String(tx.fecha_hora || tx.datetime || tx.fecha || "");
    const dateKey = rawDate.slice(0, 10);
    if (!dateKey) return;
    const hasTime = rawDate.indexOf("T") !== -1;
    const when = new Date(hasTime ? rawDate : dateKey + "T12:00:00");
    if (!isFinite(when.getTime()) || when > now) return;
    const amount = toNum(tx.monto);
    if (!amount) return;
    events.push({
      when, amount, value: Math.abs(amount), type: amount > 0 ? "income" : "expense",
      description: tx.descripcion || tx.merchant_name || "", index
    });
  });

  const turnoIngresoPorFecha = {};
  state.turnos.forEach((tn) => {
    const bruto = turnoPagoBruto(tn).bruto;
    if (bruto > 0) turnoIngresoPorFecha[tn.fecha] = (turnoIngresoPorFecha[tn.fecha] || 0) + bruto;
  });
  Object.keys(turnoIngresoPorFecha).forEach((fecha, i) => {
    const when = new Date(fecha + "T18:00:00");
    if (when > now) return;
    events.push({ when, amount: turnoIngresoPorFecha[fecha], value: turnoIngresoPorFecha[fecha], type: "income", description: LANG === "es" ? "Trabajo" : "Work", index: 100000 + i });
  });

  events.sort((x, y) => x.when - y.when || x.index - y.index);

  let filtered = events;
  if (period === "week") {
    const anchor = events.length ? events[events.length - 1].when : now;
    const day = anchor.getDay();
    const weekStart = new Date(anchor); weekStart.setDate(anchor.getDate() - (day === 0 ? 6 : day - 1)); weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
    filtered = events.filter((event) => event.when >= weekStart && event.when < weekEnd);
  } else if (period === "day") {
    const anchor = events.length ? events[events.length - 1].when : now;
    const selectedDay = dateKeyOf(anchor);
    filtered = events.filter((event) => dateKeyOf(event.when) === selectedDay);
  }
  // period === "month" (o cualquier otro valor): usa TODO el historial disponible, sin recortar por mes.

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
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const currentMonth = monthKey();
  const unpaid = state.subs.filter((sub) => sub.pagadoMes !== currentMonth).map((sub) => {
    const day = Math.min(Math.max(parseInt(sub.diaPago, 10) || 1, 1), 31);
    const due = new Date(today.getFullYear(), today.getMonth(), day);
    return { sub, due, amount: Math.max(toNum(sub.monto), 0), days: Math.ceil((due - today) / 86400000) };
  }).sort((a, b) => a.due - b.due);
  const advice = [];
  const unpaidTotal = unpaid.reduce((sum, item) => sum + item.amount, 0);
  const available = Math.max(toNum(state.debito) + toNum(state.ahorroActual), 0);

  const overdue = unpaid.filter((item) => item.days < 0);
  if (overdue.length) {
    const total = overdue.reduce((sum, item) => sum + item.amount, 0);
    advice.push({ level: "urgent", text: (LANG === "es" ? "Tienes " : "You have ") + overdue.length + (LANG === "es" ? " pago(s) vencido(s) por " : " overdue payment(s) totaling ") + sym() + fmt0(total) + "." });
  }

  const next3 = unpaid.filter((item) => item.days >= 0).slice(0, 3);
  next3.forEach((item) => {
    const name = item.sub.nombre || (LANG === "es" ? "Próximo pago" : "Next payment");
    const when = item.days === 0 ? (LANG === "es" ? "vence hoy" : "is due today") : item.days === 1 ? (LANG === "es" ? "vence mañana" : "is due tomorrow") : (LANG === "es" ? "vence en " + item.days + " días" : "is due in " + item.days + " days");
    advice.push({ level: item.days <= 2 ? "urgent" : "priority", text: name + ": " + sym() + fmt0(item.amount) + ", " + when + "." });
  });

  if (unpaidTotal > 0) {
    const gap = unpaidTotal - available;
    if (gap > 0) {
      advice.push({ level: "urgent", text: (LANG === "es" ? "Te faltan " : "You still need ") + sym() + fmt0(gap) + (LANG === "es" ? " para completar todos los pagos pendientes de este mes." : " to cover all remaining payments this month.") });
    }
  }

  const cards = state.cloudAccounts.filter((account) => account.type === "credit" && toNum(account.balance_current) > 0);
  const cardsDebt = cards.reduce((sum, card) => sum + toNum(card.balance_current), 0);
  if (cardsDebt > 0) {
    cards.forEach((card) => {
      const balance = toNum(card.balance_current);
      const limit = Math.max(toNum(card.balance_limit), 0);
      const util = limit > 0 ? balance / limit * 100 : null;
      if (util !== null && util >= 90) {
        advice.push({ level: "blink", text: (LANG === "es" ? "\u00a1" + (card.name || "Tarjeta") + " est\u00e1 casi al tope (" + Math.round(util) + "%)! Paga " + sym() + fmt0(balance - limit * 0.3) + " ahora para no quemarla." : (card.name || "Card") + " is almost maxed out (" + Math.round(util) + "%)! Pay " + sym() + fmt0(balance - limit * 0.3) + " now before it maxes out.") });
      }
    });
    const cardSug = cards.map((card) => {
      const balance = toNum(card.balance_current);
      const apr = Math.max(toNum(card.liab_apr), 0);
      const minimo = Math.max(toNum(card.liab_pago_minimo), 0);
      const interesMes = apr > 0 ? balance * apr / 1200 : 0;
      const sugerido = Math.max(minimo, interesMes + balance / 36, balance * 0.03);
      return { nombre: card.name || (LANG === "es" ? "Tarjeta" : "Card"), sugerido };
    }).sort((a, b) => b.sugerido - a.sugerido).slice(0, 3);
    cardSug.forEach((c) => {
      advice.push({ level: "credit", text: (LANG === "es" ? "Paga " : "Pay ") + sym() + fmt0(c.sugerido) + (LANG === "es" ? " de " + c.nombre + " este mes." : " on " + c.nombre + " this month.") });
    });
  }

  if (advice.length === 0) {
    advice.push({ level: "safe", text: LANG === "es" ? "Todos los pagos fijos de este mes están marcados como pagados." : "All fixed payments for this month are marked paid." });
  }
  return advice.slice(0, 9);
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
    .filter(({ txs }) => {
      if (state.suscripcionesIgnoradas && state.suscripcionesIgnoradas.indexOf(merchantKey(txs[0].merchant_name || txs[0].descripcion || "")) !== -1) return false;
      if (txs.length < 2) return false;
      const categoriasRecurrentes = ["suscripciones", "streaming", "gym", "telefono", "wifi", "entretenimiento"];
      const nombre = String(txs[0].descripcion || "").toLowerCase();
      const palabras = ["netflix", "hulu", "spotify", "disney", "amazon prime", "openai", "chatgpt", "adobe", "apple.com/bill", "google", "gym", "fitness", "internet", "wireless"];
      const montos = txs.map((t) => Math.abs(toNum(t.monto))).filter((v) => v > 0);
      const promedio = montos.reduce((a, v) => a + v, 0) / Math.max(montos.length, 1);
      const variacion = promedio > 0 ? Math.max.apply(null, montos.map((v) => Math.abs(v - promedio) / promedio)) : 1;
      return categoriasRecurrentes.indexOf(txs[0].categoria) !== -1 || palabras.some((p) => nombre.indexOf(p) !== -1) || (txs.length >= 3 && variacion <= 0.12);
    })
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

  const añadidas = state.subs || [];
  const suscripcionesAutoDisponibles = suscripcionesAuto.filter((s) => !añadidas.some((sub) => String(sub.merchantKey || "") === String(s.key)));
  const suscripcionesDetectadas = suscripcionesAutoDisponibles.concat(suscripcionesManualesCalc).sort((a, b) => a.proxima - b.proxima);

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
