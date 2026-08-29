"use strict";

let timerHandle = null;

function startTimerLoop() {
  if (timerHandle) return;
  timerHandle = setInterval(() => { checkBreakAlerts(); if (state.activeTab === "trabajo") render(); }, 1000);
}

function stopTimerLoop() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
}

function breakDurationMs(b) {
  if (!b.inicio) return 0;
  const fin = b.fin ? new Date(b.fin) : new Date();
  return Math.max(fin - new Date(b.inicio), 0);
}

function turnoDurationMs(turno, hastaAhora) {
  if (!turno.horaInicio) return 0;
  const fin = turno.horaFin ? new Date(turno.horaFin) : (hastaAhora ? new Date() : new Date(turno.horaInicio));
  let total = Math.max(fin - new Date(turno.horaInicio), 0);
  if (!state.job.descansoPagado) {
    (turno.breaks || []).forEach((b) => { total -= breakDurationMs(b); });
  }
  return Math.max(total, 0);
}

function turnoHoras(turno, hastaAhora) { return turnoDurationMs(turno, hastaAhora) / 3600000; }

function fmtHoras(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return hh + "h " + String(mm).padStart(2, "0") + "m";
}

function fmtCronometro(ms) {
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return hh + ":" + mm + ":" + ss;
}

function fmtBreakMS(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

/* ---------- Alertas de límite de descanso ---------- */
let breakWarned80 = false, breakWarned100 = false, breakLastRepeat = 0;

function resetBreakAlerts() { breakWarned80 = false; breakWarned100 = false; breakLastRepeat = 0; }

function requestWorkNotifPermission() {
  try { if ("Notification" in window) Notification.requestPermission().then(() => render()); } catch (e) {}
}

function notifStatusText() {
  if (!("Notification" in window)) return t("notifUnsupported");
  if (Notification.permission === "granted") return t("notifGranted");
  if (Notification.permission === "denied") return t("notifDenied");
  return t("notifBtnHint");
}

function playWorkBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.18].forEach((delay) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.16);
      o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.18);
    });
  } catch (e) {}
}

function notifyBreak(title, body) {
  if (state.workNotifBanner) clearTimeout(state.workNotifBanner._t);
  state.workNotifBanner = { title: title, body: body };
  render();
  playWorkBeep();
  try { if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body: body }); } catch (e) {}
  clearTimeout(notifyBreak._t);
  notifyBreak._t = setTimeout(() => { state.workNotifBanner = null; render(); }, 5000);
}

function horarioStatusText() {
  const now = new Date();
  const hoyIdx = now.getDay();
  const mananaIdx = (hoyIdx + 1) % 7;
  const trabajaHoy = !!state.job.horarioDias[hoyIdx];
  const trabajaManana = !!state.job.horarioDias[mananaIdx];
  const anyDia = state.job.horarioDias.some((d) => d);
  if (!anyDia) return t("horarioNiHoyNiMananaMsg");
  let msg;
  if (trabajaHoy) {
    const [hh, mm] = String(state.job.horarioInicio || "09:00").split(":").map((x) => parseInt(x, 10) || 0);
    const [hh2, mm2] = String(state.job.horarioFin || "17:00").split(":").map((x) => parseInt(x, 10) || 0);
    const inicio = new Date(now); inicio.setHours(hh, mm, 0, 0);
    const fin = new Date(now); fin.setHours(hh2, mm2, 0, 0);
    if (now >= inicio && now <= fin) msg = t("horarioTrabajandoAhoraMsg");
    else if (now < inicio) msg = t("horarioHoyTrabajasMsg")(state.job.horarioInicio, state.job.horarioFin);
    else msg = t("horarioYaTerminasteMsg");
  } else {
    msg = t("horarioHoyNoTrabajasMsg");
  }
  msg += trabajaManana ? t("horarioMananaSiMsg") : t("horarioMananaNoMsg");
  return msg;
}

