"use strict";

function addSub() { state.subs.push({ id: uid(), nombre: "", monto: "" }); scheduleSave(); rerenderPreservingFocus(); }

function toggleEditSubs() { state.editingSubs = !state.editingSubs; state.confirmDeleteSubId = null; render(); }

function toggleSubPagado(id) {
  const s = state.subs.find((x) => x.id === id);
  if (!s) return;
  if (s.pagadoMes === monthKey()) {
    pushUndo();
    const monto = toNum(s.pagadoMonto);
    if (monto > 0) {
      if (s.pagadoFuente === "debito") state.debito = String(toNum(state.debito) + monto);
      else if (s.pagadoFuente === "ahorro") state.ahorroActual = String(toNum(state.ahorroActual) + monto);
    }
    s.pagadoMes = null; s.pagadoFuente = null; s.pagadoMonto = null;
    scheduleSave(); rerenderPreservingFocus();
  } else {
    state.payingSubId = id;
    state.payFormSource = "debito";
    state.payFormMonto = String(toNum(s.monto));
    render();
  }
}

function cancelPagoSub() { state.payingSubId = null; state.payFormMonto = ""; render(); }

function confirmPagoSub() {
  const s = state.subs.find((x) => x.id === state.payingSubId);
  if (!s) return;
  const monto = toNum(state.payFormMonto);
  if (monto <= 0) return;
  pushUndo();
  if (state.payFormSource === "debito") state.debito = String(Math.max(toNum(state.debito) - monto, 0));
  else if (state.payFormSource === "ahorro") state.ahorroActual = String(Math.max(toNum(state.ahorroActual) - monto, 0));
  else if (state.payFormSource === "cash") state.cash = String(Math.max(toNum(state.cash) - monto, 0));
  s.pagadoMes = monthKey();
  s.pagadoFuente = state.payFormSource;
  s.pagadoMonto = String(monto);
  state.payingSubId = null;
  state.payFormMonto = "";
  scheduleSave();
  rerenderPreservingFocus();
}

function toggleEditIngreso() { state.editingIngreso = !state.editingIngreso; render(); }

function addIngresoEntry() { state.ingresosLog.push({ id: uid(), monto: "", month: monthKey() }); scheduleSave(); rerenderPreservingFocus(); }

function removeIngresoEntry(id) { pushUndo(); state.ingresosLog = state.ingresosLog.filter((x) => x.id !== id); scheduleSave(); rerenderPreservingFocus(); }

function toggleEditAhorro() { state.editingAhorro = !state.editingAhorro; render(); }

function toggleEditCards() { state.editingCards = !state.editingCards; state.confirmDeleteCardId = null; render(); }

function addSubPreset(key) {
  const preset = SUB_PRESETS.find((p) => p.key === key);
  if (!preset) return;
  state.subs.push({ id: uid(), nombre: t("preset_" + key), monto: "", categoria: preset.cat });
  scheduleSave(); rerenderPreservingFocus();
}

function toggleEditLoans() { state.editingLoans = !state.editingLoans; state.confirmDeleteLoanId = null; render(); }

function addLoan() {
  state.loans.push({ id: uid(), nombre: "", saldoTotal: "", montoOriginal: "", montoPago: "", tasa: "", frecuencia: "quincenal", ultimoPago: "", automatico: false, fuenteAutomatica: "debito" });
  state.editingLoans = true;
  scheduleSave(); rerenderPreservingFocus();
}

function setLoanAuto(id, val) {
  const l = state.loans.find((x) => x.id === id);
  if (!l) return;
  l.automatico = val;
  scheduleSave(); render();
}

function setLoanFuente(id, fuente) {
  const l = state.loans.find((x) => x.id === id);
  if (!l) return;
  l.fuenteAutomatica = fuente;
  scheduleSave(); render();
}

