"use strict";

const root = document.getElementById("root");

function renderBancoNubePanel() {
  let html = '<div class="panel">';
  html += '<div class="panel-head-row"><div><h2>' + t("bancoNubeTitle") + '</h2><p class="hint" style="margin-bottom:0;">' + t("bancoNubeHint") + '</p></div></div>';
  if (state.cloudErrorMsg) html += '<p class="opt-row-sub" style="color:#FF3B30;margin:8px 0;">' + esc(state.cloudErrorMsg) + '</p>';
  if (state.cloudFlash) html += '<div class="flash">' + icon("check") + ' ' + esc(state.cloudFlash) + '</div>';

  if (!state.authUser) {
    html += '<button class="pay-trigger" style="background:#3D5AFE;" data-action="iniciarConectarBanco"' + (state.cloudBusy ? " disabled" : "") + '>' + icon("bank") + ' ' + (state.cloudBusy ? t("conectandoMsg") : t("conectarBancoPlaidBtn")) + '</button>';
    html += '<button class="delete-link" style="display:block;margin:8px auto 0;" data-action="resetConexionNube">' + t("restablecerConexionBtn") + '</button>';
    html += '</div>';
    return html;
  }

  state.cloudInstitutions.filter((inst) => inst.status === "active").forEach((inst) => {
    if (state.confirmDisconnectId === inst.id) {
      html += '<div class="confirm-row"><span>' + esc(t("confirmDesconectarMsg")(inst.institution_name || "")) + '</span><div class="confirm-row-btns"><button class="pill-btn confirm" data-action="confirmDisconnectBank" data-id="' + inst.id + '">' + t("yesDelete") + '</button><button class="pill-btn" data-action="cancelDisconnectBank">' + t("cancel") + '</button></div></div>';
    } else {
      html += '<div class="card-entry"><div class="card-collapsed-top"><span class="card-collapsed-name">' + esc(inst.institution_name || t("bancoDesconocido")) + '</span><span class="status-pill ' + (inst.status === "active" ? "verde" : "rojo") + '">' + (inst.status === "active" ? t("estadoActivo") : t("estadoDesconectado")) + '</span></div>';
      if (inst.last_synced_at) html += '<p class="opt-row-sub">' + t("ultimaActualizacionLbl") + ': ' + esc(new Date(inst.last_synced_at).toLocaleString(LANG === "es" ? "es-ES" : "en-US")) + '</p>';
      if (inst.status === "active") html += '<button class="delete-link" data-action="askDisconnectBank" data-id="' + inst.id + '">' + t("desconectarBancoBtn") + '</button>';
      html += '</div>';
    }
  });

  html += '<button class="pay-trigger" style="background:#3D5AFE;" data-action="iniciarConectarBanco"' + (state.cloudBusy ? " disabled" : "") + '>' + icon("bank") + ' ' + (state.cloudBusy ? t("conectandoMsg") : t("conectarBancoPlaidBtn")) + '</button>';
  if (state.cloudInstitutions.length > 0) html += '<button class="pill-btn wide" style="margin-top:8px;" data-action="actualizarDatosNube"' + (state.cloudBusy ? " disabled" : "") + '>' + t("actualizarNubeBtn") + '</button>';
  if (state.cloudLastSync) html += '<p class="opt-row-sub" style="text-align:center;margin-top:8px;">' + t("ultimaActualizacionLbl") + ': ' + esc(new Date(state.cloudLastSync).toLocaleString(LANG === "es" ? "es-ES" : "en-US")) + '</p>';

  if (state.cloudAccounts.length > 0) {
    html += '<div class="mini-total" style="margin-top:10px;"><span>' + t("cuentasConectadasLbl") + '</span></div>';
    state.cloudAccounts.forEach((acc) => {
      html += '<div class="sub-row-locked"><span class="locked-name">' + esc(acc.name || "") + (acc.mask ? " ****" + esc(acc.mask) : "") + '</span><span class="locked-amount">' + sym() + fmt0(toNum(acc.balance_current)) + '</span></div>';
    });
  }
  if (state.cloudTransactions.length > 0) {
    state.cloudTransactions.slice(0, 8).forEach((tx) => {
      html += renderTxRow(tx.descripcion, tx.categoria, tx.monto, String(tx.fecha).slice(0, 10));
    });
  }
  html += '</div>';
  return html;
}

function renderSelector() {
  let html = '<div class="page"><div class="selector-wrap">';
  html += '<div class="selector-logo">' + sym() + '</div>';
  html += '<h1 class="selector-title">' + t("selectorTitle") + '</h1>';
  html += '<p class="selector-hint">' + t("selectorHint") + '</p>';

  if (state.cloudBusy) html += '<p class="opt-row-sub" style="text-align:left;margin:0 0 8px;">' + t("esperaServidorMsg") + '</p>';
  html += renderBancoNubePanel();
  html += '<p class="opt-row-sub" style="text-align:center;margin:6px 0 -4px;">v' + APP_VERSION.replace("v", "") + ' \u00b7 <button data-action="actualizar" style="background:none;border:none;color:#3D5AFE;font:inherit;padding:0;cursor:pointer;">' + t("update") + '</button></p>';
  state.profiles.forEach((p) => {
    const initial = (p.nombre || "?").trim().charAt(0).toUpperCase();
    if (state.confirmDeleteProfileId === p.id) {
      html += '<div class="profile-row"><div class="profile-avatar">' + esc(initial) + '</div><div class="profile-name">' + esc(p.nombre) + '</div>';
      html += '<button class="pill-btn confirm" data-action="deleteProfile" data-id="' + p.id + '">' + t("yesDelete") + '</button>';
      html += '<button class="pill-btn" data-action="cancelDeleteProfile">' + t("cancel") + '</button></div>';
    } else {
      html += '<div class="profile-row" data-action="enterProfile" data-id="' + p.id + '"><div class="profile-avatar">' + esc(initial) + '</div><div class="profile-name">' + esc(p.nombre) + '</div>';
      html += '<button class="pill-btn">' + t("enter") + '</button>';
      html += '<button class="icon-del" data-action="askDeleteProfile" data-id="' + p.id + '">' + icon("close") + '</button></div>';
    }
  });
  if (state.profiles.length === 0) html += '<div class="empty-state">' + t("noProfiles") + '</div>';
  html += '<div class="new-profile-row"><input type="text" id="new-profile-input" placeholder="' + t("newProfilePh") + '" value="' + esc(state.newProfileName) + '">';
  html += '<button data-action="createProfile">+</button></div>';
  html += '<div class="lang-theme-row">';
  html += '<button class="pill-btn" data-action="toggleLang">' + (state.lang === "es" ? "EN" : "ES") + '</button>';
  html += '<button class="pill-btn" data-action="toggleCurrency">' + (state.currency === "usd" ? "€" : "$") + '</button>';
  html += '<button class="pill-btn" data-action="toggleTheme">' + icon(state.theme === "dark" ? "sun" : "moon") + '</button>';
  html += '</div>';
  html += '<p class="save-note">' + APP_VERSION + '</p>';
  html += '</div></div>';
  root.innerHTML = html;
}

function renderConsentimientoSheet() {
  let h = '<div class="options-overlay">';
  h += '<div class="options-sheet">';
  h += '<div class="options-head"><h2>' + t("consentTitle") + '</h2></div>';
  h += '<p class="opt-row-sub" style="margin-bottom:10px;">' + t("consentIntro") + '</p>';
  h += '<ul style="margin:0 0 12px;padding-left:18px;font-size:13px;line-height:1.6;color:var(--text);">';
  [t("consentItem1"), t("consentItem2"), t("consentItem3"), t("consentItem4")].forEach((it) => { h += "<li>" + esc(it) + "</li>"; });
  h += "</ul>";
  h += '<p class="opt-row-sub" style="margin-bottom:12px;">' + t("consentPoliza") + ' <a href="privacy.html" style="color:#3D5AFE;" target="_blank" rel="noopener">' + t("consentPolizaLink") + "</a></p>";
  h += '<div style="display:flex;gap:8px;">';
  h += '<button class="pill-btn confirm" style="flex:1;" data-action="aceptarConsentimiento">' + t("consentAceptar") + "</button>";
  h += '<button class="pill-btn" style="flex:1;" data-action="cancelarConsentimiento">' + t("cancel") + "</button>";
  h += "</div></div></div>";
  return h;
}