function checkHorarioReminder() {
  if (!state.job.horarioRecordar) return;
  const now = new Date();
  if (state.turnoActivo) { checkHorarioSalidaReminder(now); return; }
  const hoy = dateKeyOf(now);
  if (state.job.horarioUltimoRecordatorio === hoy) return;
  if (!state.job.horarioDias[now.getDay()]) return;
  const [hh, mm] = String(state.job.horarioInicio || "09:00").split(":").map((x) => parseInt(x, 10) || 0);
  const scheduled = new Date(now); scheduled.setHours(hh, mm, 0, 0);
  if (now < scheduled) return;
  if (now - scheduled > 3 * 60 * 60 * 1000) return; // no molestar si ya pasaron mas de 3h
  state.job.horarioUltimoRecordatorio = hoy;
  scheduleSave();
  notifyBreak(t("recordatorioHorarioTitle"), t("recordatorioHorarioBody"));
}

function checkHorarioSalidaReminder(now) {
  const hoy = dateKeyOf(now);
  if (state.job.horarioUltimoRecordatorioSalida === hoy) return;
  const [hh2, mm2] = String(state.job.horarioFin || "17:00").split(":").map((x) => parseInt(x, 10) || 0);
  const scheduled = new Date(now); scheduled.setHours(hh2, mm2, 0, 0);
  if (now < scheduled) return;
  if (now - scheduled > 3 * 60 * 60 * 1000) return;
  state.job.horarioUltimoRecordatorioSalida = hoy;
  scheduleSave();
  notifyBreak(t("recordatorioSalidaTitle"), t("recordatorioSalidaBody"));
}

function checkBreakAlerts() {
  const turno = state.turnoActivo;
  if (!turno || !turno.breakActivo) return;
  const limiteMin = toNum(state.job.limiteAlmuerzo) || 30;
  const limiteMs = limiteMin * 60000;
  const elapsedMs = breakDurationMs(turno.breakActivo);
  if (!breakWarned80 && elapsedMs >= limiteMs * 0.8 && elapsedMs < limiteMs) {
    breakWarned80 = true;
    notifyBreak(t("breakWarnTitle"), t("breakWarnBody")(Math.ceil((limiteMs - elapsedMs) / 60000)));
  }
  if (!breakWarned100 && elapsedMs >= limiteMs) {
    breakWarned100 = true; breakLastRepeat = elapsedMs;
    notifyBreak(t("breakLimitTitle"), t("breakLimitBody")(limiteMin));
  } else if (breakWarned100 && (elapsedMs - breakLastRepeat) >= 120000) {
    breakLastRepeat = elapsedMs;
    notifyBreak(t("breakStillTitle"), t("breakStillBody")(fmtBreakMS(elapsedMs)));
  }
}

function updateJobField(field, value) {
  state.job[field] = value;
  scheduleSave(); rerenderPreservingFocus();
}

function empezarTrabajo() {
  pushUndo();
  state.turnoActivo = { id: uid(), horaInicio: new Date().toISOString(), breakActivo: null, breaks: [], propinas: "", bonos: "", notas: "" };
  state.confirmEmpezarBreak = false;
  startTimerLoop();
  scheduleSave(); render();
}

function askEmpezarBreak() { state.confirmEmpezarBreak = true; render(); }
function cancelEmpezarBreak() { state.confirmEmpezarBreak = false; render(); }

function empezarBreak() {
  if (!state.turnoActivo || state.turnoActivo.breakActivo) return;
  state.turnoActivo.breakActivo = { inicio: new Date().toISOString() };
  state.confirmEmpezarBreak = false;
  resetBreakAlerts();
  scheduleSave(); render();
}

function terminarBreak() {
  if (!state.turnoActivo || !state.turnoActivo.breakActivo) return;
  state.turnoActivo.breaks.push({ inicio: state.turnoActivo.breakActivo.inicio, fin: new Date().toISOString() });
  state.turnoActivo.breakActivo = null;
  scheduleSave(); render();
}

function askTerminarTrabajo() { state.confirmTerminarTrabajo = true; render(); }

function cancelTerminarTrabajo() { state.confirmTerminarTrabajo = false; render(); }

