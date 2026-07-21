"use strict";

const root = document.getElementById("root");

function renderBancoNubePanel(compact) {
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
  if (state.cloudLastSync) html += '<p class="opt-row-sub" style="text-align:center;margin-top:8px;">' + t("ultimaActualizacionLbl") + ': ' + esc(new Date(state.cloudLastSync).toLocaleString(LANG === "es" ? "es-ES" : "en-US")) + '</p>';

  if (state.cloudAccounts.length > 0 && !compact) {
    html += '<div class="mini-total" style="margin-top:10px;"><span>' + t("cuentasConectadasLbl") + '</span></div>';
    state.cloudAccounts.forEach((acc) => {
      html += '<div class="sub-row-locked"><span class="locked-name">' + esc(acc.name || "") + (acc.mask ? " ****" + esc(acc.mask) : "") + '</span><span class="locked-amount">' + sym() + fmt0(toNum(acc.balance_current)) + '</span></div>';
    });
  }
  if (state.cloudTransactions.length > 0 && !compact) {
    state.cloudTransactions.slice(0, 8).forEach((tx) => {
      html += renderTxRow(tx.descripcion, tx.categoria, tx.monto, String(tx.fecha).slice(0, 10), "", tx.id);
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

function renderTxDetalleSheet() {
  const tx = state.cloudTransactions.find((t) => t.id === state.showTxDetalle);
  if (!tx) return "";
  const comp = comparaConPromedioCategoria(tx);
  let h = '<div class="options-overlay">';
  h += '<div class="options-sheet">';
  h += '<div class="options-head"><h2>' + esc(tx.descripcion) + '</h2><button class="options-close" data-action="cerrarDetalleTx">' + icon("close") + '</button></div>';
  h += renderTxChip(tx.categoria);
  h += '<div style="font-size:26px;font-weight:800;margin:10px 0;">' + (toNum(tx.monto) > 0 ? "+" : "\u2212") + sym() + fmt0(Math.abs(toNum(tx.monto))) + '</div>';
  h += '<div class="opt-row"><span class="opt-row-label">' + t("categoriaDetalleLbl") + '</span><span>' + t("cat_" + (tx.categoria || "otros")) + '</span></div>';
  h += '<div class="opt-row"><span class="opt-row-label">' + t("fechaDetalleLbl") + '</span><span>' + esc(String(tx.fecha).slice(0, 10)) + '</span></div>';
  if (tx.account_name) h += '<div class="opt-row"><span class="opt-row-label">' + t("cuentaDetalleLbl") + '</span><span>' + esc(tx.account_name) + (tx.account_mask ? " ****" + esc(tx.account_mask) : "") + '</span></div>';
  if (tx.merchant_name) h += '<div class="opt-row"><span class="opt-row-label">' + t("comercioDetalleLbl") + '</span><span>' + esc(tx.merchant_name) + '</span></div>';
  if (tx.pendiente) h += '<div class="opt-row"><span class="opt-row-label">' + t("estadoDetalleLbl") + '</span><span class="status-pill amarillo">' + t("pendienteLbl") + '</span></div>';
  if (comp) {
    const subio = comp.pct > 0;
    h += '<p class="opt-row-sub" style="margin-top:10px;color:' + (subio ? "#FF3B30" : "#34C759") + ';">' + t(subio ? "gastoMayorPromedioMsg" : "gastoMenorPromedioMsg")(Math.round(Math.abs(comp.pct))) + '</p>';
  }
  h += '<div class="goal-field" style="margin-top:12px;"><label>' + t("notaDetalleLbl") + '</label><input type="text" placeholder="' + t("notaDetallePh") + '" id="tx-nota-input" data-scope="txNota" data-id="' + tx.id + '" value="' + esc(state.notasTransacciones[tx.id] || "") + '" style="width:100%;"></div>';
  if (toNum(tx.monto) < 0) {
    h += '<div class="pay-config" style="margin-top:10px;"><label>' + t("marcarSuscripcionLbl") + '</label>';
    h += '<div class="seg" style="width:100%;flex-wrap:wrap;">';
    [["semanal", "paySemanal"], ["quincenal", "payQuincenal"], ["mensual", "payMensual"], ["anual", "freqAnual"]].forEach((f) => {
      h += '<button style="flex:1 1 45%;" data-action="marcarComoSuscripcion" data-id="' + tx.id + '" data-freq="' + f[0] + '">' + t(f[1]) + '</button>';
    });
    h += '</div></div>';
  }
  if (toNum(tx.monto) < 0) {
    if (state.showMarcarGastoFijo) {
      h += '<div class="pay-config" style="margin-top:10px;"><label>' + t("nombreGastoFijoLbl") + '</label>';
      h += '<input type="text" placeholder="' + t("nombreGastoFijoPh") + '" id="nombre-gasto-fijo-input" data-scope="nombreGastoFijoTemp" value="' + esc(state.nombreGastoFijoTemp) + '" style="width:100%;">';
      h += '<div style="display:flex;gap:8px;margin-top:8px;"><button class="pill-btn confirm" style="flex:1;" data-action="confirmarGastoFijo">' + t("guardarBtn") + '</button><button class="pill-btn" style="flex:1;" data-action="cancelarMarcarGastoFijo">' + t("cancel") + '</button></div>';
      h += '</div>';
    } else {
      h += '<button class="delete-link" style="display:block;margin-top:10px;" data-action="abrirMarcarGastoFijo">' + t("marcarGastoFijoLbl") + '</button>';
    }
  }
  h += '</div></div>';
  return h;
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
function renderTxRow(descripcion, categoria, monto, fecha, rightExtraHtml, txId) {
  const positivo = toNum(monto) > 0;
  const tieneNota = txId && state.notasTransacciones[txId];
  let h = '<div class="history-row"' + (txId ? ' data-action="verDetalleTx" data-id="' + txId + '" style="cursor:pointer;"' : '') + '><div class="tx-row">';
  h += renderTxChip(categoria);
  h += '<div class="tx-row-main"><div class="tx-row-top"><span class="tx-row-name">' + esc(descripcion) + (tieneNota ? ' ' + icon("pencil") : "") + '</span><span class="locked-amount" style="color:' + (positivo ? "#34C759" : "var(--text)") + ';white-space:nowrap;">' + (positivo ? "+" : "\u2212") + sym() + fmt0(Math.abs(toNum(monto))) + '</span></div>';
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
    h += renderBancoNubePanel(true);

    h += '<div class="panel"><div class="panel-head-row"><div><h2>' + t("saldosManualesTitle") + '</h2></div><button class="icon-pencil' + (state.editingAhorro ? " done" : "") + '" data-action="toggleEditAhorro">' + (state.editingAhorro ? icon("check") : icon("pencil")) + '</button></div>';
    if (!state.editingAhorro) {
      h += '<div class="sub-row-locked"><span class="locked-name">' + t("debitoLbl") + '</span><span class="locked-amount">' + sym() + fmt0(toNum(state.debito)) + '</span></div>';
      h += '<div class="sub-row-locked"><span class="locked-name">' + t("cashLbl") + '</span><span class="locked-amount">' + sym() + fmt0(toNum(state.cash)) + '</span></div>';
      h += '<div class="sub-row-locked" style="border-bottom:none;"><span class="locked-name">' + t("ahorroActualLbl") + '</span><span class="locked-amount">' + sym() + fmt0(toNum(state.ahorroActual)) + '</span></div>';
    } else {
      h += '<div class="goal-grid">';
      h += '<div class="goal-field"><label>' + t("debitoLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="0" id="debito-input" data-scope="debito" value="' + esc(state.debito) + '"></div>';
      h += '<div class="goal-field"><label>' + t("cashLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="0" id="cash-input" data-scope="cash" value="' + esc(state.cash) + '"></div>';
      h += '</div>';
      h += '<div class="goal-field" style="margin-top:10px;"><label>' + t("ahorroActualLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="0" id="ahorro-actual-input" data-scope="ahorroActual" value="' + esc(state.ahorroActual) + '" style="width:100%;"></div>';
    }
    h += '</div>';

  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId);
  h += '<div class="panel"><p class="opt-section-title">' + t("secPerfil") + '</p>';
  h += '<div class="opt-row"><span class="opt-row-label">' + esc(activeProfile ? activeProfile.nombre : "") + '</span><button class="pill-btn" data-action="switchUser">' + t("switchUser") + '</button></div>';
  if (state.confirmDeleteProfileId === state.activeProfileId) {
    h += '<div class="confirm-row" style="margin-top:8px;"><span>' + t("confirmEliminarCuentaMsg") + '</span><div class="confirm-row-btns"><button class="pill-btn confirm" data-action="deleteProfile" data-id="' + state.activeProfileId + '">' + t("yesDelete") + '</button><button class="pill-btn" data-action="cancelDeleteProfile">' + t("cancel") + '</button></div></div>';
  } else {
    h += '<button class="pill-btn danger wide" style="margin-top:8px;width:100%;" data-action="askDeleteProfile" data-id="' + state.activeProfileId + '">' + t("eliminarCuentaBtn") + '</button>';
  }
  h += '</div>';

  h += '<div class="panel"><p class="opt-section-title">' + t("secPreferencias") + '</p><div class="opt-row"><span class="opt-row-label">' + t("secIdioma") + '</span><div class="seg"><button class="' + (state.lang === "es" ? "active" : "") + '" data-action="setLangEs">ES</button><button class="' + (state.lang === "en" ? "active" : "") + '" data-action="setLangEn">EN</button></div></div>';
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

function renderDonutChart(items) {
  const total = items.reduce((a, it) => a + it.valor, 0);
  if (total <= 0) return "";
  let acc = 0;
  const stops = items.map((it) => {
    const color = categoriaIconoColor(it.categoria).color;
    const start = (acc / total) * 100;
    acc += it.valor;
    const end = (acc / total) * 100;
    return color + " " + start.toFixed(2) + "% " + end.toFixed(2) + "%";
  }).join(", ");
  let h = '<div style="display:flex;align-items:center;gap:16px;margin-top:8px;">';
  h += '<div style="width:120px;height:120px;border-radius:50%;flex-shrink:0;background:conic-gradient(' + stops + ');"></div>';
  h += '<div style="flex:1;min-width:0;">';
  items.forEach((it) => {
    const pct = Math.round((it.valor / total) * 100);
    const color = categoriaIconoColor(it.categoria).color;
    h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;font-size:11.5px;">';
    h += '<span style="width:9px;height:9px;border-radius:50%;background:' + color + ';flex-shrink:0;"></span>';
    h += '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(it.etiqueta) + '</span>';
    h += '<b>' + pct + '%</b>';
    h += '</div>';
  });
  h += '</div></div>';
  return h;
}

function renderBarChart(items, height, clickAction) {
  height = height || 90;
  const max = Math.max(...items.map((i) => i.valor), 1);
  let h = '<div style="display:flex;align-items:flex-end;gap:6px;height:' + height + 'px;margin:8px 0;">';
  items.forEach((it) => {
    const barH = Math.max((it.valor / max) * (height - 18), 2);
    const attrs = clickAction ? ' data-action="' + clickAction + '" data-id="' + esc(it.monthKey || "") + '" style="cursor:pointer;"' : '';
    h += '<div' + attrs + ' style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;' + (clickAction ? "cursor:pointer;" : "") + '">';
    h += '<div style="width:100%;max-width:28px;height:' + barH + 'px;background:#3D5AFE;border-radius:4px 4px 0 0;"></div>';
    h += '<div style="font-size:9.5px;color:var(--text-muted);margin-top:4px;white-space:nowrap;">' + esc(it.etiqueta) + '</div>';
    h += '</div>';
  });
  h += '</div>';
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

    if (t2.disponibleBruto > 0) {
      const debitoBase = toNum(state.debito) + cloudNoCredit;
      const sugGustos = debitoBase * 0.2;
      const resultadoMes = t2.ingresoEfectivo > 0 ? computeResultado(t2) : null;
      const sugAhorro = resultadoMes && !resultadoMes.insuficiente ? resultadoMes.ahorro : t2.disponibleBruto * (state.savingsRate / 100);
      const insGustos = computeInsights();
      const mkActual = monthKey();
      const fijosPagadosEsteMes = state.gastosFijosReconocidos.filter((gf) => gastoFijoPagadoEsteMes(gf)).reduce((a, gf) => { const ux = gastoFijoUltimaTx(gf); return a + (ux ? Math.abs(toNum(ux.monto)) : toNum(gf.monto)); }, 0);
      const suscripcionesEsteMes = state.cloudTransactions.filter((tx) => toNum(tx.monto) < 0 && String(tx.fecha).slice(0, 7) === mkActual && (tx.categoria === "suscripciones" || tx.categoria === "streaming")).reduce((a, tx) => a + Math.abs(toNum(tx.monto)), 0);
      const gastadoGustos = Math.max(insGustos.totalActual - fijosPagadosEsteMes - suscripcionesEsteMes, 0);
      html += '<div class="panel"><h2>' + t("esteMesSugerenciasTitle") + '</h2>';
      html += '<div class="mini-total"><span>' + t("gastadoGustosLbl") + '</span><b>' + sym() + fmt0(gastadoGustos) + '</b></div>';
      html += '<div class="mini-total"><span>' + t("sugGustosLbl") + '</span><b>' + sym() + fmt0(sugGustos) + '</b></div>';
      html += '<p class="opt-row-sub" style="margin-top:-6px;margin-bottom:8px;">' + t("sugGustosHint") + '</p>';
      html += '<div class="mini-total"><span>' + t("sugAhorroLbl") + '</span><b>' + sym() + fmt0(sugAhorro) + '</b></div>';
      const historialAhorro = state.history.slice().sort((a, b) => (a.month < b.month ? 1 : -1)).slice(0, 6);
      if (historialAhorro.length > 0) {
        html += '<p class="opt-section-title" style="margin-top:14px;">' + t("historialAhorroTitle") + '</p>';
        historialAhorro.forEach((h) => {
          html += '<div class="sub-row-locked"><span class="locked-name">' + esc(monthLabel(h.month)) + '</span><span class="locked-amount">' + sym() + fmt0(toNum(h.ahorro)) + '</span></div>';
        });
      }
      html += '</div>';
    }

    const pagosProximos = proximosPagos();
    if (pagosProximos.length > 0) {
      html += '<div class="panel"><h2>' + t("proximosPagosTitle") + '</h2>';
      pagosProximos.slice(0, 6).forEach((p) => {
        html += '<div class="history-row"><div class="history-top"><span class="history-month" style="text-transform:none;">' + esc(p.nombre) + '</span><span class="locked-amount">' + sym() + fmt0(p.monto) + '</span></div>';
        html += '<div class="opt-row-sub">' + esc(diasLabel(p.diffDays)) + ' \u00b7 ' + esc(formatDate(p.fecha)) + '</div></div>';
      });
      html += '</div>';
    }

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
        const liab = c.liab_apr != null || c.liab_pago_minimo != null ? { apr: c.liab_apr, pago_minimo: c.liab_pago_minimo, fecha_limite: c.liab_fecha_limite } : null;
        html += '<div style="margin-bottom:14px;"><div class="history-top" style="margin-bottom:4px;"><span class="history-month" style="text-transform:none;">' + esc(c.name || t("cardNombrePh")) + (c.mask ? " ****" + esc(c.mask) : "") + '</span><span class="status-pill ' + usoNivel + '">' + Math.round(uso) + '%</span></div>';
        html += '<div class="opt-row-sub" style="margin-bottom:4px;">' + sym() + fmt0(saldo) + ' ' + t("deLimiteLbl") + ' ' + sym() + fmt0(limite) + (liab && liab.apr ? ' \u00b7 ' + t("cardAprLbl") + ' ' + liab.apr + '%' : '') + '</div>';
        html += utilBarHtml(uso, usoNivel) + '</div>';
      });
      html += '</div>';
    }

    html += '<div class="panel"><div class="panel-head-row"><div><h2>' + t("objetivosTitle") + '</h2><p class="hint" style="margin-bottom:0;">' + t("objetivosHint") + '</p></div><button class="icon-pencil' + (state.editingGoals ? " done" : "") + '" data-action="toggleEditGoals">' + (state.editingGoals ? icon("check") : icon("pencil")) + '</button></div>';
    state.goals.forEach((g) => {
      const objetivo = toNum(g.montoObjetivo);
      const actual = toNum(g.montoActual);
      const pct = objetivo > 0 ? Math.min((actual / objetivo) * 100, 100) : 0;
      if (state.confirmDeleteGoalId === g.id) {
        html += '<div class="confirm-row"><span>' + esc(t("confirmDeleteGoalMsg")(g.nombre || t("goalNombrePh"))) + '</span><div class="confirm-row-btns"><button class="pill-btn confirm" data-action="removeGoal" data-id="' + g.id + '">' + t("yesDelete") + '</button><button class="pill-btn" data-action="cancelDeleteGoal">' + t("cancel") + '</button></div></div>';
        return;
      }
      html += '<div style="margin-bottom:14px;">';
      if (!state.editingGoals) {
        html += '<div class="history-top" style="margin-bottom:4px;"><span class="history-month" style="text-transform:none;">' + esc(g.nombre || t("goalNombrePh")) + '</span><span class="opt-row-sub">' + sym() + fmt0(actual) + ' / ' + sym() + fmt0(objetivo) + '</span></div>';
        html += '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
      } else {
        html += '<div class="goal-grid" style="margin-bottom:6px;"><input type="text" placeholder="' + t("goalNombrePh") + '" data-scope="goal" data-id="' + g.id + '" data-field="nombre" value="' + esc(g.nombre) + '"><button class="icon-del" data-action="askDeleteGoal" data-id="' + g.id + '">' + icon("close") + '</button></div>';
        html += '<div class="goal-grid">';
        html += '<div class="goal-field"><label>' + t("goalActualLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="0" data-scope="goal" data-id="' + g.id + '" data-field="montoActual" value="' + esc(g.montoActual) + '"></div>';
        html += '<div class="goal-field"><label>' + t("goalObjetivoLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="0" data-scope="goal" data-id="' + g.id + '" data-field="montoObjetivo" value="' + esc(g.montoObjetivo) + '"></div>';
        html += '</div>';
        html += '<div class="progress-track" style="margin-top:6px;"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
      }
      html += '</div>';
    });
    if (state.goals.length === 0) html += '<div class="empty-state">' + t("objetivosEmpty") + '</div>';
    if (state.editingGoals) html += '<button class="add-btn" data-action="addGoal">' + t("addGoal") + '</button>';
    html += '</div>';

  }

  if (tab === "cuentas") {
    if (state.autoPagoNotif && state.autoPagoNotif.length > 0) {
      html += '<div class="flash">' + t("autoPagoAplicado")(state.autoPagoNotif.join(", ")) + '</div>';
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

    const insCuentas = computeInsights();
    if (state.gastosFijosReconocidos.length > 0 || insCuentas.suscripcionesDetectadas.length > 0) {
      html += '<div class="panel"><h2>' + t("gastosFijosBancoTitle") + '</h2><p class="hint">' + t("gastosFijosBancoHint") + '</p>';
      let totalPendiente = 0, totalPagado = 0, totalSuscripcionesMes = insCuentas.suscripcionesTotalMensual;
      state.gastosFijosReconocidos.forEach((gf) => {
        const ultimaTx = gastoFijoUltimaTx(gf);
        const monto = ultimaTx ? Math.abs(toNum(ultimaTx.monto)) : toNum(gf.monto);
        const pagado = gastoFijoPagadoEsteMes(gf);
        if (pagado) totalPagado += monto; else totalPendiente += monto;
        html += '<div class="sub-row-locked"><span class="locked-name" style="display:flex;align-items:center;gap:8px;"><span class="status-pill ' + (pagado ? "verde" : "amarillo") + '" style="font-size:9.5px;">' + (pagado ? t("pagadoEsteMesLbl") : t("pendienteEsteMesLbl")) + '</span>' + esc(gf.nombre) + '</span><span class="locked-amount">' + sym() + fmt0(monto) + '</span></div>';
        html += '<button class="delete-link" style="margin-bottom:6px;" data-action="removeGastoFijoReconocido" data-id="' + gf.id + '">' + t("olvidarBtn") + '</button>';
      });
      if (state.gastosFijosReconocidos.length > 0) {
        html += '<div class="mini-total"><span>' + t("pendienteEsteMesTotalLbl") + '</span><b style="color:#FF3B30;">' + sym() + fmt0(totalPendiente) + '</b></div>';
        html += '<div class="mini-total"><span>' + t("pagadoEsteMesTotalLbl") + '</span><b style="color:#34C759;">' + sym() + fmt0(totalPagado) + '</b></div>';
      }

      if (insCuentas.suscripcionesDetectadas.length > 0) {
        html += '<p class="opt-section-title" style="margin-top:14px;">' + t("suscripcionesDetectadasTitle") + '</p>';
        insCuentas.suscripcionesDetectadas.forEach((s) => {
          html += '<div class="card-entry" style="' + (s.cancelada ? "opacity:0.5;" : "") + '">';
          html += '<div class="card-collapsed-top"><span class="card-collapsed-name">' + esc(s.nombre) + (s.cancelada ? ' \u00b7 ' + t("canceladaLbl") : '') + '</span><span class="locked-amount" style="' + (s.cancelada ? "text-decoration:line-through;" : "") + '">' + sym() + fmt0(s.monto) + '</span></div>';
          if (!s.cancelada) html += '<p class="opt-row-sub">' + esc(diasLabel(s.diasFaltan)) + ' \u00b7 ' + esc(formatDate(s.proxima)) + '</p>';
          html += '<div class="seg" style="width:100%;margin-top:6px;">';
          ["semanal", "quincenal", "mensual", "anual"].forEach((f) => {
            html += '<button style="flex:1;font-size:10.5px;padding:5px;" class="' + (s.frecuencia === f ? "active" : "") + '" data-action="' + (s.origen === "manual" ? "setManualFrecuencia" : "setFrecuenciaAuto") + '" data-id="' + esc(s.origen === "manual" ? s.id : s.key) + '" data-freq="' + f + '">' + t(f === "anual" ? "freqAnual" : f === "mensual" ? "payMensual" : f === "quincenal" ? "payQuincenal" : "paySemanal") + '</button>';
          });
          html += '</div>';
          html += '<div style="display:flex;gap:8px;margin-top:6px;">';
          html += '<button class="delete-link" data-action="toggleSuscripcionCancelada" data-id="' + esc(s.origen === "manual" ? s.id : s.key) + '">' + (s.cancelada ? t("reactivarBtn") : t("cancelarBtn")) + '</button>';
          if (s.origen === "manual") html += '<button class="delete-link" data-action="removeSuscripcionManual" data-id="' + s.id + '">' + t("eliminar") + '</button>';
          html += '</div>';
          html += '</div>';
        });
        html += '<div class="mini-total"><span>' + t("totalSuscripcionesLbl") + '</span><b>' + sym() + fmt0(totalSuscripcionesMes) + '</b></div>';
      }
      html += '</div>';
    }

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
        const liab = c.liab_apr != null || c.liab_pago_minimo != null ? { apr: c.liab_apr, pago_minimo: c.liab_pago_minimo, fecha_limite: c.liab_fecha_limite } : null;
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

    if (ins.tendenciaMeses.some((m) => m.valor > 0)) {
      html += '<div class="panel"><h2>' + t("tendenciaMensualTitle") + '</h2>';
      html += renderBarChart(ins.tendenciaMeses, 90, "verMesTendencia");
      html += '</div>';
    }
    if (ins.categoriasOrdenadas.length > 0) {
      html += '<div class="panel"><h2>' + t("gastoPorCategoriaTitle") + '</h2>';
      html += renderBarChart(ins.categoriasOrdenadas, 110);
      html += renderDonutChart(ins.categoriasOrdenadas);
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

    const comprasBase = state.cloudTransactions.filter((tx) => toNum(tx.monto) < 0);
    const recibidosBase = state.cloudTransactions.filter((tx) => toNum(tx.monto) > 0);
    if (comprasBase.length > 0 || recibidosBase.length > 0) {
      html += '<div class="panel">';
      html += '<div class="seg" style="width:100%;margin-bottom:10px;"><button style="flex:1;" class="' + (state.historialVista === "compras" ? "active" : "") + '" data-action="setHistorialVista" data-id="compras">' + t("comprasTitle") + '</button><button style="flex:1;" class="' + (state.historialVista === "recibidos" ? "active" : "") + '" data-action="setHistorialVista" data-id="recibidos">' + t("pagosRecibidosBancoTitle") + '</button></div>';

      const listaBase = state.historialVista === "recibidos" ? recibidosBase : comprasBase;
      const categoriasPresentes = Array.from(new Set(listaBase.map((tx) => tx.categoria || "otros")));
      if (state.historialVista === "recibidos") {
        html += '<p class="hint">' + t("pagosRecibidosBancoHint") + '</p>';
      } else {
        html += '<p class="hint">' + t("comprasHint") + '</p>';
      }
      html += '<input type="text" placeholder="' + t("buscarPh") + '" id="historial-search" data-scope="historialSearch" value="' + esc(state.historialSearch) + '" style="width:100%;margin-bottom:8px;">';
      html += '<div class="preset-row">';
      html += '<button class="preset-chip' + (!state.historialCategoriaFiltro ? " active-chip" : "") + '" data-action="setHistorialFiltro" data-id="">' + t("todasLbl") + '</button>';
      categoriasPresentes.forEach((c) => {
        html += '<button class="preset-chip' + (state.historialCategoriaFiltro === c ? " active-chip" : "") + '" data-action="setHistorialFiltro" data-id="' + c + '">' + t("cat_" + c) + '</button>';
      });
      html += '</div>';

      let compras = listaBase;
      if (state.historialCategoriaFiltro) compras = compras.filter((tx) => (tx.categoria || "otros") === state.historialCategoriaFiltro);
      if (state.historialSearch.trim()) {
        const q = state.historialSearch.trim().toLowerCase();
        compras = compras.filter((tx) => (tx.descripcion || "").toLowerCase().indexOf(q) !== -1);
      }

      if (compras.length === 0) html += '<div class="empty-state">' + t("sinResultadosMsg") + '</div>';
      const gruposCompras = agruparPorMes(compras);
      gruposCompras.forEach((grupo, idx) => {
        if (idx === 0) {
          html += '<p class="opt-section-title" style="margin-top:4px;">' + esc(grupo.label) + '</p>';
          grupo.items.forEach((tx) => {
            html += renderTxRow(tx.descripcion, tx.categoria, tx.monto, String(tx.fecha).slice(0, 10), "", tx.id);
          });
          return;
        }
        const abierto = state.historialMesAbierto === grupo.monthKey;
        const totalMes = grupo.items.reduce((a, tx) => a + Math.abs(toNum(tx.monto)), 0);
        html += '<button class="sub-row-locked" style="width:100%;text-align:left;border:none;background:none;cursor:pointer;font:inherit;color:inherit;" data-action="toggleMesHistorial" data-id="' + grupo.monthKey + '"><span class="locked-name" style="display:flex;align-items:center;gap:6px;">' + (abierto ? '\u2304' : '\u203a') + ' ' + esc(grupo.label) + '</span><span class="locked-amount">' + sym() + fmt0(totalMes) + '</span></button>';
        if (abierto) {
          grupo.items.forEach((tx) => {
            html += renderTxRow(tx.descripcion, tx.categoria, tx.monto, String(tx.fecha).slice(0, 10), "", tx.id);
          });
        }
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
  if (state.showTxDetalle) html += renderTxDetalleSheet();
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