function oneStepNextDate(lastStr, frecuencia) {
  const last = parseISODate(lastStr);
  if (!last) return null;
  const next = new Date(last);
  if (frecuencia === "mensual") next.setMonth(next.getMonth() + 1);
  else next.setDate(next.getDate() + (frecuencia === "semanal" ? 7 : 15));
  return next;
}

function processAutoPayments() {
  const aplicados = [];
  const now = new Date(); now.setHours(0, 0, 0, 0);
  state.loans.forEach((l) => {
    if (!l.automatico) return;
    let guard = 0;
    while (toNum(l.saldoTotal) > 0 && guard < 24) {
      const next = oneStepNextDate(l.ultimoPago, l.frecuencia);
      if (!next || next > now) break;
      const monto = Math.min(toNum(l.montoPago), toNum(l.saldoTotal));
      if (monto <= 0) break;
      l.saldoTotal = String(Math.max(toNum(l.saldoTotal) - monto, 0));
      if (l.fuenteAutomatica === "debito") state.debito = String(Math.max(toNum(state.debito) - monto, 0));
      else state.ahorroActual = String(Math.max(toNum(state.ahorroActual) - monto, 0));
      l.ultimoPago = next.toISOString().slice(0, 10);
      if (aplicados.indexOf(l.nombre || t("loanNombrePh")) === -1) aplicados.push(l.nombre || t("loanNombrePh"));
      guard++;
    }
  });
  if (aplicados.length > 0) {
    state.autoPagoNotif = aplicados;
    scheduleSave();
  }
}

function askDeleteLoan(id) { state.confirmDeleteLoanId = id; render(); }

function cancelDeleteLoan() { state.confirmDeleteLoanId = null; render(); }

function removeLoan(id) { pushUndo(); state.loans = state.loans.filter((x) => x.id !== id); state.confirmDeleteLoanId = null; scheduleSave(); rerenderPreservingFocus(); }

function setLoanFrec(id, freq) {
  const loan = state.loans.find((l) => l.id === id);
  if (!loan) return;
  loan.frecuencia = freq;
  scheduleSave(); render();
}

function startPago(type, targetId) {
  const t2 = computeTotals();
  const resultado = t2.ingresoEfectivo > 0 ? computeResultado(t2) : null;
  let sugerido = "";
  if (type === "card" && resultado && !resultado.insuficiente) {
    const a = resultado.asignaciones.find((x) => x.id === targetId);
    if (a && a.pagoTotal > 0) sugerido = String(a.pagoTotal);
  } else if (type === "loan") {
    const loan = state.loans.find((l) => l.id === targetId);
    if (loan && toNum(loan.montoPago) > 0) sugerido = String(toNum(loan.montoPago));
  }
  state.payingTarget = { type: type, id: targetId };
  state.payFormSource = "debito";
  state.payFormMonto = sugerido;
  render();
}

function cancelPago() { state.payingTarget = null; state.payFormMonto = ""; render(); }

function setPagoSourceAhorro() { state.payFormSource = "ahorro"; render(); }

function setPagoSourceDebito() { state.payFormSource = "debito"; render(); }

function setPagoSourceCash() { state.payFormSource = "cash"; render(); }

function setPagoSourceNinguno() { state.payFormSource = "ninguno"; render(); }

function confirmPago() {
  if (!state.payingTarget) return;
  const monto = toNum(state.payFormMonto);
  if (monto <= 0) return;
  const list = state.payingTarget.type === "card" ? state.cards : state.loans;
  const field = state.payingTarget.type === "card" ? "saldo" : "saldoTotal";
  const item = list.find((x) => x.id === state.payingTarget.id);
  if (!item) return;
  pushUndo();
  item[field] = String(Math.max(toNum(item[field]) - monto, 0));
  if (state.payFormSource === "debito") state.debito = String(Math.max(toNum(state.debito) - monto, 0));
  else if (state.payFormSource === "ahorro") state.ahorroActual = String(Math.max(toNum(state.ahorroActual) - monto, 0));
  else if (state.payFormSource === "cash") state.cash = String(Math.max(toNum(state.cash) - monto, 0));
  state.payingTarget = null;
  state.payFormMonto = "";
  state.payFlash = true;
  scheduleSave();
  rerenderPreservingFocus();
  setTimeout(() => { state.payFlash = false; rerenderPreservingFocus(); }, 1800);
}