function terminarTrabajo() {
  if (!state.turnoActivo) return;
  pushUndo();
  state.confirmEmpezarBreak = false;
  const t = state.turnoActivo;
  if (t.breakActivo) { t.breaks.push({ inicio: t.breakActivo.inicio, fin: new Date().toISOString() }); t.breakActivo = null; }
  t.horaFin = new Date().toISOString();
  t.fecha = t.horaInicio.slice(0, 10);
  t.estado = "trabajado";
  delete t.breakActivo;
  state.turnos.push(t);
  state.turnos.sort((a, b) => (a.horaInicio < b.horaInicio ? 1 : -1));
  state.turnoActivo = null;
  state.confirmTerminarTrabajo = false;
  stopTimerLoop();
  scheduleSave();
  rerenderPreservingFocus();
}

function askDeleteTurno(id) { state.confirmDeleteTurnoId = id; render(); }

function cancelDeleteTurno() { state.confirmDeleteTurnoId = null; render(); }

function removeTurno(id) { pushUndo(); state.turnos = state.turnos.filter((x) => x.id !== id); state.confirmDeleteTurnoId = null; scheduleSave(); rerenderPreservingFocus(); }

function toggleExpandTurno(id) { state.expandedTurnoIds[id] = !state.expandedTurnoIds[id]; render(); }

function turnoPagoBruto(turno) {
  const horas = turnoHoras(turno, false);
  const umbral = toNum(state.job.horasExtraDespues) || Infinity;
  const mult = toNum(state.job.multiplicadorExtra) || 1;
  const normales = Math.min(horas, umbral);
  const extra = Math.max(horas - umbral, 0);
  const pagoHora = toNum(state.job.pagoHora);
  let bruto = normales * pagoHora + extra * pagoHora * mult;
  if (toNum(state.job.pagoDia) > 0) bruto = Math.max(bruto, toNum(state.job.pagoDia));
  bruto += toNum(turno.propinas) + toNum(turno.bonos);
  return { horas, normales, extra, bruto };
}

function turnoPagoNetoEstimado(turno) {
  const { bruto } = turnoPagoBruto(turno);
  const tax = toNum(state.job.impuestoPct);
  return bruto * (1 - tax / 100);
}

function rangoSemana(d) {
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const dow = day.getDay();
  const inicio = new Date(day); inicio.setDate(day.getDate() - dow);
  const fin = new Date(inicio); fin.setDate(inicio.getDate() + 7);
  return { inicio, fin };
}

function totalesPeriodo(desde, hasta) {
  const turnosPeriodo = state.turnos.filter((t) => { const d = new Date(t.horaInicio); return d >= desde && d < hasta; });
  let horas = 0, bruto = 0, neto = 0, extra = 0;
  turnosPeriodo.forEach((t) => {
    const r = turnoPagoBruto(t);
    horas += r.horas; extra += r.extra; bruto += r.bruto; neto += turnoPagoNetoEstimado(t);
  });
  return { horas, extra, bruto, neto, turnos: turnosPeriodo };
}

function totalesSemana() { const { inicio, fin } = rangoSemana(new Date()); return totalesPeriodo(inicio, fin); }

function rangoQuincena(d) {
  const { inicio: inicioSemana } = rangoSemana(d);
  const inicio = new Date(inicioSemana); inicio.setDate(inicio.getDate() - 7);
  const fin = new Date(inicioSemana); fin.setDate(fin.getDate() + 7);
  return { inicio, fin };
}
function totalesQuincena() { const { inicio, fin } = rangoQuincena(new Date()); return totalesPeriodo(inicio, fin); }

function totalesMes() {
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
  const fin = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return totalesPeriodo(inicio, fin);
}

function ganadoEsteMes() { return totalesMes().bruto; }

function ganadoPeriodoDefault() {
  if (state.trabajoPeriodoDefault === "semanal") return totalesSemana().bruto;
  if (state.trabajoPeriodoDefault === "mensual") return ganadoEsteMes();
  return totalesQuincena().bruto;
}

function recibidoEsteMes() {
  const mk = monthKey();
  return state.pagosTrabajo.filter((p) => (p.fecha || "").slice(0, 7) === mk).reduce((a, p) => a + toNum(p.montoNeto), 0);
}