function renderTxChip(categoria) {
  const c = categoriaIconoColor(categoria);
  return '<div class="tx-chip" style="background:' + c.color + ';">' + icon(c.icon) + '</div>';
}
function renderTxRow(descripcion, categoria, monto, fecha, rightExtraHtml) {
  const positivo = toNum(monto) > 0;
  let h = '<div class="history-row"><div class="tx-row">';
  h += renderTxChip(categoria);
  h += '<div class="tx-row-main"><div class="tx-row-top"><span class="tx-row-name">' + esc(descripcion) + '</span><span class="locked-amount" style="color:' + (positivo ? "#34C759" : "var(--text)") + ';white-space:nowrap;">' + (positivo ? "+" : "\u2212") + sym() + fmt0(Math.abs(toNum(monto))) + '</span></div>';
  h += '<div class="tx-row-cat">' + esc(fecha || "") + (categoria ? " \u00b7 " + t("cat_" + categoria) : "") + '</div></div>';
  h += '</div>' + (rightExtraHtml || "") + '</div>';
  return h;
}

function renderExportSheet() {
  const json = JSON.stringify(buildExportData(), null, 2);
  let h = '<div class="options-overlay">';
  h += '<div class="options-sheet">';
  h += '<div class="options-head"><h2>' + t("exportarDatos") + '</h2><button class="options-close" data-action="closeExport">' + icon("close") + '</button></div>';
  h += '<p class="opt-row-sub" style="margin-bottom:8px;">' + t("exportarHint") + '</p>';
  h += '<textarea id="export-textarea" readonly style="width:100%;height:280px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:10px;color:var(--text);font-size:11px;font-family:monospace;padding:8px;line-height:1.4;">' + esc(json) + '</textarea>';
  h += '<button class="pill-btn wide confirm" style="margin-top:10px;" data-action="copyExport">' + t("copiarTexto") + '</button>';
  if (state.exportCopied) h += '<div class="flash">' + icon("check") + ' ' + t("copiado") + '</div>';
  h += '</div></div>';
  return h;
}

function renderOpcionesTab() {
  let h = '<p class="opt-row-sub" style="text-align:center;margin:-4px 0 12px;">' + t("optionsTitle") + ' \u00b7 v' + APP_VERSION.replace("v", "") + '</p>';

  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId);
  h += '<div class="panel"><p class="opt-section-title">' + t("secPerfil") + '</p>';
  h += '<div class="opt-row"><span class="opt-row-label">' + esc(activeProfile ? activeProfile.nombre : "") + '</span><button class="pill-btn" data-action="switchUser">' + t("switchUser") + '</button></div>';
  if (state.confirmDeleteProfileId === state.activeProfileId) {
    h += '<div class="confirm-row" style="margin-top:8px;"><span>' + t("confirmEliminarCuentaMsg") + '</span><div class="confirm-row-btns"><button class="pill-btn confirm" data-action="deleteProfile" data-id="' + state.activeProfileId + '">' + t("yesDelete") + '</button><button class="pill-btn" data-action="cancelDeleteProfile">' + t("cancel") + '</button></div></div>';
  } else {
    h += '<button class="pill-btn danger wide" style="margin-top:8px;width:100%;" data-action="askDeleteProfile" data-id="' + state.activeProfileId + '">' + t("eliminarCuentaBtn") + '</button>';
  }
  h += '</div>';

  h += '<div class="panel"><div class="opt-row"><span class="opt-row-label">' + t("secIdioma") + '</span><div class="seg"><button class="' + (state.lang === "es" ? "active" : "") + '" data-action="setLangEs">ES</button><button class="' + (state.lang === "en" ? "active" : "") + '" data-action="setLangEn">EN</button></div></div>';
  h += '<div class="opt-row"><span class="opt-row-label">' + t("secMoneda") + '</span><div class="seg"><button class="' + (state.currency === "usd" ? "active" : "") + '" data-action="setCurUsd">$</button><button class="' + (state.currency === "eur" ? "active" : "") + '" data-action="setCurEur">€</button></div></div>';
  h += '<div class="opt-row"><span class="opt-row-label">' + t("secTema") + '</span><div class="seg"><button class="' + (state.theme === "light" ? "active" : "") + '" data-action="setThemeLight">' + icon("sun") + '</button><button class="' + (state.theme === "dark" ? "active" : "") + '" data-action="setThemeDark">' + icon("moon") + '</button></div></div></div>';

  h += '<div class="panel"><p class="opt-section-title">' + t("secCredito") + '</p>';
  h += '<p class="opt-row-sub" style="margin-bottom:6px;">' + t("objetivoHint") + '</p>';
  h += '<div class="seg" style="width:100%;margin-top:6px;">';
  h += '<button style="flex:1;" class="' + (state.objetivo === "equilibrado" ? "active" : "") + '" data-action="setObjEquilibrado">' + t("objEquilibrado") + '</button>';
  h += '<button style="flex:1;" class="' + (state.objetivo === "credito" ? "active" : "") + '" data-action="setObjCredito">' + t("objCredito") + '</button>';
  h += '<button style="flex:1;" class="' + (state.objetivo === "ahorro" ? "active" : "") + '" data-action="setObjAhorro">' + t("objAhorro") + '</button>';
  h += '</div></div>';

  h += '<div class="panel"><p class="opt-section-title">' + t("secPago") + '</p>';
  h += '<div class="seg" style="width:100%;">';
  h += '<button style="flex:1;" class="' + (state.payFrequency === "mensual" ? "active" : "") + '" data-action="setPayMensual">' + t("payMensual") + '</button>';
  h += '<button style="flex:1;" class="' + (state.payFrequency === "quincenal" ? "active" : "") + '" data-action="setPayQuincenal">' + t("payQuincenal") + '</button>';
  h += '<button style="flex:1;" class="' + (state.payFrequency === "semanal" ? "active" : "") + '" data-action="setPaySemanal">' + t("paySemanal") + '</button>';
  h += '</div>';
  h += '<div class="pay-config"><label>' + t("ultimoPagoLbl") + '</label><input type="date" id="ultimo-pago" data-scope="ultimoPago" value="' + esc(state.ultimoPago) + '"></div>';
  h += '<div class="pay-config"><label>' + t("ajustePagoLbl") + '</label><input type="date" id="ajuste-pago" data-scope="proximoPagoAjuste" value="' + esc(state.proximoPagoAjuste) + '"><p class="opt-row-sub" style="margin-top:4px;">' + t("ajustePagoHint") + '</p></div>';
  h += '</div>';

  h += '<div class="panel"><p class="opt-section-title">' + t("secAhorroPct") + '</p>';
  h += '<div class="seg" style="width:100%;margin-bottom:8px;">';
  h += '<button style="flex:1;" class="' + (state.savingsRate === 10 ? "active" : "") + '" data-action="setAhorroNormal">' + t("ahorroNormal") + '</button>';
  h += '<button style="flex:1;" class="' + (state.savingsRate === 20 ? "active" : "") + '" data-action="setAhorroMedio">' + t("ahorroMedio") + '</button>';
  h += '<button style="flex:1;" class="' + (state.savingsRate === 35 ? "active" : "") + '" data-action="setAhorroAgresivo">' + t("ahorroAgresivo") + '</button>';
  h += '</div>';
  h += '<div class="opt-slider-row"><input type="range" min="0" max="100" id="savings-rate-input" data-scope="savingsRate" value="' + state.savingsRate + '"><div class="opt-slider-val">' + state.savingsRate + '%</div></div></div>';

  h += '<div class="panel"><p class="opt-section-title">' + t("secDatos") + '</p><div class="opt-btn-stack">';
  h += '<button class="pill-btn wide" data-action="showExport">' + t("exportarDatos") + '</button>';
  h += '<button class="pill-btn wide update" data-action="actualizar">' + t("update") + (UPDATE_AVAILABLE ? '<span class="dot"></span>' : '') + '</button>';
  h += '<button class="pill-btn wide" data-action="undo"' + (undoStack.length === 0 ? " disabled" : "") + '>' + t("undo") + '</button>';
  if (!state.confirmReset) {
    h += '<button class="pill-btn wide danger" data-action="confirmReset">' + t("resetAll") + '</button>';
  } else {
    h += '<p style="font-size:12px;color:var(--text-muted);text-align:center;margin:4px 0;">' + t("confirmResetMsg") + '</p>';
    h += '<div style="display:flex;gap:8px;"><button class="pill-btn confirm" style="flex:1;" data-action="resetAll">' + t("yesDelete") + '</button><button class="pill-btn" style="flex:1;" data-action="cancelReset">' + t("cancel") + '</button></div>';
  }
  h += '</div></div>';

  if (state.authUser) {
    h += '<div class="panel"><p class="opt-section-title">' + t("secNube") + '</p>';
    h += '<button class="pill-btn wide danger" data-action="apiDeleteCloudAccount">' + t("eliminarCuentaNubeBtn") + '</button>';
    h += '</div>';
  }

  h += '<div class="panel"><p class="opt-section-title">' + t("secLegal") + '</p><div class="opt-btn-stack">';
  h += '<a class="pill-btn wide" style="text-align:center;text-decoration:none;box-sizing:border-box;" href="privacy.html" target="_blank" rel="noopener">' + t("verPrivacidad") + '</a>';
  h += '<a class="pill-btn wide" style="text-align:center;text-decoration:none;box-sizing:border-box;" href="data-policy.html" target="_blank" rel="noopener">' + t("verDatosPolitica") + '</a>';
  h += '<a class="pill-btn wide" style="text-align:center;text-decoration:none;box-sizing:border-box;" href="terms.html" target="_blank" rel="noopener">' + t("verTerminos") + '</a>';
  h += '<a class="pill-btn wide" style="text-align:center;text-decoration:none;box-sizing:border-box;" href="contact.html" target="_blank" rel="noopener">' + t("verContacto") + '</a>';
  h += '</div></div>';

  return h;
}

