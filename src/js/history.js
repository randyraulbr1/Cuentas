"use strict";

function askDeleteHistory(key) { state.confirmDeleteHistoryKey = key; render(); }

function cancelDeleteHistory() { state.confirmDeleteHistoryKey = null; render(); }

function removeHistory(key) { pushUndo(); state.history = state.history.filter((x) => x.month !== key); state.confirmDeleteHistoryKey = null; scheduleSave(); rerenderPreservingFocus(); }

function guardarMes() {
  const t2 = computeTotals();
  if (t2.ingresoEfectivo <= 0) return;
  const resultado = computeResultado(t2);
  pushUndo();
  const key = monthKey();
  const entry = {
    month: key, ingreso: t2.ingresoEfectivo, comprometido: t2.totalSubs + t2.totalMinimos, ratio: t2.ratioComprometido,
    ahorro: resultado.insuficiente ? 0 : resultado.ahorro, insuficiente: !!resultado.insuficiente, status: t2.liveStatus.key,
  };
  state.history = state.history.filter((x) => x.month !== key);
  state.history.push(entry);
  state.history.sort((a, b) => (a.month < b.month ? 1 : -1));
  state.savedFlash = true;
  scheduleSave();
  rerenderPreservingFocus();
  setTimeout(() => { state.savedFlash = false; rerenderPreservingFocus(); }, 1800);
}