function pendienteDePago() {
  return state.turnos.filter((t) => t.estado !== "pagado").reduce((a, t) => a + turnoPagoNetoEstimado(t), 0);
}

function toggleEditJob() { state.editingJob = !state.editingJob; render(); }

function startAgregarTurno() {
  const hoy = dateKeyOf(new Date());
  state.agregarTurnoForm = { fecha: hoy, horas: "" };
  state.showAgregarTurno = true;
  render();
}
function cancelAgregarTurno() { state.showAgregarTurno = false; render(); }
function confirmAgregarTurno() {
  const f = state.agregarTurnoForm;
  const horas = toNum(f.horas);
  if (!f.fecha || horas <= 0) return;
  pushUndo();
  const inicio = new Date(f.fecha + "T09:00:00");
  const fin = new Date(inicio.getTime() + horas * 3600000);
  state.turnos.push({
    id: uid(), fecha: f.fecha, horaInicio: inicio.toISOString(), horaFin: fin.toISOString(),
    breaks: [], propinas: "", bonos: "", notas: "", estado: "trabajado",
  });
  state.turnos.sort((a, b) => (a.horaInicio < b.horaInicio ? 1 : -1));
  state.showAgregarTurno = false;
  scheduleSave(); render();
}

function setCashflowPeriod(p) { state.cashflowPeriod = p; render(); }

function startPagoTrabajo() {
  state.showPagoTrabajo = true;
  state.pagoTrabajoForm = { fecha: new Date().toISOString().slice(0, 10), montoBruto: "", montoNeto: "", bonos: "", horasExtra: "", descuentos: "", metodo: "", notas: "", turnosSel: {} };
  render();
}

function cancelPagoTrabajo() { state.showPagoTrabajo = false; render(); }

function updatePagoTrabajoField(field, value) { state.pagoTrabajoForm[field] = value; rerenderPreservingFocus(); }

function toggleTurnoSel(id) {
  state.pagoTrabajoForm.turnosSel[id] = !state.pagoTrabajoForm.turnosSel[id];
  render();
}

function confirmPagoTrabajo() {
  const f = state.pagoTrabajoForm;
  const monto = toNum(f.montoNeto) || toNum(f.montoBruto);
  if (monto <= 0) return;
  pushUndo();
  const seleccionados = Object.keys(f.turnosSel).filter((id) => f.turnosSel[id]);
  const pago = {
    id: uid(), fecha: f.fecha, montoBruto: f.montoBruto, montoNeto: f.montoNeto || f.montoBruto,
    bonos: f.bonos, horasExtra: f.horasExtra, descuentos: f.descuentos, metodo: f.metodo, notas: f.notas,
    turnosIncluidos: seleccionados,
  };
  state.pagosTrabajo.push(pago);
  state.turnos.forEach((t) => { if (seleccionados.indexOf(t.id) !== -1) { t.estado = "pagado"; t.pagoId = pago.id; } });
  if (state.payFrequency === "mensual") state.ingreso = String(toNum(state.ingreso) + toNum(pago.montoNeto));
  else state.ingresosLog.push({ id: uid(), monto: pago.montoNeto, month: monthKey() });
  state.showPagoTrabajo = false;
  state.workPagoFlash = true;
  scheduleSave();
  rerenderPreservingFocus();
  setTimeout(() => { state.workPagoFlash = false; rerenderPreservingFocus(); }, 1800);
}

function askDeletePagoTrabajo(id) { state.confirmDeletePagoTrabajoId = id; render(); }

function cancelDeletePagoTrabajo() { state.confirmDeletePagoTrabajoId = null; render(); }

function removePagoTrabajo(id) {
  const pago = state.pagosTrabajo.find((p) => p.id === id);
  if (!pago) return;
  pushUndo();
  state.turnos.forEach((t) => { if (t.pagoId === id) { t.estado = "trabajado"; delete t.pagoId; } });
  state.pagosTrabajo = state.pagosTrabajo.filter((p) => p.id !== id);
  state.confirmDeletePagoTrabajoId = null;
  scheduleSave(); rerenderPreservingFocus();
}
