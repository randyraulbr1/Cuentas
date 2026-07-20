"use strict";

/* ---------- IndexedDB: capa central de almacenamiento para datos financieros ---------- */
const IDB_NAME = "cuentas-claras-db";
const IDB_STORE = "kv";
let idbPromise = null;

function openIDB() {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) { reject(new Error("no-idb")); return; }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return idbPromise;
}
function idbGet(key) {
  return openIDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}
function idbSet(key, value) {
  return openIDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

/* ---------- perfiles y ajustes: localStorage (pequeños, no financieros) ---------- */
function loadProfiles() { try { return JSON.parse(localStorage.getItem(PROFILES_KEY)) || []; } catch (e) { return []; } }
function saveProfiles(list) { try { localStorage.setItem(PROFILES_KEY, JSON.stringify(list)); } catch (e) {} }
function loadSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } }
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: state.theme, lang: state.lang, currency: state.currency, objetivo: state.objetivo })); } catch (e) {} }

/* ---------- datos financieros por perfil: IndexedDB, con localStorage como respaldo/migracion ---------- */

/* Carga con migración: intenta IndexedDB primero. Si no hay nada ahí, recupera el
   respaldo guardado antes en localStorage (v3 o v2) y lo copia a IndexedDB para la
   próxima vez, SIN borrar nunca el respaldo original en localStorage. */
async function loadUserData(id) {
  try {
    const idbData = await idbGet(dataKeyV3(id));
    if (idbData) return idbData;
  } catch (e) {}
  try {
    let raw = localStorage.getItem(dataKeyV3(id));
    if (!raw) raw = localStorage.getItem(dataKeyV2(id));
    if (raw) {
      const parsed = JSON.parse(raw);
      try { await idbSet(dataKeyV3(id), parsed); } catch (e) {}
      return parsed;
    }
  } catch (e) {}
  return {};
}

async function saveUserDataNow() {
  if (!state.activeProfileId) return;
  const payload = {
    ingreso: state.ingreso, subs: state.subs, cards: state.cards,
    savingsRate: state.savingsRate, ahorroActual: state.ahorroActual, metaAhorro: state.metaAhorro, debito: state.debito, cash: state.cash, history: state.history,
    bankTransactions: state.bankTransactions, categoriaAprendida: state.categoriaAprendida,
    consentimientoAceptado: state.consentimientoAceptado, consentimientoFecha: state.consentimientoFecha,
    payFrequency: state.payFrequency, ultimoPago: state.ultimoPago, proximoPagoAjuste: state.proximoPagoAjuste,
    ingresosLog: state.ingresosLog, loans: state.loans, job: state.job, turnos: state.turnos, turnoActivo: state.turnoActivo, pagosTrabajo: state.pagosTrabajo,
  };
  try {
    await idbSet(dataKeyV3(state.activeProfileId), payload);
    state.storageError = false;
  } catch (e) {
    try {
      localStorage.setItem(dataKeyV3(state.activeProfileId), JSON.stringify(payload));
      state.storageError = false;
    } catch (e2) { state.storageError = true; }
  }
}

async function deleteUserData(id) {
  try { await idbSet(dataKeyV3(id), undefined); } catch (e) {}
  try { localStorage.removeItem(dataKeyV3(id)); localStorage.removeItem(dataKeyV2(id)); } catch (e) {}
}
