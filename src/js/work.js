"use strict";

let timerHandle = null;

function startTimerLoop() {
  if (timerHandle) return;
  timerHandle = setInterval(() => { if (state.activeTab === "trabajo") render(); }, 1000);
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

function updateJobField(field, value) {
  state.job[field] = value;
  scheduleSave(); rerenderPreservingFocus();
}

function empezarTrabajo() {
  pushUndo();
  state.turnoActivo = { id: uid(), horaInicio: new Date().toISOString(), breakActivo: null, breaks: [], propinas: "", bonos: "", notas: "" };
  startTimerLoop();
  scheduleSave(); render();
}

function empezarBreak() {
  if (!state.turnoActivo || state.turnoActivo.breakActivo) return;
  state.turnoActivo.breakActivo = { inicio: new Date().toISOString() };
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

function totalesMes() {
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
  const fin = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return totalesPeriodo(inicio, fin);
}

function ganadoEsteMes() { return totalesMes().bruto; }

function recibidoEsteMes() {
  const mk = monthKey();
  return state.pagosTrabajo.filter((p) => (p.fecha || "").slice(0, 7) === mk).reduce((a, p) => a + toNum(p.montoNeto), 0);
}

function pendienteDePago() {
  return state.turnos.filter((t) => t.estado !== "pagado").reduce((a, t) => a + turnoPagoNetoEstimado(t), 0);
}

function toggleEditJob() { state.editingJob = !state.editingJob; render(); }

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