function utilBarHtml(uso, usoNivel) {
  const blink = uso >= 30 ? " blink" : "";
  return '<div class="util-bar-track"><div class="util-bar-fill ' + usoNivel + blink + '" style="width:' + uso + '%"></div><div class="util-bar-marker"></div></div>';
}

function renderPagoBlock(type, item, saldoActual) {
  if (toNum(saldoActual) <= 0) return "";
  const isActive = state.payingTarget && state.payingTarget.type === type && state.payingTarget.id === item.id;
  if (!isActive) {
    return '<button class="pay-trigger" data-action="startPago" data-type="' + type + '" data-id="' + item.id + '">' + icon("card") + ' ' + t("pagarBtn") + '</button>';
  }
  const ahorroDisp = toNum(state.ahorroActual);
  const debitoDisp = toNum(state.debito);
  const cashDisp = toNum(state.cash);
  let h = '<div class="pay-form">';
  h += '<p class="opt-row-sub" style="margin-bottom:6px;">' + t("pagarDesdeLbl") + '</p>';
  h += '<div class="seg" style="width:100%;flex-wrap:wrap;">';
  h += '<button style="flex:1 1 30%;" class="' + (state.payFormSource === "ahorro" ? "active" : "") + '" data-action="setPagoSourceAhorro">' + t("ahorroActualLbl") + ' ' + sym() + fmt0(ahorroDisp) + '</button>';
  h += '<button style="flex:1 1 30%;" class="' + (state.payFormSource === "debito" ? "active" : "") + '" data-action="setPagoSourceDebito">' + t("debitoLbl") + ' ' + sym() + fmt0(debitoDisp) + '</button>';
  h += '<button style="flex:1 1 30%;" class="' + (state.payFormSource === "cash" ? "active" : "") + '" data-action="setPagoSourceCash">' + t("cashLbl") + ' ' + sym() + fmt0(cashDisp) + '</button>';
  h += '<button style="flex:1 1 30%;" class="' + (state.payFormSource === "ninguno" ? "active" : "") + '" data-action="setPagoSourceNinguno">' + t("noDescontar") + '</button>';
  h += '</div>';
  h += '<input type="text" inputmode="decimal" placeholder="0" id="pago-monto-' + item.id + '" data-scope="payFormMonto" value="' + esc(state.payFormMonto) + '" style="width:100%;margin-top:8px;font-size:18px;font-weight:700;">';
  h += '<div style="display:flex;gap:8px;margin-top:8px;">';
  h += '<button class="pill-btn confirm" style="flex:1;" data-action="confirmPago">' + t("confirmarPago") + '</button>';
  h += '<button class="pill-btn" style="flex:1;" data-action="cancelPago">' + t("cancel") + '</button>';
  h += '</div></div>';
  return h;
}

function renderTabBar() {
  const tabs = [
    { id: "inicio", icon: "home", label: t("tabInicio") },
    { id: "historial", icon: "receipt", label: t("tabHistorial") },
    { id: "insights", icon: "chart", label: t("tabInsights") },
    { id: "cuentas", icon: "wallet", label: t("tabCuentas") },
    { id: "opciones", icon: "gear", label: t("optionsTitle") },
  ];
  let h = '<div class="tab-bar">';
  tabs.forEach((tb) => {
    h += '<button class="tab-btn' + (state.activeTab === tb.id ? " active" : "") + '" data-action="goTab" data-id="' + tb.id + '"><span class="tab-icon">' + icon(tb.icon) + (tb.id === "opciones" && UPDATE_AVAILABLE ? '<span class="dot" style="top:2px;right:14px;"></span>' : '') + '</span><span class="tab-label">' + esc(tb.label) + '</span></button>';
  });
  h += '</div>';
  return h;
}

