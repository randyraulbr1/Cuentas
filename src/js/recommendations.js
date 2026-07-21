"use strict";

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
    tendenciaMeses.push({ etiqueta: (LANG === "es" ? MESES_ES : MESES_EN)[d.getMonth()].slice(0, 3), valor: total });
  }
  const categoriasOrdenadas = Object.keys(porCategoria).sort((a, b) => porCategoria[b] - porCategoria[a]).slice(0, 6).map((c) => ({ etiqueta: t("cat_" + c), valor: porCategoria[c] }));

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
