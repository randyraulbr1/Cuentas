"use strict";

/* ---------- importar estado de cuenta (CSV local) ----------
   Todo ocurre en el navegador: se lee el archivo con FileReader, se procesa
   con JS puro y se guarda en IndexedDB. El archivo nunca se envia a ningun sitio. */

function parseCSVText(text) {
  // parser simple de CSV que respeta comillas y comas dentro de comillas
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); if (row.some((x) => x !== "")) rows.push(row); }
  return rows;
}

function findColumn(headerRow, candidates) {
  const norm = headerRow.map((h) => String(h || "").toLowerCase().trim());
  for (const cand of candidates) {
    const idx = norm.findIndex((h) => h === cand);
    if (idx !== -1) return idx;
  }
  for (const cand of candidates) {
    const idx = norm.findIndex((h) => h.indexOf(cand) !== -1);
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseAmount(raw) {
  if (raw == null) return NaN;
  const cleaned = String(raw).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : NaN;
}

function csvRowsToTransactions(rows) {
  if (rows.length === 0) return [];
  const header = rows[0];
  const looksLikeHeader = header.some((h) => /date|desc|amount|monto|fecha/i.test(String(h)));
  const dataRows = looksLikeHeader ? rows.slice(1) : rows;
  const headerForCols = looksLikeHeader ? header : [];

  const dateIdx = findColumn(headerForCols, ["date", "posting date", "fecha", "transaction date"]);
  const descIdx = findColumn(headerForCols, ["description", "payee", "memo", "descripcion", "descripción"]);
  const amountIdx = findColumn(headerForCols, ["amount", "monto"]);

  const out = [];
  dataRows.forEach((r) => {
    if (r.length < 2) return;
    const fecha = dateIdx !== -1 ? r[dateIdx] : r[0];
    const descripcion = descIdx !== -1 ? r[descIdx] : (r[1] || "");
    let montoRaw = amountIdx !== -1 ? r[amountIdx] : r[r.length - 1];
    const monto = parseAmount(montoRaw);
    if (!isFinite(monto) || monto === 0) return;
    out.push({ id: uid(), fecha: String(fecha || "").trim(), descripcion: String(descripcion || "").trim(), monto: monto });
  });
  return out;
}

function startImportarBanco() {
  const input = document.getElementById("bank-file-input");
  if (input) input.click();
}

function handleBankFile(fileInputEl) {
  const file = fileInputEl.files && fileInputEl.files[0];
  fileInputEl.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rows = parseCSVText(String(reader.result));
      const nuevas = csvRowsToTransactions(rows);
      if (nuevas.length === 0) { state.bankImportMsg = t("bankImportVacio"); render(); return; }
      pushUndo();
      nuevas.forEach((tx) => { tx.categoria = guessCategory(tx.descripcion, tx.monto); });
      state.bankTransactions = nuevas.concat(state.bankTransactions);
      state.bankPendingCategoria = state.bankTransactions.filter((tx) => !tx.categoria).map((tx) => tx.id);
      state.bankImportMsg = t("bankImportOk")(nuevas.length);
      scheduleSave();
      rerenderPreservingFocus();
    } catch (e) {
      state.bankImportMsg = t("bankImportError");
      render();
    }
  };
  reader.onerror = () => { state.bankImportMsg = t("bankImportError"); render(); };
  reader.readAsText(file);
}

function setTxCategoria(id, categoria) {
  const tx = state.bankTransactions.find((x) => x.id === id);
  if (!tx) return;
  pushUndo();
  tx.categoria = categoria;
  learnCategory(tx.descripcion, categoria);
  state.bankPendingCategoria = state.bankPendingCategoria.filter((x) => x !== id);
  scheduleSave();
  rerenderPreservingFocus();
}

function askDeleteBankTx(id) { state.confirmDeleteBankTxId = id; render(); }
function cancelDeleteBankTx() { state.confirmDeleteBankTxId = null; render(); }
function confirmTxCategoria(id) {
  const sel = document.getElementById("bank-cat-select");
  if (!sel) return;
  setTxCategoria(id, sel.value);
}
function removeBankTx(id) {
  pushUndo();
  state.bankTransactions = state.bankTransactions.filter((x) => x.id !== id);
  state.bankPendingCategoria = state.bankPendingCategoria.filter((x) => x !== id);
  state.confirmDeleteBankTxId = null;
  scheduleSave(); rerenderPreservingFocus();
}

function bankTxMonthKey(fechaStr) {
  const s = String(fechaStr || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + "-" + m[2];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + "-" + String(m[1]).padStart(2, "0");
  const d = new Date(s);
  if (!isNaN(d)) return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  return "";
}

function bankTotalsEsteMes() {
  const mk = monthKey();
  const porCategoria = {};
  let ingresos = 0, gastos = 0;
  state.bankTransactions.forEach((tx) => {
    if (bankTxMonthKey(tx.fecha) !== mk) return;
    if (tx.monto > 0) ingresos += tx.monto;
    else {
      gastos += -tx.monto;
      const cat = tx.categoria || "otros";
      porCategoria[cat] = (porCategoria[cat] || 0) + -tx.monto;
    }
  });
  return { ingresos, gastos, porCategoria };
}