function askDeleteSub(id) { state.confirmDeleteSubId = id; render(); }

function cancelDeleteSub() { state.confirmDeleteSubId = null; render(); }

function removeSub(id) { pushUndo(); state.subs = state.subs.filter((x) => x.id !== id); state.confirmDeleteSubId = null; scheduleSave(); rerenderPreservingFocus(); }

function addCard() {
  const c = { id: uid(), nombre: "", saldo: "", limite: "", apr: "", minimo: "" };
  state.cards.push(c);
  state.expandedCardIds[c.id] = true;
  scheduleSave(); rerenderPreservingFocus();
}

function toggleCardExpand(id) { state.expandedCardIds[id] = !state.expandedCardIds[id]; render(); }

function askDeleteCard(id) { state.confirmDeleteCardId = id; render(); }

function cancelDeleteCard() { state.confirmDeleteCardId = null; render(); }

function removeCard(id) { pushUndo(); state.cards = state.cards.filter((x) => x.id !== id); delete state.expandedCardIds[id]; state.confirmDeleteCardId = null; scheduleSave(); rerenderPreservingFocus(); }

function resetAll() {
  pushUndo();
  state.ingreso = ""; state.subs = []; state.cards = []; state.savingsRate = 20;
  state.ahorroActual = ""; state.metaAhorro = ""; state.debito = ""; state.cash = ""; state.resultado = null; state.confirmReset = false;
  state.bankTransactions = []; state.categoriaAprendida = {}; state.bankPendingCategoria = []; state.bankImportMsg = ""; state.confirmDeleteBankTxId = null;
  state.goals = []; state.editingGoals = false; state.confirmDeleteGoalId = null;
  state.suscripcionesCanceladas = [];
  state.payFrequency = "mensual"; state.ultimoPago = ""; state.proximoPagoAjuste = ""; state.ingresosLog = []; state.loans = [];
  state.job = { nombre: "", pagoHora: "", pagoDia: "", frecuenciaPago: "semanal", diaPago: "", horasExtraDespues: "40", multiplicadorExtra: "1.5", impuestoPct: "", descansoPagado: false };
  state.turnos = []; state.turnoActivo = null; state.pagosTrabajo = [];
  stopTimerLoop();
  state.expandedCardIds = {}; state.confirmDeleteSubId = null; state.confirmDeleteCardId = null; state.confirmDeleteHistoryKey = null; state.payingTarget = null; state.payingSubId = null; state.payFormMonto = ""; state.confirmDeleteLoanId = null;
  scheduleSave(); rerenderPreservingFocus();
}

function toggleEditGoals() { state.editingGoals = !state.editingGoals; state.confirmDeleteGoalId = null; render(); }
function addGoal() {
  state.goals.push({ id: uid(), nombre: "", montoObjetivo: "", montoActual: "" });
  state.editingGoals = true;
  scheduleSave(); rerenderPreservingFocus();
}
function askDeleteGoal(id) { state.confirmDeleteGoalId = id; render(); }
function cancelDeleteGoal() { state.confirmDeleteGoalId = null; render(); }
function removeGoal(id) { pushUndo(); state.goals = state.goals.filter((g) => g.id !== id); state.confirmDeleteGoalId = null; scheduleSave(); rerenderPreservingFocus(); }

function toggleSuscripcionCancelada(merchantKey) {
  const idx = state.suscripcionesCanceladas.indexOf(merchantKey);
  if (idx === -1) state.suscripcionesCanceladas.push(merchantKey);
  else state.suscripcionesCanceladas.splice(idx, 1);
  scheduleSave(); render();
}

function verDetalleTx(id) { state.showTxDetalle = id; render(); }
function cerrarDetalleTx() { state.showTxDetalle = null; render(); }
