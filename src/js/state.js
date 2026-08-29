"use strict";

const toNum = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

const fmt0 = (n) => Math.round(isFinite(n) ? n : 0).toLocaleString(LANG === "es" ? "es-ES" : "en-US", { maximumFractionDigits: 0 });

const fmt10 = (n) => (Math.round((isFinite(n) ? n : 0) / 10) * 10).toLocaleString(LANG === "es" ? "es-ES" : "en-US", { maximumFractionDigits: 0 });

const APP_VERSION = "v125";
const BUILD_DATE = "29/08 14:20 UTC";

let uidCounter = 1;

const uid = () => "id_" + Date.now() + "_" + (uidCounter++);

const PROFILES_KEY = "cuentas-claras:perfiles";
const PIN_HASH_KEY = "cuentas-claras:pin-hash";
const PIN_QUICK_KEY = "cuentas-claras:pin-quick-v1";
const PIN_ATTEMPTS_KEY = "cuentas-claras:pin-attempts";
const PIN_LOCK_KEY = "cuentas-claras:pin-lock-until";
const BIOMETRIC_CRED_KEY = "cuentas-claras:biometric-credential";

const CURRENCY = { usd: "$", eur: "€" };

const CATEGORIES = ["renta", "luz", "agua", "gas", "wifi", "telefono", "carro", "seguro", "gym", "streaming", "entretenimiento", "salud", "otro"];

const ICON_PICKER = [
  "home", "bulb", "droplet", "flame", "wifi", "router", "phone", "tv", "clapper", "music",
  "gamepad", "cloud", "book", "car", "bus", "train", "fuel", "shield", "medcross", "pill",
  "tooth", "dumbbell", "barbell", "cart", "store", "utensils", "coffee", "paw", "dog", "baby",
  "scissors", "shirt", "sofa", "leaf", "gift", "church", "cap", "briefcase", "tools", "hammer",
  "key", "lock", "globe", "camera", "printer", "plug", "box", "scale", "chart2", "card", "bills", "tag",
];

const CATEGORY_ICON = { renta: "home", luz: "bulb", agua: "droplet", gas: "flame", wifi: "wifi", telefono: "phone", carro: "car", seguro: "shield", gym: "dumbbell", streaming: "clapper", entretenimiento: "clapper", salud: "medcross", otro: "tag" };

const SUB_PRESETS = [
  { key: "renta", cat: "renta" }, { key: "luz", cat: "luz" }, { key: "agua", cat: "agua" }, { key: "gas", cat: "gas" },
  { key: "wifi", cat: "wifi" }, { key: "telefono", cat: "telefono" }, { key: "carro", cat: "carro" }, { key: "seguro", cat: "seguro" },
  { key: "gym", cat: "gym" }, { key: "streaming", cat: "streaming" },
];

function sym() { return CURRENCY[state.currency] || "$"; }

const ACTIVE_KEY = "cuentas-claras:perfil-activo";

const SETTINGS_KEY = "cuentas-claras:ajustes";

const dataKeyV3 = (id) => "cuentas-claras:datos-v3:" + id;

const dataKeyV2 = (id) => "cuentas-claras:datos-v2:" + id;

const MESES_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const MESES_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const monthKey = (d) => { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
const dateKeyOf = (d) => { d = (d instanceof Date) ? d : new Date(d); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

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
  appLocked: false, pinInput: "", pinSetupInput: "", pinError: "", pinBusy: false, biometricBusy: false, biometricAutoTried: false, confirmPinReset: false,
  profiles: loadProfiles(),
  activeProfileId: null,
  confirmDeleteProfileId: null,
  theme: settingsInit.theme || "light", textSize: settingsInit.textSize || "normal", cardNubeExpandida: null, expandedCloudCardIds: {}, bankExpenseScrollTop: 0,
  showConfirmarAhorro: false, montoConfirmarAhorro: "", debtStrategy: "avalancha", extraPagoDeuda: "",
  lang: settingsInit.lang || "es",
  currency: settingsInit.currency || "usd",
  objetivo: settingsInit.objetivo || "equilibrado",
  newProfileName: "",
  showExport: false, exportCopied: false,
  activeTab: "inicio",
  confirmDeleteSubId: null, confirmDeleteCardId: null, confirmDeleteHistoryKey: null, confirmDeleteLoanId: null,
  editingSubs: false, subPresetPicker: false,
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

  goals: [], editingGoals: false, confirmDeleteGoalId: null, editingSaldosInicio: false, iconPickerSubId: null, confirmSumarAhorro: false, diaSemanaSel: null,
  historialSearch: "", historialCategoriaFiltro: "", showTxDetalle: null, notasTransacciones: {},
  cuentasHistorialAbierto: false, cuentasAnalisisAbierto: false,
  historialMesesVisibles: 3, pagosMesesVisibles: 3, historialMesAbierto: null, historialVista: "compras", txDetalleFlash: "",
  cloudErrorMsg: "", cloudBusy: false, cloudFlash: "", confirmDisconnectId: null,
  payFrequency: "mensual", ultimoPago: "", proximoPagoAjuste: "", ingresosLog: [], loans: [],
  cashflowPeriod: "week",
  trabajoPeriodoDefault: "quincenal",
  trabajoCalMonth: new Date().getMonth(), trabajoCalYear: new Date().getFullYear(),
  trabajoCalSelectedDate: null, trabajoCalHorasInput: "", cashflowMonthOffset: 0,
  job: { nombre: "", pagoHora: "18", pagoDia: "", frecuenciaPago: "semanal", diaPago: "", horasExtraDespues: "40", multiplicadorExtra: "1.5", impuestoPct: "", descansoPagado: false, limiteAlmuerzo: "30", horarioDias: [false, false, false, false, false, false, false], horarioInicio: "09:00", horarioFin: "17:00", horarioRecordar: false, horarioUltimoRecordatorio: "", horarioUltimoRecordatorioSalida: "" },
  turnos: [], turnoActivo: null, pagosTrabajo: [], workNotifBanner: null,
  editingJob: false, confirmTerminarTrabajo: false, confirmEmpezarBreak: false, confirmDeleteTurnoId: null, expandedTurnoIds: {},
  showAgregarTurno: false, agregarTurnoForm: { fecha: "", horas: "" },
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
