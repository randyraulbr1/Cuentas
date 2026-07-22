"use strict";

const toNum = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

const fmt0 = (n) => Math.round(isFinite(n) ? n : 0).toLocaleString(LANG === "es" ? "es-ES" : "en-US", { maximumFractionDigits: 0 });

const fmt10 = (n) => (Math.round((isFinite(n) ? n : 0) / 10) * 10).toLocaleString(LANG === "es" ? "es-ES" : "en-US", { maximumFractionDigits: 0 });

const APP_VERSION = "v59";

let uidCounter = 1;

const uid = () => "id_" + Date.now() + "_" + (uidCounter++);

const PROFILES_KEY = "cuentas-claras:perfiles";

const CURRENCY = { usd: "$", eur: "€" };

const CATEGORIES = ["renta", "wifi", "telefono", "carro", "seguro", "entretenimiento", "salud", "otro"];

const CATEGORY_ICON = { renta: "\ud83c\udfe0", wifi: "\ud83d\udce1", telefono: "\ud83d\udcf1", carro: "\ud83d\ude97", seguro: "\ud83d\udee1\ufe0f", entretenimiento: "\ud83c\udfac", salud: "\ud83e\ude7a", otro: "\ud83d\udd16" };

const SUB_PRESETS = [
  { key: "renta", cat: "renta" }, { key: "wifi", cat: "wifi" }, { key: "telefono", cat: "telefono" }, { key: "seguro", cat: "seguro" },
];

function sym() { return CURRENCY[state.currency] || "$"; }

const ACTIVE_KEY = "cuentas-claras:perfil-activo";

const SETTINGS_KEY = "cuentas-claras:ajustes";

const dataKeyV3 = (id) => "cuentas-claras:datos-v3:" + id;

const dataKeyV2 = (id) => "cuentas-claras:datos-v2:" + id;

const MESES_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const MESES_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const monthKey = (d) => { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };

const monthLabel = (key) => { const p = key.split("-").map(Number); const arr = LANG === "es" ? MESES_ES : MESES_EN; return arr[p[1] - 1] + " " + p[0]; };

function statusFromRatio(ratio, insuficiente) {
  if (insuficiente || ratio > 0.9) return { key: "rojo", label: t("statusRojo") };
  if (ratio > 0.6) return { key: "amarillo", label: t("statusAmarillo") };
  return { key: "verde", label: t("statusVerde") };
}

function esc(v) { return String(v == null ? "" : v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

const settingsInit = loadSettings();

const state = {
  screen: "selector",
  profiles: loadProfiles(),
  activeProfileId: null,
  confirmDeleteProfileId: null,
  theme: settingsInit.theme || "light", textSize: settingsInit.textSize || "normal", cardSeleccionadaId: null,
  lang: settingsInit.lang || "es",
  currency: settingsInit.currency || "usd",
  objetivo: settingsInit.objetivo || "equilibrado",
  newProfileName: "",
  showExport: false, exportCopied: false,
  activeTab: "inicio",
  confirmDeleteSubId: null, confirmDeleteCardId: null, confirmDeleteHistoryKey: null, confirmDeleteLoanId: null,
  editingSubs: false,
  editingIngreso: false, editingAhorro: false, editingCards: false, editingLoans: false,
  payingTarget: null, payingSubId: null, payFormSource: "ahorro", payFormMonto: "", payFlash: false, autoPagoNotif: null,
  expandedCardIds: {},

  ingreso: "", subs: [], cards: [], savingsRate: 20, ahorroActual: "", metaAhorro: "", debito: "", cash: "", history: [],
  bankTransactions: [], categoriaAprendida: {}, bankPendingCategoria: [], bankImportMsg: "", confirmDeleteBankTxId: null,
  suscripcionesCanceladas: [], suscripcionesManuales: [], suscripcionesFrecuencia: {},
  gastosFijosReconocidos: [], showMarcarGastoFijo: false, nombreGastoFijoTemp: "",
  consentimientoAceptado: false, consentimientoFecha: "", showConsentimiento: false,

  apiBaseUrl: settingsInit.apiBaseUrl || "https://cuentas-1duj.onrender.com", authToken: null, authUser: null,
  authMode: "login", authEmail: "", authPassword: "", authFormError: "",
  cloudAccounts: [], cloudTransactions: [], cloudInstitutions: [], cloudLastSync: "", cloudLiabilities: {},

  goals: [], editingGoals: false, confirmDeleteGoalId: null,
  historialSearch: "", historialCategoriaFiltro: "", showTxDetalle: null, notasTransacciones: {},
  historialMesesVisibles: 3, pagosMesesVisibles: 3, historialMesAbierto: null, historialVista: "compras", txDetalleFlash: "",
  cloudErrorMsg: "", cloudBusy: false, cloudFlash: "", confirmDisconnectId: null,
  payFrequency: "mensual", ultimoPago: "", proximoPagoAjuste: "", ingresosLog: [], loans: [],
  job: { nombre: "", pagoHora: "", pagoDia: "", frecuenciaPago: "semanal", diaPago: "", horasExtraDespues: "40", multiplicadorExtra: "1.5", impuestoPct: "", descansoPagado: false },
  turnos: [], turnoActivo: null, pagosTrabajo: [],
  editingJob: false, confirmTerminarTrabajo: false, confirmDeleteTurnoId: null, expandedTurnoIds: {},
  showPagoTrabajo: false, pagoTrabajoForm: null, workPagoFlash: false, confirmDeletePagoTrabajoId: null,
  resultado: null, confirmReset: false, savedFlash: false, storageError: false,
};

LANG = state.lang;

let UPDATE_AVAILABLE = false;

const undoStack = [];

let saveTimeout = null;

function scheduleSave() { if (saveTimeout) clearTimeout(saveTimeout); saveTimeout = setTimeout(saveUserDataNow, 300); }

function pushUndo() {
  undoStack.push(JSON.parse(JSON.stringify({
    subs: state.subs, cards: state.cards, ingreso: state.ingreso, savingsRate: state.savingsRate,
    ahorroActual: state.ahorroActual, metaAhorro: state.metaAhorro, debito: state.debito, cash: state.cash, history: state.history,
    payFrequency: state.payFrequency, ultimoPago: state.ultimoPago, proximoPagoAjuste: state.proximoPagoAjuste,
    ingresosLog: state.ingresosLog, loans: state.loans, job: state.job, turnos: state.turnos, turnoActivo: state.turnoActivo, pagosTrabajo: state.pagosTrabajo,
  })));
  if (undoStack.length > 15) undoStack.shift();
}

function undo() { const prev = undoStack.pop(); if (!prev) return; Object.assign(state, prev); scheduleSave(); rerenderPreservingFocus(); }