function renderApp() {
  const t2 = computeTotals();
  const resultado = t2.ingresoEfectivo > 0 ? computeResultado(t2) : null;
  const metaProgreso = toNum(state.metaAhorro) > 0 ? Math.min((toNum(state.ahorroActual) / toNum(state.metaAhorro)) * 100, 100) : 0;
  const sugerencias = buildSugerencias(t2, resultado);
  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId);
  const np = nextPayInfo();
  const tab = state.activeTab;

  let html = '<div class="page"><div class="wrap">';
  const topAction = computeTopAction(t2, resultado);
  if (topAction) html += '<div class="top-action ' + topAction.level + '">' + esc(topAction.text) + '</div>';
  html += '<div class="app-header"><h1>' + t("brand") + '</h1>';
  html += '</div>';

  if (tab !== "inicio") {
    html += '<div class="tab-subheader"><h2>' + t(tab === "cuentas" ? "tabCuentas" : tab === "insights" ? "tabInsights" : tab === "opciones" ? "optionsTitle" : "tabHistorial") + '</h2></div>';
  }

  if (tab === "inicio") {
    const cloudNoCredit = state.cloudAccounts.filter((a) => a.type !== "credit").reduce((a, c) => a + toNum(c.balance_current), 0);
    const deudaPrestamos = state.loans.reduce((a, l) => a + Math.max(toNum(l.saldoTotal), 0), 0);
    const patrimonioNeto = toNum(state.ahorroActual) + toNum(state.cash) + toNum(state.debito) + cloudNoCredit - t2.totalDeuda - deudaPrestamos;
    html += '<div class="panel" style="text-align:center;">';
    html += '<p class="hint" style="margin-bottom:2px;">' + t("patrimonioNetoLbl") + '</p>';
    html += '<div style="font-size:32px;font-weight:800;letter-spacing:-0.01em;color:' + (patrimonioNeto >= 0 ? "var(--text)" : "#FF3B30") + ';">' + (patrimonioNeto < 0 ? "-" : "") + sym() + fmt0(Math.abs(patrimonioNeto)) + '</div>';
    html += '</div>';
    html += '<div class="summary">';
    html += '<div class="sum-card"><div class="sum-label">' + t("cashLbl") + '</div><div class="sum-val blue">' + sym() + fmt0(toNum(state.cash)) + '</div></div>';
    html += '<div class="sum-card"><div class="sum-label">' + t("debitoLbl") + '</div><div class="sum-val blue">' + sym() + fmt0(toNum(state.debito) + cloudNoCredit) + '</div></div>';
    html += '<div class="sum-card"><div class="sum-label">' + t("debesTotal") + '</div><div class="sum-val red">' + sym() + fmt0(t2.totalDeuda) + '</div></div>';
    html += '<div class="sum-card"><div class="sum-label">' + t("ahorradoActual") + '</div><div class="sum-val green">' + sym() + fmt0(toNum(state.ahorroActual)) + '</div></div>';
    html += '</div>';

    html += '<div class="summary">';
    html += '<div class="sum-card"><div class="sum-label">' + t("disponibleMes") + '</div><div class="sum-val ' + (t2.disponibleBruto >= 0 ? "green" : "red") + '">' + (t2.disponibleBruto >= 0 ? "" : "-") + sym() + fmt0(Math.abs(t2.disponibleBruto)) + '</div><span class="status-pill ' + t2.liveStatus.key + '">' + t2.liveStatus.label + '</span></div>';
    if (t2.cardsConLimite.length > 0 || t2.cloudCardsConLimite.length > 0) html += '<div class="sum-card"><div class="sum-label">' + t("creditoDisponible") + '</div><div class="sum-val green">' + sym() + fmt0(t2.creditoDisponible) + '</div></div>';
    if (np) html += '<div class="sum-card"><div class="sum-label">' + t("proximoPago") + '</div><div class="sum-val blue" style="font-size:16px;">' + esc(diasLabel(np.diffDays)) + '</div><div class="opt-row-sub">' + esc(formatDate(np.date)) + (np.ajustado ? ' ' + icon("pencil") : "") + '</div></div>';
    html += '</div>';

    html += renderBancoNubePanel();

    if (t2.cardsConLimite.length > 0 || t2.cloudCardsConLimite.length > 0) {
      html += '<div class="panel"><h2>' + t("saludCreditoTitle") + '</h2><p class="hint">' + t("saludCreditoHint") + '</p>';
      t2.cardsConLimite.forEach((c) => {
        const uso = Math.min((toNum(c.saldo) / toNum(c.limite)) * 100, 100);
        const usoNivel = uso < 30 ? "verde" : uso < 70 ? "amarillo" : "rojo";
        html += '<div style="margin-bottom:14px;"><div class="history-top" style="margin-bottom:4px;"><span class="history-month" style="text-transform:none;">' + esc(c.nombre || t("cardNombrePh")) + '</span><span class="status-pill ' + usoNivel + '">' + Math.round(uso) + '%</span></div>';
        html += '<div class="opt-row-sub" style="margin-bottom:4px;">' + sym() + fmt0(toNum(c.saldo)) + ' ' + t("deLimiteLbl") + ' ' + sym() + fmt0(toNum(c.limite)) + (toNum(c.apr) > 0 ? ' \u00b7 ' + t("cardAprLbl") + ' ' + c.apr + '%' : '') + '</div>';
        html += utilBarHtml(uso, usoNivel) + '</div>';
      });
      t2.cloudCardsConLimite.forEach((c) => {
        const saldo = toNum(c.balance_current);
        const limite = toNum(c.balance_limit);
        const uso = Math.min((saldo / limite) * 100, 100);
        const usoNivel = uso < 30 ? "verde" : uso < 70 ? "amarillo" : "rojo";
        const liab = state.cloudLiabilities[c.account_id];
        html += '<div style="margin-bottom:14px;"><div class="history-top" style="margin-bottom:4px;"><span class="history-month" style="text-transform:none;">' + esc(c.name || t("cardNombrePh")) + (c.mask ? " ****" + esc(c.mask) : "") + '</span><span class="status-pill ' + usoNivel + '">' + Math.round(uso) + '%</span></div>';
        html += '<div class="opt-row-sub" style="margin-bottom:4px;">' + sym() + fmt0(saldo) + ' ' + t("deLimiteLbl") + ' ' + sym() + fmt0(limite) + (liab && liab.apr ? ' \u00b7 ' + t("cardAprLbl") + ' ' + liab.apr + '%' : '') + '</div>';
        html += utilBarHtml(uso, usoNivel) + '</div>';
      });
      html += '</div>';
    }

    html += '<div class="panel"><div class="panel-head-row"><div><h2>' + t("ingresoTitle") + '</h2><p class="hint" style="margin-bottom:0;">' + (state.payFrequency === "mensual" ? t("ingresoMensualHint") : t("ingresoHint")) + '</p></div><button class="icon-pencil' + (state.editingIngreso ? " done" : "") + '" data-action="toggleEditIngreso">' + (state.editingIngreso ? icon("check") : icon("pencil")) + '</button></div>';
    if (!state.editingIngreso) {
      html += '<div class="sub-row-locked" style="border-bottom:none;"><span class="locked-name">' + t("totalCalculado") + '</span><span class="locked-amount" style="font-size:19px;">' + sym() + fmt0(t2.ingresoEfectivo) + '</span></div>';
    } else if (state.payFrequency === "mensual") {
      html += '<input type="text" inputmode="decimal" placeholder="0" id="ingreso-input" data-scope="ingreso" value="' + esc(state.ingreso) + '" style="width:100%;font-size:20px;font-weight:700;">';
    } else {
      const entradas = ingresosEsteMes();
      const esperados = expectedPagosEsteMes();
      entradas.forEach((en) => {
        html += '<div class="sub-row" style="grid-template-columns:1fr 30px;">';
        html += '<input type="text" inputmode="decimal" placeholder="0" id="ing-' + en.id + '" data-scope="ingresoLog" data-id="' + en.id + '" value="' + esc(en.monto) + '" style="font-size:16px;font-weight:700;">';
        html += '<button class="icon-del" data-action="removeIngresoEntry" data-id="' + en.id + '">' + icon("close") + '</button></div>';
      });
      if (entradas.length === 0) html += '<div class="empty-state">' + t("ingresoLogEmpty") + '</div>';
      html += '<button class="pay-trigger" data-action="addIngresoEntry" style="background:#3D5AFE;">' + t("addIngreso") + '</button>';
      html += '<div class="mini-total"><span>' + t("pagosEsperados")(entradas.length, esperados) + '</span><b>' + sym() + fmt0(t2.ingresoEfectivo) + '</b></div>';
      if (entradas.length < esperados) html += '<p class="opt-row-sub" style="margin-top:8px;color:#B25E00;">' + t("pagosIncompletos") + '</p>';
    }
    html += '</div>';

    if (resultado && resultado.insuficiente) {
      html += '<div class="warn-box"><b>' + t("noAlcanza") + '</b><br>' + t("faltan") + ' <b>' + sym() + fmt0(resultado.faltante) + '</b>.</div>';
    }
    if (resultado && !resultado.insuficiente) {
      html += '<div class="result-card">';
      html += '<div class="result-line"><span>' + t("ingresoLbl") + '</span><span>' + sym() + fmt0(t2.ingresoEfectivo) + '</span></div>';
      html += '<div class="result-line"><span>' + t("pagosFijosLbl") + '</span><span>\u2212' + sym() + fmt0(t2.totalSubs) + '</span></div>';
      if (t2.totalPrestamos > 0) html += '<div class="result-line"><span>' + t("totalPrestamos") + '</span><span>\u2212' + sym() + fmt0(t2.totalPrestamos) + '</span></div>';
      resultado.asignaciones.forEach((c) => {
        html += '<div class="result-line"><span class="name">' + esc(c.nombre || t("tarjetaFallback")) + (c.pagoExtra > 0 ? '<span class="badge">' + t("extraBadge") + '</span>' : '') + '</span><span>\u2212' + sym() + fmt0(c.pagoTotal) + '</span></div>';
      });
      if (state.cards.length === 0) html += '<div class="result-line"><span>' + t("sinTarjetas") + '</span><span>\u2014</span></div>';
      html += '<div class="result-line"><span>' + t("ahorroSugerido") + '</span><span>' + sym() + fmt10(resultado.ahorro) + '</span></div>';
      html += '<div class="result-total"><span>' + t("totalRepartido") + '</span><span>' + sym() + fmt0(t2.ingresoEfectivo) + '</span></div>';
      html += '</div>';
    }

    if (sugerencias.length > 0) {
      html += '<div class="sugerencias"><h2>' + t("sugerenciasTitle") + '</h2><ul>';
      sugerencias.forEach((s) => { html += '<li>' + esc(s) + '</li>'; });
      html += '</ul></div>';
    }

    if (resultado) html += '<button class="save-month-btn" data-action="guardarMes">' + t("guardarMes") + '</button>';
    if (state.savedFlash) html += '<div class="flash">' + icon("check") + ' ' + t("mesGuardado") + '</div>';
    html += '<p class="save-note">' + (state.storageError ? t("saveNoteErr") : t("saveNoteOk")) + ' · ' + APP_VERSION + '</p>';
  }

  if (tab === "cuentas") {
    html += '<div class="panel"><div class="panel-head-row"><div><h2>' + t("tuAhorroTitle") + '</h2><p class="hint" style="margin-bottom:0;">' + t("tuAhorroHint") + '</p></div><button class="icon-pencil' + (state.editingAhorro ? " done" : "") + '" data-action="toggleEditAhorro">' + (state.editingAhorro ? icon("check") : icon("pencil")) + '</button></div>';
    if (!state.editingAhorro) {
      html += '<div class="sub-row-locked"><span class="locked-name">' + t("debitoLbl") + '</span><span class="locked-amount">' + sym() + fmt0(toNum(state.debito)) + '</span></div>';
      html += '<div class="sub-row-locked"><span class="locked-name">' + t("cashLbl") + '</span><span class="locked-amount">' + sym() + fmt0(toNum(state.cash)) + '</span></div>';
      html += '<div class="sub-row-locked"><span class="locked-name">' + t("ahorroActualLbl") + '</span><span class="locked-amount">' + sym() + fmt0(toNum(state.ahorroActual)) + '</span></div>';
      html += '<div class="sub-row-locked" style="border-bottom:none;"><span class="locked-name">' + t("metaAhorroLbl") + '</span><span class="locked-amount">' + sym() + fmt0(toNum(state.metaAhorro)) + '</span></div>';
      if (toNum(state.metaAhorro) > 0) {
        html += '<div class="progress-track"><div class="progress-fill" style="width:' + metaProgreso + '%"></div></div>';
        html += '<div class="goal-caption"><span>' + sym() + fmt0(toNum(state.ahorroActual)) + ' / ' + sym() + fmt0(toNum(state.metaAhorro)) + '</span><span>' + Math.round(metaProgreso) + '%</span></div>';
      }
    } else {
      html += '<div class="goal-field" style="margin-bottom:10px;"><label>' + t("debitoLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="0" id="debito-input" data-scope="debito" value="' + esc(state.debito) + '" style="width:100%;"></div>';
      html += '<div class="goal-field" style="margin-bottom:10px;"><label>' + t("cashLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="0" id="cash-input" data-scope="cash" value="' + esc(state.cash) + '" style="width:100%;"></div>';
      html += '<div class="goal-grid">';
      html += '<div class="goal-field"><label>' + t("ahorroActualLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="0" id="ahorro-actual-input" data-scope="ahorroActual" value="' + esc(state.ahorroActual) + '"></div>';
      html += '<div class="goal-field"><label>' + t("metaAhorroLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="0" id="meta-ahorro-input" data-scope="metaAhorro" value="' + esc(state.metaAhorro) + '"></div>';
      html += '</div>';
      if (toNum(state.metaAhorro) > 0) {
        html += '<div class="progress-track"><div class="progress-fill" style="width:' + metaProgreso + '%"></div></div>';
        html += '<div class="goal-caption"><span>' + sym() + fmt0(toNum(state.ahorroActual)) + ' / ' + sym() + fmt0(toNum(state.metaAhorro)) + '</span><span>' + Math.round(metaProgreso) + '%</span></div>';
      }
    }
    html += '<p class="hint" style="margin-top:10px;">' + t("ahorroPctTitle") + ': <b>' + state.savingsRate + '%</b></p>';
    html += '</div>';

    if (state.autoPagoNotif && state.autoPagoNotif.length > 0) {
      html += '<div class="flash">' + t("autoPagoAplicado")(state.autoPagoNotif.join(", ")) + '</div>';
    }

    const pagosRecibidos = state.cloudTransactions.filter((tx) => toNum(tx.monto) > 0);
    if (pagosRecibidos.length > 0) {
      html += '<div class="panel"><h2>' + t("pagosRecibidosBancoTitle") + '</h2><p class="hint">' + t("pagosRecibidosBancoHint") + '</p>';
      pagosRecibidos.slice(0, 30).forEach((tx) => {
        html += renderTxRow(tx.descripcion, tx.categoria, tx.monto, String(tx.fecha).slice(0, 10));
      });
      html += '</div>';
    }
    html += '<div class="panel"><div class="panel-head-row"><div><p class="hint" style="margin-bottom:0;">' + t("subsHint") + '</p></div><button class="icon-pencil' + (state.editingSubs ? " done" : "") + '" data-action="toggleEditSubs">' + (state.editingSubs ? icon("check") : icon("pencil")) + '</button></div>';
    if (state.editingSubs) {
      html += '<div class="preset-row">';
      SUB_PRESETS.forEach((p) => { html += '<button class="preset-chip" data-action="addSubPreset" data-id="' + p.key + '">' + CATEGORY_ICON[p.cat] + ' ' + t("preset_" + p.key) + '</button>'; });
      html += '</div>';
    }
    state.subs.forEach((s) => {
      if (state.confirmDeleteSubId === s.id) {
        html += '<div class="confirm-row"><span>' + esc(t("confirmDeleteSubMsg")(s.nombre || t("subNombrePh"))) + '</span><div class="confirm-row-btns"><button class="pill-btn confirm" data-action="removeSub" data-id="' + s.id + '">' + t("yesDelete") + '</button><button class="pill-btn" data-action="cancelDeleteSub">' + t("cancel") + '</button></div></div>';
      } else if (state.editingSubs) {
        html += '<div class="sub-row-cat">';
        html += '<input type="text" placeholder="' + t("subNombrePh") + '" id="sub-nombre-' + s.id + '" data-scope="sub" data-id="' + s.id + '" data-field="nombre" value="' + esc(s.nombre) + '">';
        html += '<input type="text" inputmode="decimal" placeholder="' + sym() + '" id="sub-monto-' + s.id + '" data-scope="sub" data-id="' + s.id + '" data-field="monto" value="' + esc(s.monto) + '">';
        html += '<button class="icon-del" data-action="askDeleteSub" data-id="' + s.id + '">' + icon("close") + '</button>';
        html += '<select data-scope="sub" data-id="' + s.id + '" data-field="categoria" style="grid-column:1/3;">';
        CATEGORIES.forEach((c) => { html += '<option value="' + c + '"' + (s.categoria === c ? " selected" : "") + '>' + CATEGORY_ICON[c] + ' ' + t("cat_" + c) + '</option>'; });
        html += '</select>';
        html += '</div>';
      } else {
        const pagado = s.pagadoMes === monthKey();
        if (state.payingSubId === s.id) {
          html += '<div class="pay-form" style="margin:8px 0;">';
          html += '<p class="opt-row-sub" style="margin-bottom:6px;">' + esc(s.nombre || t("subNombrePh")) + ' \u00b7 ' + t("pagarDesdeLbl") + '</p>';
          html += '<div class="seg" style="width:100%;flex-wrap:wrap;">';
          html += '<button style="flex:1 1 30%;" class="' + (state.payFormSource === "ahorro" ? "active" : "") + '" data-action="setPagoSourceAhorro">' + t("ahorroActualLbl") + ' ' + sym() + fmt0(toNum(state.ahorroActual)) + '</button>';
          html += '<button style="flex:1 1 30%;" class="' + (state.payFormSource === "debito" ? "active" : "") + '" data-action="setPagoSourceDebito">' + t("debitoLbl") + ' ' + sym() + fmt0(toNum(state.debito)) + '</button>';
          html += '<button style="flex:1 1 30%;" class="' + (state.payFormSource === "cash" ? "active" : "") + '" data-action="setPagoSourceCash">' + t("cashLbl") + ' ' + sym() + fmt0(toNum(state.cash)) + '</button>';
          html += '<button style="flex:1 1 30%;" class="' + (state.payFormSource === "ninguno" ? "active" : "") + '" data-action="setPagoSourceNinguno">' + t("noDescontar") + '</button>';
          html += '</div>';
          html += '<input type="text" inputmode="decimal" placeholder="0" id="pago-sub-monto-' + s.id + '" data-scope="payFormMonto" value="' + esc(state.payFormMonto) + '" style="width:100%;margin-top:8px;font-size:18px;font-weight:700;">';
          html += '<div style="display:flex;gap:8px;margin-top:8px;">';
          html += '<button class="pill-btn confirm" style="flex:1;" data-action="confirmPagoSub">' + t("confirmarPago") + '</button>';
          html += '<button class="pill-btn" style="flex:1;" data-action="cancelPagoSub">' + t("cancel") + '</button>';
          html += '</div></div>';
        } else {
          html += '<div class="sub-row-locked"><span class="locked-name" style="display:flex;align-items:center;gap:8px;"><button class="paid-check' + (pagado ? " checked" : "") + '" data-action="toggleSubPagado" data-id="' + s.id + '">' + (pagado ? icon("check") : "") + '</button>' + (CATEGORY_ICON[s.categoria] || CATEGORY_ICON.otro) + ' ' + esc(s.nombre || t("subNombrePh")) + '</span><span class="locked-amount"' + (pagado ? ' style="text-decoration:line-through;opacity:0.5;"' : '') + '>' + sym() + fmt0(toNum(s.monto)) + '</span></div>';
        }
      }
    });
    if (state.subs.length === 0 && !state.editingSubs) html += '<div class="empty-state">' + t("subsEmpty") + '</div>';
    if (state.editingSubs) html += '<button class="add-btn" data-action="addSub">' + t("addSub") + '</button>';
    if (state.subs.length > 0) {
      const pagadosCount = state.subs.filter((s) => s.pagadoMes === monthKey()).length;
      html += '<div class="mini-total"><span>' + t("subsPagados")(pagadosCount, state.subs.length) + '</span></div>';
    }
    html += '<div class="mini-total"><span>' + t("totalPagosFijos") + '</span><b>' + sym() + fmt0(t2.totalSubs) + '</b></div></div>';

    html += '<div class="panel"><div class="panel-head-row"><div><h2>' + t("loansTitle") + '</h2><p class="hint" style="margin-bottom:0;">' + t("loansHint") + '</p></div><button class="icon-pencil' + (state.editingLoans ? " done" : "") + '" data-action="toggleEditLoans">' + (state.editingLoans ? icon("check") : icon("pencil")) + '</button></div>';
    state.loans.forEach((l) => {
      const saldo = toNum(l.saldoTotal);
      const original = toNum(l.montoOriginal);
      const pago = toNum(l.montoPago);
      const pagado = saldo <= 0;
      const pagosRestantes = pago > 0 ? Math.ceil(saldo / pago) : 0;
      const interesEstimado = pago > 0 ? Math.max(pagosRestantes * pago - saldo, 0) : 0;
      const np = pago > 0 && !pagado ? nextGenericPayInfo(l.ultimoPago, l.frecuencia) : null;
      const progreso = original > 0 ? Math.min(((original - saldo) / original) * 100, 100) : null;

      if (state.confirmDeleteLoanId === l.id) {
        html += '<div class="card-entry"><div class="confirm-row"><span>' + esc(t("confirmDeleteLoanMsg")(l.nombre || t("loanNombrePh"))) + '</span><div class="confirm-row-btns"><button class="pill-btn confirm" data-action="removeLoan" data-id="' + l.id + '">' + t("yesDelete") + '</button><button class="pill-btn" data-action="cancelDeleteLoan">' + t("cancel") + '</button></div></div></div>';
        return;
      }

      if (!state.editingLoans) {
        html += '<div class="card-entry"><div class="card-collapsed-top"><span class="card-collapsed-name">' + esc(l.nombre || t("loanNombrePh")) + (l.automatico ? ' <span class="status-pill verde" style="font-size:9.5px;">' + t("loanAutoBadge") + '</span>' : '') + '</span>' + (pagado ? '<span class="status-pill verde">' + t("loanPagado") + '</span>' : '<span class="status-pill amarillo">' + t("loanQuedan")(pagosRestantes) + '</span>') + '</div>';
        html += '<div class="card-collapsed-balance"><span class="field-label">' + t("loanSaldoLbl") + ' ' + sym() + '</span><span class="locked-amount" style="font-size:19px;">' + sym() + fmt0(saldo) + '</span></div>';
        if (progreso !== null) {
          html += '<div class="progress-track"><div class="progress-fill" style="width:' + progreso + '%"></div></div>';
          html += '<div class="goal-caption"><span>' + sym() + fmt0(original - saldo) + ' ' + t("loanPagadoDe") + ' ' + sym() + fmt0(original) + '</span><span>' + Math.round(progreso) + '%</span></div>';
        }
        if (!pagado && interesEstimado > 0) html += '<div class="opt-row-sub" style="margin-top:6px;">' + t("loanInteresEstimado")(fmt0(interesEstimado)) + '</div>';
        if (np) html += '<div class="opt-row-sub" style="margin-top:4px;">' + t("proximoPago") + ': ' + esc(diasLabel(np.diffDays)) + ' \u00b7 ' + esc(formatDate(np.date)) + '</div>';
        html += renderPagoBlock("loan", l, saldo);
        html += '</div>';
      } else {
        html += '<div class="card-entry">';
        html += '<div class="card-entry-top"><input type="text" placeholder="' + t("loanNombrePh") + '" id="loan-nombre-' + l.id + '" data-scope="loan" data-id="' + l.id + '" data-field="nombre" value="' + esc(l.nombre) + '">';
        html += '<button class="icon-del" data-action="askDeleteLoan" data-id="' + l.id + '">' + icon("close") + '</button></div>';
        html += '<div class="card-fields">';
        html += '<div><span class="field-label">' + t("loanMontoOriginalLbl") + ' ' + sym() + '</span><input type="text" inputmode="decimal" placeholder="' + t("limiteOpcionalPh") + '" id="loan-original-' + l.id + '" data-scope="loan" data-id="' + l.id + '" data-field="montoOriginal" value="' + esc(l.montoOriginal) + '"></div>';
        html += '<div><span class="field-label">' + t("loanSaldoLbl") + ' ' + sym() + '</span><input type="text" inputmode="decimal" placeholder="0" id="loan-saldo-' + l.id + '" data-scope="loan" data-id="' + l.id + '" data-field="saldoTotal" value="' + esc(l.saldoTotal) + '"></div>';
        html += '<div><span class="field-label">' + t("loanMontoLbl") + ' ' + sym() + '</span><input type="text" inputmode="decimal" placeholder="0" id="loan-monto-' + l.id + '" data-scope="loan" data-id="' + l.id + '" data-field="montoPago" value="' + esc(l.montoPago) + '"></div>';
        html += '<div><span class="field-label">' + t("loanTasaLbl") + '</span><input type="text" inputmode="decimal" placeholder="0" id="loan-tasa-' + l.id + '" data-scope="loan" data-id="' + l.id + '" data-field="tasa" value="' + esc(l.tasa) + '"></div>';
        html += '</div>';
        html += '<div class="pay-config" style="margin-top:8px;"><label>' + t("loanFrecLbl") + '</label><div class="seg" style="width:100%;">';
        [["semanal", "paySemanal"], ["quincenal", "payQuincenal"], ["mensual", "payMensual"]].forEach((f) => { html += '<button style="flex:1;" class="' + (l.frecuencia === f[0] ? "active" : "") + '" data-action="setLoanFrec" data-id="' + l.id + '" data-freq="' + f[0] + '">' + t(f[1]) + '</button>'; });
        html += '</div></div>';
        html += '<div class="pay-config"><label>' + t("loanUltimoPagoLbl") + '</label><input type="date" id="loan-ultimo-' + l.id + '" data-scope="loan" data-id="' + l.id + '" data-field="ultimoPago" value="' + esc(l.ultimoPago) + '"></div>';
        html += '<div class="pay-config"><label>' + t("loanAutoLbl") + '</label><div class="seg" style="width:100%;"><button style="flex:1;" class="' + (!l.automatico ? "active" : "") + '" data-action="loanAutoOff" data-id="' + l.id + '">' + t("off") + '</button><button style="flex:1;" class="' + (l.automatico ? "active" : "") + '" data-action="loanAutoOn" data-id="' + l.id + '">' + t("on") + '</button></div></div>';
        if (l.automatico) html += '<div class="pay-config"><label>' + t("pagarDesdeLbl") + '</label><div class="seg" style="width:100%;"><button style="flex:1;" class="' + (l.fuenteAutomatica === "ahorro" ? "active" : "") + '" data-action="loanFuenteAhorro" data-id="' + l.id + '">' + t("ahorroActualLbl") + '</button><button style="flex:1;" class="' + (l.fuenteAutomatica === "debito" ? "active" : "") + '" data-action="loanFuenteDebito" data-id="' + l.id + '">' + t("debitoLbl") + '</button></div><p class="opt-row-sub" style="margin-top:4px;">' + t("loanAutoHint") + '</p></div>';
        if (pago > 0 && saldo > 0) {
          html += '<p class="opt-row-sub" style="margin-top:8px;">' + t("loanQuedan")(pagosRestantes) + '</p>';
          if (interesEstimado > 0) html += '<p class="opt-row-sub">' + t("loanInteresEstimado")(fmt0(interesEstimado)) + '</p>';
        }
        html += '</div>';
      }
    });
    if (state.loans.length === 0) html += '<div class="empty-state">' + t("loanEmpty") + '</div>';
    if (state.editingLoans) html += '<button class="add-btn" data-action="addLoan">' + t("addLoan") + '</button>';
    const totalPrestamos = state.loans.reduce((a, l) => a + (toNum(l.saldoTotal) > 0 ? toNum(l.montoPago) : 0), 0);
    html += '<div class="mini-total"><span>' + t("totalPrestamos") + '</span><b>' + sym() + fmt0(totalPrestamos) + '</b></div></div>';
  }


  if (tab === "cuentas") {
    if (state.payFlash) html += '<div class="flash">' + icon("check") + ' ' + t("pagoRegistrado") + '</div>';

    const cloudCards = cloudCreditCards();
    if (cloudCards.length > 0) {
      html += '<div class="panel"><h2>' + t("tarjetasNubeTitle") + '</h2><p class="hint">' + t("tarjetasNubeHint") + '</p>';
      cloudCards.forEach((c) => {
        const saldo = toNum(c.balance_current);
        const limite = toNum(c.balance_limit);
        const uso = limite > 0 ? Math.min((saldo / limite) * 100, 100) : null;
        const usoNivel = uso === null ? "verde" : uso < 30 ? "verde" : uso < 70 ? "amarillo" : "rojo";
        const liab = state.cloudLiabilities[c.account_id];
        html += '<div class="card-entry">';
        html += '<div class="card-collapsed-top"><span class="card-collapsed-name">' + esc(c.name || t("cardNombrePh")) + (c.mask ? " ****" + esc(c.mask) : "") + '</span>' + (uso !== null ? '<span class="status-pill ' + usoNivel + '">' + Math.round(uso) + '%</span>' : "") + '</div>';
        html += '<div class="card-collapsed-balance"><span class="field-label">' + t("debesAhoraLbl") + ' ' + sym() + '</span><span class="locked-amount" style="font-size:19px;">' + sym() + fmt0(saldo) + '</span></div>';
        if (limite > 0) html += utilBarHtml(uso, usoNivel);
        if (liab) {
          html += '<div class="opt-row-sub" style="margin-top:6px;">';
          if (liab.apr) html += t("cardAprLbl") + ': ' + liab.apr + '% \u00b7 ';
          if (liab.pago_minimo != null) html += t("cardMinimoLbl") + ': ' + sym() + fmt0(toNum(liab.pago_minimo));
          html += '</div>';
          if (liab.fecha_limite) html += '<div class="opt-row-sub">' + t("proximoPago") + ': ' + esc(liab.fecha_limite) + '</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    }
    html += '<div class="panel"><div class="panel-head-row"><p class="hint" style="margin-bottom:0;">' + t("cardsHint") + '</p><button class="icon-pencil' + (state.editingCards ? " done" : "") + '" data-action="toggleEditCards">' + (state.editingCards ? icon("check") : icon("pencil")) + '</button></div>';
    if (!state.editingCards) {
      state.cards.forEach((c) => {
        html += '<div class="sub-row-locked"><span class="locked-name">' + esc(c.nombre || t("cardNombrePh")) + '</span><span class="locked-amount">' + sym() + fmt0(toNum(c.saldo)) + '</span></div>';
      });
      if (state.cards.length === 0) html += '<div class="empty-state">' + t("cardsEmpty") + '</div>';
      html += '<div class="mini-total"><span>' + t("totalMinimos") + '</span><b>' + sym() + fmt0(t2.totalMinimos) + '</b></div></div>';
    } else {
    state.cards.forEach((c) => {
      const lim = toNum(c.limite);
      const saldo = toNum(c.saldo);
      const uso = lim > 0 ? Math.min((saldo / lim) * 100, 100) : null;
      const usoNivel = uso === null ? "" : uso < 30 ? "verde" : uso < 70 ? "amarillo" : "rojo";

      if (state.confirmDeleteCardId === c.id) {
        html += '<div class="card-entry"><div class="confirm-row"><span>' + esc(t("confirmDeleteCardMsg")(c.nombre || t("cardNombrePh"))) + '</span><div class="confirm-row-btns"><button class="pill-btn confirm" data-action="removeCard" data-id="' + c.id + '">' + t("yesDelete") + '</button><button class="pill-btn" data-action="cancelDeleteCard">' + t("cancel") + '</button></div></div></div>';
        return;
      }

      if (state.expandedCardIds[c.id]) {
        html += '<div class="card-entry">';
        html += '<div class="card-entry-top"><input type="text" placeholder="' + t("cardNombrePh") + '" id="card-nombre-' + c.id + '" data-scope="card" data-id="' + c.id + '" data-field="nombre" value="' + esc(c.nombre) + '">';
        html += '<button class="icon-pencil done" data-action="toggleCardExpand" data-id="' + c.id + '">' + icon("check") + '</button></div>';
        html += '<div class="card-fields">';
        html += '<div><span class="field-label">' + t("saldoLbl") + ' ' + sym() + '</span><input type="text" inputmode="decimal" placeholder="0" id="card-saldo-' + c.id + '" data-scope="card" data-id="' + c.id + '" data-field="saldo" value="' + esc(c.saldo) + '"></div>';
        html += '<div><span class="field-label">' + t("limiteLbl") + ' ' + sym() + '</span><input type="text" inputmode="decimal" placeholder="' + t("limiteOpcionalPh") + '" id="card-limite-' + c.id + '" data-scope="card" data-id="' + c.id + '" data-field="limite" value="' + esc(c.limite) + '"></div>';
        html += '<div><span class="field-label">' + t("taeLbl") + '</span><input type="text" inputmode="decimal" placeholder="0" id="card-apr-' + c.id + '" data-scope="card" data-id="' + c.id + '" data-field="apr" value="' + esc(c.apr) + '"></div>';
        html += '<div><span class="field-label">' + t("minimoLbl") + ' ' + sym() + '</span><input type="text" inputmode="decimal" placeholder="0" id="card-minimo-' + c.id + '" data-scope="card" data-id="' + c.id + '" data-field="minimo" value="' + esc(c.minimo) + '"></div>';
        html += '</div>';
        if (uso !== null) {
          html += utilBarHtml(uso, usoNivel);
          html += '<div class="util-label">' + t("usoLimite") + Math.round(uso) + '%</div>';
        }
        html += renderPagoBlock('card', c, c.saldo);
        html += '<button class="delete-link" data-action="askDeleteCard" data-id="' + c.id + '">' + t("deleteCardLink") + '</button>';
        html += '</div>';
      } else {
        html += '<div class="card-entry">';
        html += '<div class="card-collapsed-top"><span class="card-collapsed-name">' + esc(c.nombre || t("cardNombrePh")) + '</span><button class="icon-pencil" data-action="toggleCardExpand" data-id="' + c.id + '">' + icon("pencil") + '</button></div>';
        html += '<div class="card-collapsed-balance"><span class="field-label">' + t("debesAhoraLbl") + ' ' + sym() + '</span><input type="text" inputmode="decimal" placeholder="0" id="card-saldo-' + c.id + '" data-scope="card" data-id="' + c.id + '" data-field="saldo" value="' + esc(c.saldo) + '" style="font-size:19px;font-weight:800;"></div>';
        if (uso !== null) {
          html += utilBarHtml(uso, usoNivel);
          html += '<div class="util-label">' + t("usoLimite") + Math.round(uso) + '%</div>';
        }
        html += renderPagoBlock('card', c, c.saldo);
        html += '</div>';
      }
    });
    if (state.cards.length === 0) html += '<div class="empty-state">' + t("cardsEmpty") + '</div>';
    html += '<button class="add-btn" data-action="addCard">' + t("addCard") + '</button>';
    html += '<div class="mini-total"><span>' + t("totalMinimos") + '</span><b>' + sym() + fmt0(t2.totalMinimos) + '</b></div></div>';
    }
  }

  if (tab === "insights") {
    const ins = computeInsights();
    html += '<div class="panel">';
    html += '<h2>' + t("gastoMesTitle") + '</h2>';
    html += '<div class="mini-total"><span>' + t("esteMesLbl") + '</span><b class="locked-amount">' + sym() + fmt0(ins.totalActual) + '</b></div>';
    if (ins.cambioPct !== null) {
      const subio = ins.cambioPct > 0;
      html += '<p class="opt-row-sub" style="color:' + (subio ? "#FF3B30" : "#34C759") + ';margin-top:6px;">' + t(subio ? "gastasteMasMsg" : "gastasteMenosMsg")(Math.round(Math.abs(ins.cambioPct))) + '</p>';
    }
    if (ins.topCategoria) html += '<p class="opt-row-sub" style="margin-top:4px;">' + t("mayorGastoMsg")(t("cat_" + ins.topCategoria), sym() + fmt0(ins.topMonto)) + '</p>';
    html += '</div>';

    if (ins.suscripcionesDetectadas.length > 0) {
      html += '<div class="panel"><h2>' + t("suscripcionesDetectadasTitle") + '</h2><p class="hint">' + t("suscripcionesDetectadasHint") + '</p>';
      ins.suscripcionesDetectadas.forEach((s) => {
        html += '<div class="sub-row-locked"><span class="locked-name">' + esc(s.nombre) + '</span><span class="locked-amount">' + sym() + fmt0(s.monto) + '</span></div>';
      });
      const totalSuscripciones = ins.suscripcionesDetectadas.reduce((a, s) => a + s.monto, 0);
      html += '<div class="mini-total"><span>' + t("totalSuscripcionesLbl") + '</span><b>' + sym() + fmt0(totalSuscripciones) + '</b></div>';
      html += '</div>';
    }

    const resultado2 = t2.ingresoEfectivo > 0 ? computeResultado(t2) : null;
    const consejos = buildSugerencias(t2, resultado2);
    if (consejos.length > 0) {
      html += '<div class="panel"><h2>' + t("consejosTitle") + '</h2>';
      consejos.forEach((c) => { html += '<p class="opt-row-sub" style="margin-bottom:8px;">\u2022 ' + esc(c) + '</p>'; });
      html += '</div>';
    }
    if (ins.suscripcionesDetectadas.length === 0 && consejos.length === 0 && !ins.topCategoria) {
      html += '<div class="empty-state">' + t("insightsEmpty") + '</div>';
    }
  }

  if (tab === "historial") {
    html += '<div class="panel"><p class="hint">' + t("historialHint") + '</p>';
    if (state.history.length === 0) html += '<div class="empty-state">' + t("historialEmpty") + '</div>';
    state.history.forEach((h) => {
      const label = h.status === "verde" ? t("statusVerde") : h.status === "amarillo" ? t("statusAmarillo") : t("statusRojo");
      const metaLine = t("comprometidoDe").split("{s}").join(sym()).split("{a}").join(fmt0(h.comprometido)).split("{b}").join(fmt0(h.ingreso)).split("{c}").join(fmt0(h.ahorro));
      html += '<div class="history-row"><div class="history-top"><span class="history-month">' + esc(monthLabel(h.month)) + '</span><span class="status-pill ' + h.status + '">' + label + '</span></div>';
      html += '<div class="hbar-track"><div class="hbar-fill util-bar-fill ' + h.status + '" style="width:' + Math.min(h.ratio * 100, 100) + '%"></div></div>';
      if (state.confirmDeleteHistoryKey === h.month) {
        html += '<div class="history-meta"><span>' + esc(t("confirmDeleteHistoryMsg")(monthLabel(h.month))) + '</span><div class="confirm-row-btns"><button class="pill-btn confirm" data-action="removeHistory" data-id="' + h.month + '">' + t("yesDelete") + '</button><button class="pill-btn" data-action="cancelDeleteHistory">' + t("cancel") + '</button></div></div></div>';
      } else {
        html += '<div class="history-meta"><span>' + esc(metaLine) + '</span><button class="history-del" data-action="askDeleteHistory" data-id="' + h.month + '">' + t("eliminar") + '</button></div></div>';
      }
    });
    html += '</div>';

    const compras = state.cloudTransactions.filter((tx) => toNum(tx.monto) < 0);
    if (compras.length > 0) {
      html += '<div class="panel"><h2>' + t("comprasTitle") + '</h2><p class="hint">' + t("comprasHint") + '</p>';
      compras.slice(0, 60).forEach((tx) => {
        html += renderTxRow(tx.descripcion, tx.categoria, tx.monto, String(tx.fecha).slice(0, 10));
      });
      html += '</div>';
    }
  }

  if (tab === "opciones") {
    html += renderOpcionesTab();
  }

  html += '</div>';
  html += renderTabBar();
  if (state.showExport) html += renderExportSheet();
  if (state.showConsentimiento) html += renderConsentimientoSheet();
  html += '</div>';

  root.innerHTML = html;
}

function render() {
  applyTheme();
  document.documentElement.lang = state.lang;
  if (state.screen === "selector") renderSelector(); else renderApp();
}

function rerenderPreservingFocus() {
  const active = document.activeElement;
  let info = null;
  if (active && active.id && root.contains(active)) info = { id: active.id, start: active.selectionStart, end: active.selectionEnd };
  render();
  if (info) {
    const el = document.getElementById(info.id);
    if (el) {
      el.focus();
      if (typeof info.start === "number" && el.setSelectionRange) { try { el.setSelectionRange(info.start, info.end); } catch (e) {} }
    }
  }
}
