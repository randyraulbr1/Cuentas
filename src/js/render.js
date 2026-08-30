"use strict";

const root = document.getElementById("root");

function saldoDebitoBanco() {
  const cuentas = state.cloudAccounts.filter((account) => {
    const type = String(account.type || "").toLowerCase();
    const subtype = String(account.subtype || "").toLowerCase();
    return type === "depository" && (!subtype || subtype === "checking" || subtype === "cash management" || subtype === "prepaid");
  });
  return cuentas.reduce((sum, account) => {
    const disponible = account.balance_available;
    return sum + Math.max(toNum(disponible != null ? disponible : account.balance_current), 0);
  }, 0);
}

function renderBancoNubePanel(compact) {
  let html = '<div class="panel">';
  html += '<div class="panel-head-row"><div><h2>' + t("bancoNubeTitle") + '</h2><p class="hint" style="margin-bottom:0;">' + t("bancoNubeHint") + '</p></div></div>';
  if (state.cloudErrorMsg) html += '<p class="opt-row-sub" style="color:#FF3B30;margin:8px 0;">' + esc(state.cloudErrorMsg) + '</p>';
  if (state.cloudFlash) html += '<div class="flash">' + icon("check") + ' ' + esc(state.cloudFlash) + '</div>';

  if (!state.authUser) {
    html += '<button class="pay-trigger" style="background:var(--accent);" data-action="iniciarConectarBanco"' + (state.cloudBusy ? " disabled" : "") + '>' + icon("bank") + ' ' + (state.cloudBusy ? t("conectandoMsg") : t("conectarBancoPlaidBtn")) + '</button>';
    html += '</div>';
    return html;
  }

  state.cloudInstitutions.filter((inst) => inst.status === "active").forEach((inst) => {
    if (state.confirmDisconnectId === inst.id) {
      html += '<div class="confirm-row"><span>' + esc(t("confirmDesconectarMsg")(inst.institution_name || "")) + '</span><div class="confirm-row-btns"><button class="pill-btn confirm" data-action="confirmDisconnectBank" data-id="' + inst.id + '">' + t("yesDelete") + '</button><button class="pill-btn" data-action="cancelDisconnectBank">' + t("cancel") + '</button></div></div>';
    } else {
      html += '<div class="card-entry"><div class="card-collapsed-top"><span class="card-collapsed-name">' + esc(inst.institution_name || t("bancoDesconocido")) + '</span>' + (inst.status === "active" ? "" : '<span class="status-pill rojo">' + t("estadoDesconectado") + '</span>') + '</div>';

      if (inst.status === "active") html += '<button class="delete-link" data-action="askDisconnectBank" data-id="' + inst.id + '">' + t("desconectarBancoBtn") + '</button>';
      html += '</div>';
    }
  });

  if (!state.cloudInstitutions.some((inst) => inst.status === "active")) html += '<button class="pay-trigger" style="background:var(--accent);" data-action="iniciarConectarBanco"' + (state.cloudBusy ? " disabled" : "") + '>' + icon("bank") + ' ' + (state.cloudBusy ? t("conectandoMsg") : t("conectarBancoPlaidBtn")) + '</button>';


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

function renderPinScreen() {
  let lockUntil = 0;
  try { lockUntil = Number(localStorage.getItem(PIN_LOCK_KEY)) || 0; } catch (error) {}
  const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");
  const entered = String(state.pinInput || "").slice(0, 6);
  let html = '<div class="page pin-page"><div class="pin-screen"><div class="selector-logo">' + icon("lock") + '</div>';
  html += '<h1>' + (LANG === "es" ? "Ingresa tu PIN" : "Enter your PIN") + '</h1>';
  html += '<p class="selector-hint">' + (remaining > 0 ? (LANG === "es" ? "Demasiados intentos. Espera " + minutes + ":" + seconds + "." : "Too many attempts. Wait " + minutes + ":" + seconds + ".") : (LANG === "es" ? "PIN local de 6 dígitos" : "6-digit local PIN")) + '</p>';
  html += '<div class="pin-dots" aria-label="' + entered.length + ' de 6 dígitos">';
  for (let index = 0; index < 6; index++) html += '<span class="' + (index < entered.length ? "filled" : "") + '">' + (index < entered.length ? "●" : "") + '</span>';
  html += '</div>';
  let biometricConfigured = false;
  try { biometricConfigured = !!localStorage.getItem(BIOMETRIC_CRED_KEY); } catch (error) {}
  if (remaining === 0) {
    if (biometricConfigured) html += '<button class="biometric-unlock" data-action="unlockBiometric"' + (state.biometricBusy ? " disabled" : "") + '>' + icon("lock") + '<span>' + (state.biometricBusy ? (LANG === "es" ? "Comprobando…" : "Checking…") : (LANG === "es" ? "Entrar con huella" : "Unlock with biometrics")) + '</span></button>';
    html += '<div class="pin-or"><span>' + (LANG === "es" ? "o usa tu PIN" : "or use your PIN") + '</span></div>';
    html += '<div class="pin-keypad">';
    ["1","2","3","4","5","6","7","8","9"].forEach((digit) => { html += '<button type="button" data-action="pinDigit" data-id="' + digit + '">' + digit + '</button>'; });
    html += '<span></span><button type="button" data-action="pinDigit" data-id="0">0</button><button type="button" class="pin-delete" data-action="pinDelete" aria-label="' + (LANG === "es" ? "Borrar" : "Delete") + '">' + icon("back") + '<small>' + (LANG === "es" ? "Borrar" : "Delete") + '</small></button>';
    html += '</div>';
    html += '<button class="pay-trigger pin-enter-btn" data-action="unlockPin"' + (entered.length !== 6 || state.pinBusy ? " disabled" : "") + '>' + (state.pinBusy ? (LANG === "es" ? "Comprobando…" : "Checking…") : (LANG === "es" ? "Entrar" : "Unlock")) + '</button>';
  }
  if (state.pinError) html += '<p class="pin-error">' + esc(state.pinError) + '</p>';
  if (state.confirmPinReset) {
    html += '<div class="pin-reset-confirm"><p>' + (LANG === "es" ? "Esto borrará solamente el PIN y la huella guardados en este teléfono. No borra bancos, pagos ni movimientos." : "This only removes the PIN and biometrics stored on this phone. It does not delete financial data.") + '</p><div><button class="pill-btn confirm" data-action="confirmResetPin">' + (LANG === "es" ? "Sí, restablecer" : "Reset") + '</button><button class="pill-btn" data-action="cancelResetPin">' + (LANG === "es" ? "Cancelar" : "Cancel") + '</button></div></div>';
  } else {
    html += '<button class="pin-reset-link" data-action="askResetPin">' + (LANG === "es" ? "El PIN no funciona" : "PIN is not working") + '</button>';
  }
  html += '</div></div>';
  root.innerHTML = html;
  if (remaining > 0) setTimeout(() => { if (state.appLocked) render(); }, 1000);
  if (remaining === 0 && biometricConfigured && !state.biometricAutoTried && !state.biometricBusy) {
    state.biometricAutoTried = true;
    setTimeout(() => { if (state.appLocked) unlockBiometric(); }, 250);
  }
}


function renderSelector() {
  let html = '<div class="page"><div class="selector-wrap">';
  html += '<div class="selector-logo">' + sym() + '</div>';
  html += '<h1 class="selector-title">' + t("selectorTitle") + '</h1>';
  html += '<p class="selector-hint">' + t("selectorHint") + '</p>';

  if (state.cloudBusy) html += '<p class="opt-row-sub" style="text-align:left;margin:0 0 8px;">' + t("esperaServidorMsg") + '</p>';
  html += renderBancoNubePanel();
  html += '<p class="opt-row-sub" style="text-align:center;margin:6px 0 -4px;">v' + APP_VERSION.replace("v", "") + ' \u00b7 <button data-action="actualizar" style="background:none;border:none;color:var(--accent);font:inherit;padding:0;cursor:pointer;">' + t("update") + '</button></p>';
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
  if (toNum(tx.monto) < 0 && toNum(state.job.pagoHora) > 0) h += '<div style="padding:11px 13px;border-radius:12px;background:var(--surface-2);font-weight:750;margin-bottom:10px;">' + icon("clock") + ' ' + esc(textoGastoEnTiempo(Math.abs(toNum(tx.monto)))) + '</div>';
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
    h += '<div class="tx-actions">';
    if (state.txDetalleFlash) {
      h += '<div class="flash">' + icon("check") + ' ' + esc(state.txDetalleFlash) + '</div>';
    } else if (state.showMarcarGastoFijo) {
      h += '<p class="tx-actions-title">' + t("nombreGastoFijoLbl") + '</p>';
      h += '<input type="text" placeholder="' + t("nombreGastoFijoPh") + '" id="nombre-gasto-fijo-input" data-scope="nombreGastoFijoTemp" value="' + esc(state.nombreGastoFijoTemp) + '" style="width:100%;">';
      h += '<div class="tx-btn-row" style="margin-top:8px;"><button class="pill-btn confirm" style="flex:1;" data-action="confirmarGastoFijo">' + t("guardarBtn") + '</button><button class="pill-btn" style="flex:1;" data-action="cancelarMarcarGastoFijo">' + t("cancel") + '</button></div>';
    } else {
      h += '<p class="tx-actions-title">' + t("marcarSuscripcionLbl") + '</p>';
      h += '<div class="tx-freq-grid">';
      [["semanal", "paySemanal"], ["quincenal", "payQuincenal"], ["mensual", "payMensual"], ["anual", "freqAnual"]].forEach((f) => {
        h += '<button class="tx-freq-btn" data-action="marcarComoSuscripcion" data-id="' + tx.id + '" data-freq="' + f[0] + '">' + t(f[1]) + '</button>';
      });
      h += '</div>';
      h += '<div class="tx-btn-row" style="margin-top:10px;">';
      h += '<button class="tx-action-btn" data-action="abrirMarcarGastoFijo">' + icon("receipt") + '<span>' + t("marcarGastoFijoCorto") + '</span></button>';
      h += '<button class="tx-action-btn" data-action="marcarComoPlazo" data-id="' + tx.id + '">' + icon("scale") + '<span>' + t("marcarPlazoLbl") + '</span></button>';
      h += '</div>';
    }
    h += '</div>';
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
  h += '<p class="opt-row-sub" style="margin-bottom:12px;">' + t("consentPoliza") + ' <a href="privacy.html" style="color:var(--accent);" target="_blank" rel="noopener">' + t("consentPolizaLink") + "</a></p>";
  h += '<div style="display:flex;gap:8px;">';
  h += '<button class="pill-btn confirm" style="flex:1;" data-action="aceptarConsentimiento">' + t("consentAceptar") + "</button>";
  h += '<button class="pill-btn" style="flex:1;" data-action="cancelarConsentimiento">' + t("cancel") + "</button>";
  h += "</div></div></div>";
  return h;
}

function renderLoanBankPicker(loanId) {
  const query = String(state.bankExpenseSearch || "").trim().toLowerCase();
  let expenses = state.cloudTransactions.filter((tx) => toNum(tx.monto) < 0);
  if (query) expenses = expenses.filter((tx) => String(tx.merchant_name || tx.descripcion || "").toLowerCase().indexOf(query) !== -1);
  expenses.sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
  expenses = expenses.slice(0, 60);
  let h = '<div class="sub-add-picker" id="loan-bank-picker">';
  h += '<input type="search" id="loan-bank-search" placeholder="' + (LANG === "es" ? "Buscar por nombre" : "Search by name") + '" data-scope="bankExpenseSearch" value="' + esc(state.bankExpenseSearch || "") + '" style="width:100%;margin-bottom:8px;">';
  if (expenses.length === 0) {
    h += '<div class="empty-state">' + (LANG === "es" ? "No hay movimientos del banco todavía." : "No bank transactions yet.") + '</div>';
  } else {
    expenses.forEach((tx) => {
      h += '<button class="bank-expense-choice" data-action="setLoanPagoFromTx" data-id="' + loanId + '" data-tx-id="' + esc(tx.id) + '">';
      h += renderTxChip(tx.categoria);
      h += '<span class="bank-expense-choice-info"><b>' + esc(tx.merchant_name || tx.descripcion || "") + '</b><small>' + esc(String(tx.fecha || "").slice(0, 10)) + '</small></span>';
      h += '<strong>\u2212' + sym() + fmt0(Math.abs(toNum(tx.monto))) + '</strong></button>';
    });
  }
  h += '</div>';
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
  h += '<div class="tx-row-main"><div class="tx-row-top"><span class="tx-row-name">' + esc(descripcion) + (tieneNota ? ' ' + icon("pencil") : "") + '</span><span class="locked-amount" style="color:' + (positivo ? "var(--positive)" : "var(--negative)") + ';white-space:nowrap;">' + (positivo ? "+" : "\u2212") + sym() + fmt0(Math.abs(toNum(monto))) + '</span></div>';
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
  let h = renderBancoNubePanel(true);

  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId);
  let pinConfigured = false;
  try { pinConfigured = !!localStorage.getItem(PIN_HASH_KEY); } catch (error) {}
  h += '<div class="panel security-compact"><div class="security-compact-head"><span class="security-compact-icon">' + icon("lock") + '</span><div><p class="opt-section-title">' + (LANG === "es" ? "Seguridad local" : "Local security") + '</p><p class="opt-row-sub">' + (pinConfigured ? (LANG === "es" ? "PIN activo en este teléfono" : "PIN active on this phone") : (LANG === "es" ? "Protege esta cuenta con 6 dígitos" : "Protect this account with 6 digits")) + '</p></div></div>';
  const pinSetupLen = String(state.pinSetupInput || "").length;
  h += '<div class="pin-setup-row compact"><input aria-label="' + (LANG === "es" ? "PIN de 6 dígitos" : "6-digit PIN") + '" id="pin-setup-input" data-scope="pinSetup" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022" value="' + esc(state.pinSetupInput) + '">';
  if (pinSetupLen === 6) h += '<button class="pill-btn confirm" style="margin:10px auto 0;display:block;min-width:150px;padding:9px 20px;font-size:13.5px;text-align:center;" data-action="savePin">' + (pinConfigured ? (LANG === "es" ? "Cambiar" : "Change") : (LANG === "es" ? "Crear PIN" : "Create PIN")) + '</button>';
  h += '</div>';
  if (state.pinError) h += '<p class="pin-error">' + esc(state.pinError) + '</p>';
  if (pinConfigured) {
    let biometricConfigured = false;
    try { biometricConfigured = !!localStorage.getItem(BIOMETRIC_CRED_KEY); } catch (error) {}
    h += '<div class="security-compact-actions"><button class="pill-btn biometric-btn" data-action="setupBiometric"' + (state.biometricBusy ? " disabled" : "") + '>' + icon("lock") + ' ' + (biometricConfigured ? (LANG === "es" ? "Huella activa" : "Biometrics active") : (LANG === "es" ? "Activar huella" : "Enable biometrics")) + '</button>';
    h += '<button class="pill-btn" data-action="lockApp">' + (LANG === "es" ? "Bloquear" : "Lock") + '</button></div>';
  }
  h += '</div>';

  const navDefinitions = navTabDefinitions();
  const navDraft = normalizeNavOrder(state.navOrderDraft);
  h += '<div class="panel nav-order-panel"><div class="panel-head-row"><div><p class="opt-section-title">' + (LANG === "es" ? "Orden de los botones" : "Button order") + '</p><p class="opt-row-sub">' + (LANG === "es" ? "Mantén presionado y arrastra para reordenar." : "Press and hold, then drag to reorder.") + '</p></div></div>';
  h += '<div class="nav-order-strip" id="nav-order-strip">';
  navDraft.forEach((navId) => {
    const item = navDefinitions[navId];
    h += '<div class="nav-order-item" data-id="' + navId + '"><span>' + icon(item.icon) + '</span><small>' + esc(item.label) + '</small></div>';
  });
  h += '</div>';
  h += '<p class="hint" id="nav-order-status" style="text-align:center;margin-top:8px;">' + (state.navOrderSaved ? (LANG === "es" ? "Orden guardado \u2713" : "Order saved \u2713") : (LANG === "es" ? "Los cambios se guardan solos." : "Changes save on their own.")) + '</p>';
  h += '</div>';

  h += '<div class="panel"><p class="opt-section-title">' + t("secPreferencias") + '</p><div class="opt-row"><span class="opt-row-label">' + t("secIdioma") + '</span><div class="seg"><button class="' + (state.lang === "es" ? "active" : "") + '" data-action="setLangEs">ES</button><button class="' + (state.lang === "en" ? "active" : "") + '" data-action="setLangEn">EN</button></div></div>';
  h += '<div class="opt-row"><span class="opt-row-label">' + t("secMoneda") + '</span><div class="seg"><button class="' + (state.currency === "usd" ? "active" : "") + '" data-action="setCurUsd">$</button><button class="' + (state.currency === "eur" ? "active" : "") + '" data-action="setCurEur">€</button></div></div>';
  h += '<div class="opt-row"><span class="opt-row-label">' + t("secTema") + '</span><div class="seg"><button class="' + (state.theme === "light" ? "active" : "") + '" data-action="setThemeLight">' + icon("sun") + '</button><button class="' + (state.theme === "dark" ? "active" : "") + '" data-action="setThemeDark">' + icon("moon") + '</button></div></div>';
  h += '<div class="opt-row"><span class="opt-row-label">' + t("periodoTrabajoLbl") + '</span><div class="seg">';
  [["semanal", "periodoSemana"], ["quincenal", "periodoQuincenaLbl"], ["mensual", "periodoMes"]].forEach((p) => {
    h += '<button class="' + (state.trabajoPeriodoDefault === p[0] ? "active" : "") + '" data-action="setTrabajoPeriodo" data-id="' + p[0] + '">' + t(p[1]) + '</button>';
  });
  h += '</div></div>';
  h += '<div class="opt-row"><span class="opt-row-label">' + t("secTamanoTexto") + '</span><div class="seg"><button class="' + (state.textSize === "pequeno" ? "active" : "") + '" data-action="setTextSizeChico">' + t("textoChico") + '</button><button class="' + (state.textSize === "normal" ? "active" : "") + '" data-action="setTextSizeNormal">' + t("textoNormal") + '</button><button class="' + (state.textSize === "grande" ? "active" : "") + '" data-action="setTextSizeGrande">' + t("textoGrande") + '</button></div></div></div>';

  h += '<div class="panel"><p class="opt-section-title">' + t("secCredito") + '</p>';
  h += '<p class="opt-row-sub" style="margin-bottom:6px;">' + t("objetivoHint") + '</p>';
  h += '<div class="seg" style="width:100%;margin-top:6px;">';
  h += '<button style="flex:1;" class="' + (state.objetivo === "equilibrado" ? "active" : "") + '" data-action="setObjEquilibrado">' + t("objEquilibrado") + '</button>';
  h += '<button style="flex:1;" class="' + (state.objetivo === "credito" ? "active" : "") + '" data-action="setObjCredito">' + t("objCredito") + '</button>';
  h += '<button style="flex:1;" class="' + (state.objetivo === "ahorro" ? "active" : "") + '" data-action="setObjAhorro">' + t("objAhorro") + '</button>';
  h += '</div></div>';

  h += '<div class="panel"><p class="opt-section-title">' + t("secAhorroPct") + '</p>';
  h += '<div class="seg" style="width:100%;margin-bottom:8px;">';
  const nivelAhorro = state.savingsRate < 15 ? "normal" : state.savingsRate < 28 ? "medio" : "agresivo";
  h += '<button style="flex:1;" class="' + (nivelAhorro === "normal" ? "active" : "") + '" data-action="setAhorroNormal" data-savings-rate="10">' + t("ahorroNormal") + '</button>';
  h += '<button style="flex:1;" class="' + (nivelAhorro === "medio" ? "active" : "") + '" data-action="setAhorroMedio" data-savings-rate="20">' + t("ahorroMedio") + '</button>';
  h += '<button style="flex:1;" class="' + (nivelAhorro === "agresivo" ? "active" : "") + '" data-action="setAhorroAgresivo" data-savings-rate="35">' + t("ahorroAgresivo") + '</button>';
  h += '</div>';
  h += '<div class="opt-slider-row"><input type="range" min="0" max="100" step="1" id="savings-rate-input" data-scope="savingsRate" value="' + state.savingsRate + '"><div class="opt-slider-val">' + state.savingsRate + '%</div></div></div>';

  h += '<div class="panel"><p class="opt-section-title">' + t("secDatos") + '</p><div class="opt-btn-stack">';
  h += '<button class="pill-btn wide update" data-action="actualizar">' + t("update") + (UPDATE_AVAILABLE ? '<span class="dot"></span>' : '') + '</button>';
  h += '</div></div>';

  h += '<p class="options-footer-meta">' + (state.cloudLastSync ? t("ultimaActualizacionLbl") + ': ' + esc(new Date(state.cloudLastSync).toLocaleString(LANG === "es" ? "es-ES" : "en-US")) + ' · ' : "") + 'v' + APP_VERSION.replace("v", "") + ' · ' + BUILD_DATE + '</p>';
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

function slideOrDisabled(enabled, action, label, danger) {
  if (!enabled) return '<button class="work-btn" disabled>' + label + '</button>';
  return '<div class="slide-confirm' + (danger ? " slide-danger" : "") + '" data-slide-action="' + action + '"><div class="slide-track"><span class="slide-label">' + label + '</span><div class="slide-handle">' + icon("chevron") + '</div></div></div>';
}

function renderCashflowChart(buckets) {
  const width=720,height=300,left=20,right=72,top=24,bottom=42,plotW=width-left-right,plotH=height-top-bottom;
  const totalIncome=buckets.reduce((sum,item)=>sum+toNum(item.ingresos),0),totalExpense=buckets.reduce((sum,item)=>sum+toNum(item.gastos),0);
  const values=buckets.reduce((all,item)=>all.concat([toNum(item.open),toNum(item.close)]),[0]);let minValue=Math.min.apply(null,values),maxValue=Math.max.apply(null,values);
  if(minValue===maxValue){minValue-=1;maxValue+=1;}const padding=Math.max((maxValue-minValue)*.12,1);minValue-=padding;maxValue+=padding;
  const scaleY=(value)=>top+((maxValue-value)/(maxValue-minValue))*plotH,step=plotW/Math.max(buckets.length,1),candleW=Math.max(Math.min(step*.62,13),2.5);
  const moneyShort=(value)=>{const n=Math.abs(toNum(value));return n>=1000?(n/1000).toFixed(n>=10000?0:1)+"k":fmt0(n);};
  window.__cashflowBuckets = buckets;
  window.__cashflowGeom = { width, left, right, step };
  const netDefault=(totalIncome-totalExpense>=0?"+":"\u2212")+sym()+fmt0(Math.abs(totalIncome-totalExpense));
  let h='<div class="trading-chart-shell real-candle-chart"><div class="trading-chart-head"><div><span class="trading-symbol">305 CASH FLOW</span><span class="trading-live"><i></i>'+(buckets.length?(LANG==="es"?"Movimientos reales":"Real transactions"):(LANG==="es"?"Sin actividad":"No activity"))+'</span></div>';
  h+='<div class="trading-net '+(totalIncome-totalExpense>=0?"positive":"negative")+'" id="cf-readout" data-default="'+esc(netDefault)+'" data-default-cls="'+(totalIncome-totalExpense>=0?"positive":"negative")+'">'+netDefault+'</div></div><svg class="trading-svg" id="cf-svg" viewBox="0 0 '+width+' '+height+'" role="img">';
  [0,.25,.5,.75,1].forEach((ratio)=>{const y=top+plotH*ratio,value=maxValue-(maxValue-minValue)*ratio;h+='<line class="trading-grid" x1="'+left+'" y1="'+y+'" x2="'+(width-right)+'" y2="'+y+'"></line><text class="trading-axis-label" x="'+(width-7)+'" y="'+(y+4)+'" text-anchor="end">'+(value<0?"−":"")+sym()+moneyShort(value)+'</text>';});
  if(!buckets.length)h+='<text class="trading-empty-label" x="'+(left+plotW/2)+'" y="'+(top+plotH/2)+'" text-anchor="middle">'+(LANG==="es"?"No hubo movimientos en este período":"No transactions in this period")+'</text>';
  buckets.forEach((item,index)=>{const x=left+step*(index+.5),yOpen=scaleY(item.open),yClose=scaleY(item.close),bodyTop=Math.min(yOpen,yClose),bodyHeight=Math.max(Math.abs(yClose-yOpen),3),cssClass=item.tipo==="income"?"income":"expense";h+='<g class="trade-candle '+cssClass+'"><line x1="'+x+'" y1="'+Math.min(yOpen,yClose)+'" x2="'+x+'" y2="'+Math.max(yOpen,yClose)+'"></line><rect x="'+(x-candleW/2)+'" y="'+bodyTop+'" width="'+candleW+'" height="'+bodyHeight+'" rx="1.5"></rect></g>';if(index%Math.max(Math.ceil(buckets.length/7),1)===0||index===buckets.length-1)h+='<text class="trading-axis-label date" x="'+x+'" y="'+(height-11)+'" text-anchor="middle">'+esc(item.etiqueta)+'</text>';});
  if(buckets.length)h+='<line id="cf-crosshair" x1="0" y1="'+top+'" x2="0" y2="'+(height-bottom)+'" style="display:none;"></line>';
  h+='</svg></div>';return h;
}

function renderTrabajoCalendar() {
  const year = state.trabajoCalYear, month = state.trabajoCalMonth;
  const first = new Date(year, month, 1);
  const dowEs = ["Dom", "Lun", "Mar", "Mi\u00e9", "Jue", "Vie", "S\u00e1b"];
  const dowEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dowLabels = LANG === "es" ? dowEs : dowEn;
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = dateKeyOf(new Date());
  const monthName = first.toLocaleDateString(LANG === "es" ? "es-ES" : "en-US", { month: "long", year: "numeric" });

  const byDay = {};
  state.turnos.forEach((tn) => {
    if (!byDay[tn.fecha]) byDay[tn.fecha] = { horas: 0, bruto: 0, ids: [] };
    const r = turnoPagoBruto(tn);
    byDay[tn.fecha].horas += r.horas;
    byDay[tn.fecha].bruto += r.bruto;
    byDay[tn.fecha].ids.push(tn.id);
  });

  let h = '<div class="panel" id="trabajo-calendar-panel">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">';
  h += '<button class="icon-pencil" data-action="trabajoCalPrevMonth" style="transform:rotate(180deg);">' + icon("chevron") + '</button>';
  h += '<h2 style="margin:0;text-transform:capitalize;font-size:16px;">' + esc(monthName) + '</h2>';
  h += '<button class="icon-pencil" data-action="trabajoCalNextMonth">' + icon("chevron") + '</button>';
  h += '</div>';

  h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px;">';
  dowLabels.forEach((d) => { h += '<div style="text-align:center;font-size:10px;font-weight:700;color:var(--text-muted);padding-bottom:4px;">' + d + '</div>'; });
  h += '</div>';

  h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">';
  for (let i = 0; i < startOffset; i++) h += '<div></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    const agg = byDay[ds];
    const worked = !!agg;
    const isToday = ds === todayStr;
    const isSelected = state.trabajoCalSelectedDate === ds;
    let style = "aspect-ratio:1/1;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:12px;font-weight:700;cursor:pointer;background:var(--bg);border:none;font-family:inherit;color:var(--text);position:relative;";
    if (worked) style += "background:color-mix(in srgb,var(--accent) 18%,var(--card-bg));color:var(--accent);";
    if (isToday) style += "outline:2px solid var(--accent);outline-offset:-2px;";
    if (isSelected) style += "outline:2px solid var(--accent);outline-offset:-2px;background:var(--accent);color:var(--accent-contrast);";
    h += '<button type="button" style="' + style + '" data-action="trabajoCalSelectDay" data-id="' + ds + '">';
    h += '<span>' + day + '</span>';
    if (worked) h += '<span style="font-size:7.5px;font-weight:700;margin-top:1px;">' + fmt0(agg.bruto) + '</span>';
    h += '</button>';
  }
  h += '</div>';

  if (state.trabajoCalSelectedDate) {
    const ds = state.trabajoCalSelectedDate;
    const agg = byDay[ds];
    h += '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">';
    h += '<p class="hint" style="margin-bottom:8px;">' + esc(new Date(ds + "T00:00:00").toLocaleDateString(LANG === "es" ? "es-ES" : "en-US", { weekday: "long", day: "numeric", month: "long" })) + '</p>';
    if (agg) {
      agg.ids.forEach((id) => {
        const tn = state.turnos.find((t) => t.id === id);
        if (!tn) return;
        const r = turnoPagoBruto(tn);
        h += '<div class="history-row" style="padding:8px 0;"><div class="history-top"><span>' + fmtHoras(r.horas) + '</span><span class="locked-amount">' + sym() + fmt0(r.bruto) + '</span></div>';
        h += '<button class="delete-link" data-action="trabajoCalQuitarTurno" data-id="' + id + '">' + t("eliminarTurnoLink") + '</button></div>';
      });
    }
    h += '<div class="goal-field" style="margin-top:6px;"><label>' + t("horasTrabajadasLbl") + '</label><input type="text" inputmode="decimal" placeholder="8" id="cal-horas" value="' + esc(state.trabajoCalHorasInput) + '" data-scope="trabajoCalHoras"></div>';
    h += '<button class="pill-btn confirm" style="width:100%;margin-top:8px;" data-action="trabajoCalGuardarHoras">' + t("agregarTurnoBtn") + '</button>';
    h += '</div>';
  }

  h += '</div>';
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
    h += '<div style="width:100%;max-width:28px;height:' + barH + 'px;background:var(--accent);border-radius:4px 4px 0 0;"></div>';
    h += '<div style="font-size:9.5px;color:var(--text-muted);margin-top:4px;white-space:nowrap;">' + esc(it.etiqueta) + '</div>';
    h += '</div>';
  });
  h += '</div>';
  return h;
}

function utilBarHtml(uso, usoNivel) {
  return '<div class="util-bar-track"><div class="util-bar-fill ' + usoNivel + '" style="width:' + uso + '%"></div><div class="util-bar-marker"></div></div>';
}

function renderPagoBlock(type, item, saldoActual) {
  if (toNum(saldoActual) <= 0) return "";
  const isActive = state.payingTarget && state.payingTarget.type === type && state.payingTarget.id === item.id;
  if (!isActive) {
    return '<button class="pay-trigger" data-action="startPago" data-type="' + type + '" data-id="' + item.id + '">' + icon("card") + ' ' + (type === "loan" ? (LANG === "es" ? "Registrar cuota cobrada" : "Record charged payment") : t("pagarBtn")) + '</button>';
  }
  let h = '<div class="pay-form">';
  h += '<div class="payment-record-note">' + icon("info") + '<span>' + (LANG === "es" ? "Esto registra el pago en 305 Save. No descuenta del ahorro ni del débito y no envía dinero al banco." : "This records the payment in 305 Save. It does not deduct savings or debit and does not send money to the bank.") + '</span></div>';
  h += '<input type="text" inputmode="decimal" placeholder="0" id="pago-monto-' + item.id + '" data-scope="payFormMonto" value="' + esc(state.payFormMonto) + '" style="width:100%;margin-top:8px;font-size:18px;font-weight:700;">';
  h += '<div style="display:flex;gap:8px;margin-top:8px;">';
  h += '<button class="pill-btn confirm" style="flex:1;" data-action="confirmPago">' + t("confirmarPago") + '</button>';
  h += '<button class="pill-btn" style="flex:1;" data-action="cancelPago">' + t("cancel") + '</button>';
  h += '</div></div>';
  return h;
}

function navTabDefinitions() {
  return {
    cuentas: { id: "cuentas", icon: "receipt", label: t("tabCuentas") },
    trabajo: { id: "trabajo", icon: "clockmoney", label: t("tabTrabajo") },
    inicio: { id: "inicio", icon: "home", label: t("tabInicio") },
    tarjetas: { id: "tarjetas", icon: "card", label: LANG === "es" ? "Tarjetas" : "Cards" },
    opciones: { id: "opciones", icon: "gear", label: t("optionsTitle") },
  };
}

function renderTabBar() {
  const definitions = navTabDefinitions();
  const tabs = normalizeNavOrder(state.navOrder).map((id) => definitions[id]);
  let h = '<div class="tab-bar">';
  tabs.forEach((tb) => {
    h += '<button class="tab-btn' + (state.activeTab === tb.id ? " active" : "") + '" data-action="goTab" data-id="' + tb.id + '"><span class="tab-icon">' + icon(tb.icon) + (tb.id === "opciones" && UPDATE_AVAILABLE ? '<span class="dot" style="top:2px;right:14px;"></span>' : '') + '</span><span class="tab-label">' + esc(tb.label) + '</span></button>';
  });
  h += '</div>';
  return h;
}


function renderSubscriptionAssistSheet() {
  const insights = computeInsights();
  const item = insights.suscripcionesDetectadas.find((s) => String(s.key) === String(state.subscriptionAssistKey));
  if (!item) return "";
  const fecha = item.proxima instanceof Date && !isNaN(item.proxima) ? item.proxima.toLocaleDateString(LANG === "es" ? "es-US" : "en-US") : "";
  const draft = LANG === "es"
    ? "Asunto: Solicitud de cancelación de " + item.nombre + "\n\nSolicito cancelar mi suscripción y detener futuras renovaciones y cargos. Confirmen por escrito la fecha efectiva de cancelación y que no se realizarán cargos adicionales.\n\nNombre de la cuenta: [COMPLETAR]\nCorreo de la cuenta: [COMPLETAR]"
    : "Subject: Cancellation request for " + item.nombre + "\n\nPlease cancel my subscription and stop future renewals and charges. Confirm in writing the effective cancellation date and that no additional charges will be made.\n\nAccount name: [COMPLETE]\nAccount email: [COMPLETE]";
  let h = '<div class="options-overlay"><div class="options-sheet">';
  h += '<div class="options-head"><h2>' + (LANG === "es" ? "Revisar suscripción" : "Review subscription") + '</h2><button class="options-close" data-action="closeSubscriptionAssist">' + icon("close") + '</button></div>';
  h += '<h3 style="margin:4px 0 2px;">' + esc(item.nombre) + '</h3><p class="hint">' + sym() + fmt2(item.monto) + ' · ' + esc(item.frecuencia) + (fecha ? ' · ' + fecha : '') + '</p>';
  h += '<div style="padding:11px 13px;border-radius:12px;background:var(--surface-2);margin:12px 0;font-size:13px;">' + (LANG === "es" ? "La app prepara la solicitud. Tú debes revisarla y enviarla; no cancela ni contacta al comercio sin tu acción." : "The app prepares the request. You review and send it; it does not cancel or contact the merchant without your action.") + '</div>';
  h += '<textarea id="subscription-draft" readonly style="width:100%;min-height:190px;padding:13px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);font:inherit;resize:vertical;">' + esc(draft) + '</textarea>';
  h += '<div class="tx-btn-row" style="margin-top:12px;"><button class="pill-btn confirm" style="flex:1;" data-action="copySubscriptionDraft">' + (state.subscriptionAssistCopied ? (LANG === "es" ? "Copiado" : "Copied") : (LANG === "es" ? "Copiar solicitud" : "Copy request")) + '</button><button class="pill-btn" style="flex:1;" data-action="markSubscriptionCanceled" data-id="' + esc(item.key) + '">' + (LANG === "es" ? "Marcar cancelada" : "Mark canceled") + '</button></div>';
  h += '</div></div>';
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
    html += '<div class="tab-subheader"><h2>' + t(tab === "cuentas" ? "tabCuentas" : tab === "insights" ? "tabInsights" : tab === "opciones" ? "optionsTitle" : tab === "tarjetas" ? (LANG === "es" ? "Tarjetas" : "Cards") : tab === "trabajo" ? "tabTrabajo" : "tabHistorial") + '</h2></div>';
  }

  if (tab === "inicio") {
    const debitoBanco = saldoDebitoBanco();
    const patrimonioNeto = debitoBanco + toNum(state.ahorroActual);
    const disponibleHoy = patrimonioNeto;
    const tarjetasReales = cloudCreditCards();
    const deudaTarjetas = tarjetasReales.length > 0
      ? tarjetasReales.reduce((sum, card) => sum + Math.max(toNum(card.balance_current), 0), 0)
      : t2.totalDeuda;
    html += '<div class="hero-card">';
    html += '<span class="hero-lbl">' + t("patrimonioNetoLbl") + '</span>';
    html += '<div class="hero-val' + (patrimonioNeto < 0 ? " neg" : "") + '">' + (patrimonioNeto < 0 ? "\u2212" : "") + sym() + fmt0(Math.abs(patrimonioNeto)) + '</div>';
    html += '<div class="hero-sub"><span>' + t("disponibleHoyLbl") + '</span><b>' + sym() + fmt0(disponibleHoy) + '</b></div>';
    html += '</div>';
    const smartAdvice = computeSmartAdvice();
    if (smartAdvice.length) {
      html += '<div class="panel smart-advice-panel"><div class="panel-head-row"><h2>' + (LANG === "es" ? "Qué hacer ahora" : "What to do now") + '</h2></div>';
      smartAdvice.forEach((tip) => {
        html += '<div class="smart-advice ' + tip.level + '">' + icon(tip.level === "urgent" || tip.level === "blink" ? "alert" : tip.level === "credit" ? "card" : tip.level === "save" ? "bills" : "check") + '<span>' + esc(tip.text) + '</span></div>';
      });
      html += '</div>';
    }
    const rs = computeResumenSemanal();
    if (rs) {
      html += '<div class="panel"><h2>' + t("semanaTitle") + '</h2>';
      html += '<div class="mini-total"><span>' + t("semanaGastadoLbl") + '</span><b class="locked-amount">' + sym() + fmt0(rs.total) + '</b></div>';
      if (rs.cambioPct !== null) {
        const subio = rs.cambioPct > 0;
        html += '<p class="opt-row-sub" style="color:' + (subio ? "#FF3B30" : "#34C759") + ';margin-top:6px;">' + t(subio ? "semanaMasMsg" : "semanaMenosMsg")(Math.round(Math.abs(rs.cambioPct))) + '</p>';
      }
      const maxDia = Math.max.apply(null, rs.dias.concat([1]));
      html += '<div class="week-bars">';
      rs.dias.forEach((v, i) => {
        const activo = i <= rs.diaHoy;
        const sel = state.diaSemanaSel === i;
        html += '<button class="week-day' + (sel ? " sel" : "") + '" data-action="verDiaSemana" data-id="' + i + '"><div class="week-bar-track"><div class="week-bar-fill' + (i === rs.diaHoy ? " hoy" : "") + (sel ? " sel" : "") + '" style="height:' + Math.max((v / maxDia) * 100, v > 0 ? 6 : 2) + '%;opacity:' + (activo ? 1 : 0.25) + ';"></div></div><span class="week-day-lbl' + (i === rs.diaHoy ? " hoy" : "") + '">' + t("semanaDias")[i] + '</span></button>';
      });
      html += '</div>';
      if (state.diaSemanaSel !== null && rs.dias[state.diaSemanaSel] !== undefined) {
        html += '<div class="day-detail"><span class="day-detail-lbl">' + esc(rs.nombresDias[state.diaSemanaSel]) + '</span><b class="day-detail-amt">' + sym() + fmt0(rs.dias[state.diaSemanaSel]) + '</b></div>';
      }
      if (rs.topCat) html += '<p class="opt-row-sub" style="margin-top:8px;">' + t("semanaTopMsg")(t("cat_" + rs.topCat), sym() + fmt0(rs.topMonto)) + '</p>';
      html += '</div>';
    }
    html += '<div class="summary">';
    html += '<div class="sum-card"><div class="sum-label">' + t("debitoLbl") + '</div><div class="sum-val blue">' + sym() + fmt0(debitoBanco) + '</div><div class="opt-row-sub">' + (state.authToken ? (LANG === "es" ? "Saldo automático del banco" : "Automatic bank balance") : (LANG === "es" ? "Conecta el banco para cargarlo" : "Connect the bank to load it")) + '</div></div>';
    html += '<div class="sum-card"><div class="sum-label">' + t("debesTarjetas") + '</div><div class="sum-val red">' + sym() + fmt0(deudaTarjetas) + '</div></div>';
    html += '<div class="sum-card"><div class="sum-label">' + t("ahorradoActual") + '</div><div class="sum-val green">' + sym() + fmt0(toNum(state.ahorroActual)) + '</div><div class="opt-row-sub">' + (LANG === "es" ? "Ahorro en efectivo" : "Cash savings") + '</div></div>';
    html += '<div class="sum-card"><div class="sum-label">' + t("disponibleMes") + '</div><div class="sum-val blue">' + (t2.disponibleBruto >= 0 ? "" : "-") + sym() + fmt0(Math.abs(t2.disponibleBruto)) + '</div><span class="status-pill ' + t2.liveStatus.key + '">' + t2.liveStatus.label + '</span></div>';
    html += '</div>';
    html += '<div class="summary">';
    if (np) html += '<div class="sum-card"><div class="sum-label">' + t("proximoPago") + '</div><div class="sum-val blue" style="font-size:16px;">' + esc(diasLabel(np.diffDays)) + '</div><div class="opt-row-sub">' + esc(formatDate(np.date)) + (np.ajustado ? ' ' + icon("pencil") : "") + '</div></div>';
    html += '</div>';

    if (t2.disponibleBruto > 0) {
      const debitoBase = debitoBanco;
      const sugGustos = debitoBase * 0.2;
      const resultadoMes = t2.ingresoEfectivo > 0 ? computeResultado(t2) : null;
      const ahorroBase = resultadoMes && !resultadoMes.insuficiente ? resultadoMes.ahorro : t2.disponibleBruto * (state.savingsRate / 100);
      const pendienteObjetivos = state.goals.reduce((sum, goal) => sum + Math.max(toNum(goal.montoObjetivo) - Math.min(toNum(state.ahorroActual), toNum(goal.montoObjetivo)), 0), 0);
      const aporteObjetivosMensual = pendienteObjetivos > 0 ? pendienteObjetivos / 12 : 0;
      const pesoObjetivo = state.objetivo === "ahorro" ? 1 : state.objetivo === "credito" ? 0.35 : 0.7;
      const sugAhorro = Math.min(Math.max(ahorroBase, aporteObjetivosMensual * pesoObjetivo), Math.max(t2.disponibleBruto, 0));
      const insGustos = computeInsights();
      const mkActual = monthKey();
      const fijosPagadosEsteMes = state.subs.filter((sub) => sub.merchantKey && gastoFijoPagadoEsteMes(sub)).reduce((a, sub) => { const ux = gastoFijoUltimaTx(sub); return a + (ux ? Math.abs(toNum(ux.monto)) : toNum(sub.monto)); }, 0);
      const suscripcionesEsteMes = state.cloudTransactions.filter((tx) => toNum(tx.monto) < 0 && String(tx.fecha).slice(0, 7) === mkActual && (tx.categoria === "suscripciones" || tx.categoria === "streaming")).reduce((a, tx) => a + Math.abs(toNum(tx.monto)), 0);
      const gastadoGustos = Math.max(insGustos.totalActual - fijosPagadosEsteMes - suscripcionesEsteMes, 0);
      html += '<div class="panel"><h2>' + t("esteMesSugerenciasTitle") + '</h2>';
      const pctGustos = sugGustos > 0 ? Math.min((gastadoGustos / sugGustos) * 100, 100) : 0;
      const gustosNivel = gastadoGustos > sugGustos ? "rojo" : pctGustos < 60 ? "verde" : "amarillo";
      html += '<div class="history-top" style="margin-bottom:4px;"><span class="history-month" style="text-transform:none;">' + t("gastadoGustosLbl") + '</span><span class="locked-amount">' + sym() + fmt0(gastadoGustos) + ' / ' + sym() + fmt0(sugGustos) + '</span></div>';
      html += utilBarHtml(pctGustos, gustosNivel);
      if (gastadoGustos > sugGustos) html += '<p class="opt-row-sub" style="color:#FF3B30;margin-top:4px;">' + t("gustosPasadoMsg") + '</p>';
      html += '<p class="opt-row-sub" style="margin-top:6px;margin-bottom:10px;">' + t("sugGustosHint") + '</p>';

      html += '<div class="mini-total"><span>' + t("sugAhorroLbl") + '</span><b>' + sym() + fmt0(sugAhorro) + '</b></div>';
      html += '<p class="opt-row-sub" style="margin:5px 0 0;">' + (LANG === "es" ? "Modo de ahorro: " : "Savings mode: ") + state.savingsRate + '%' + (pendienteObjetivos > 0 ? ' · ' + (LANG === "es" ? "Objetivos pendientes: " : "Goals remaining: ") + sym() + fmt0(pendienteObjetivos) : '') + '</p>';
      if (!state.showConfirmarAhorro) {
        html += '<button class="pill-btn wide" style="margin-top:8px;" data-action="abrirConfirmarAhorro">' + (LANG === "es" ? "Agregar ahorro en efectivo" : "Add cash savings") + '</button>';
      } else {
        html += '<div class="goal-field" style="margin-top:8px;"><label>' + (LANG === "es" ? "Saldo de efectivo ahorrado (usa negativo para retirar)" : "Cash savings balance (use negative to withdraw)") + ' ' + sym() + '</label><input type="text" inputmode="decimal" id="confirmar-ahorro-input" placeholder="0" data-scope="montoConfirmarAhorro" value="' + esc(state.montoConfirmarAhorro) + '" style="width:100%;"></div>';
        html += '<div style="display:flex;gap:8px;margin-top:8px;"><button class="pill-btn confirm" style="flex:1;" data-action="confirmarAhorroMes">' + t("siSumar") + '</button><button class="pill-btn" style="flex:1;" data-action="cancelarConfirmarAhorro">' + t("cancel") + '</button></div>';
      }

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

    html += '<div class="panel"><div class="panel-head-row"><div><h2>' + t("objetivosTitle") + '</h2><p class="hint" style="margin-bottom:0;">' + t("objetivosHint") + '</p></div>';
    if (state.goals.length === 0) {
      html += '<button class="icon-pencil" data-action="addGoal">' + icon("plus") + '</button></div>';
      html += '<div class="empty-state">' + (LANG === "es" ? "Aún no tienes una meta de ahorro." : "You don't have a savings goal yet.") + '</div>';
    } else {
      html += '<button class="icon-pencil' + (state.editingGoals ? " done" : "") + '" data-action="toggleEditGoals">' + (state.editingGoals ? icon("check") : icon("pencil")) + '</button></div>';
      state.goals.forEach((g) => {
      const objetivo = toNum(g.montoObjetivo);
      const actual = Math.min(toNum(state.ahorroActual), objetivo);
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
        html += '<div class="goal-grid" style="margin-bottom:6px;"><input type="text" id="goal-nombre-' + g.id + '" placeholder="' + t("goalNombrePh") + '" data-scope="goal" data-id="' + g.id + '" data-field="nombre" value="' + esc(g.nombre) + '"><button class="icon-del" data-action="askDeleteGoal" data-id="' + g.id + '">' + icon("close") + '</button></div>';
        html += '<div class="goal-grid"><div class="goal-field"><label>' + (LANG === "es" ? "Ahorrado actual" : "Current savings") + ' ' + sym() + '</label><input type="text" inputmode="decimal" id="ahorro-actual-input" data-scope="ahorroActual" placeholder="0" value="' + esc(state.ahorroActual) + '"></div><div class="goal-field"><label>' + t("goalObjetivoLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" id="goal-objetivo-' + g.id + '" placeholder="0" data-scope="goal" data-id="' + g.id + '" data-field="montoObjetivo" value="' + esc(g.montoObjetivo) + '"></div></div>';
        html += '<div class="progress-track" style="margin-top:6px;"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
      }
      html += '</div>';
      });
    }
    html += '</div>';

  }

  if (tab === "cuentas") {
    if (state.autoPagoNotif && state.autoPagoNotif.length > 0) {
      html += '<div class="flash">' + t("autoPagoAplicado")(state.autoPagoNotif.join(", ")) + '</div>';
    }
    html += '<div class="panel"><div class="panel-head-row"><div><h2 style="margin-bottom:0;">' + t("subsTitle") + '</h2></div><div class="panel-head-actions"><button class="icon-pencil sub-add-trigger" data-action="toggleSubPresetPicker">' + icon("plus") + '</button><button class="icon-pencil' + (state.editingSubs ? " done" : "") + '" data-action="toggleEditSubs">' + (state.editingSubs ? icon("check") : icon("pencil")) + '</button></div></div>';
    if (state.subPresetPicker) {
      const bankExpenses = state.cloudTransactions
        .filter((tx) => toNum(tx.monto) < 0 && !state.subs.some((sub) => String(sub.matchedBankTxId || "") === String(tx.id)))
        .slice();
      if (state.bankExpenseSort === "monto") {
        bankExpenses.sort((a, b) => Math.abs(toNum(a.monto)) - Math.abs(toNum(b.monto)) || String(b.fecha || "").localeCompare(String(a.fecha || "")));
      } else if (state.bankExpenseSort === "monto_desc") {
        bankExpenses.sort((a, b) => Math.abs(toNum(b.monto)) - Math.abs(toNum(a.monto)) || String(b.fecha || "").localeCompare(String(a.fecha || "")));
      } else if (state.bankExpenseSort === "nombre") {
        bankExpenses.sort((a, b) => String(a.merchant_name || a.descripcion || "").localeCompare(String(b.merchant_name || b.descripcion || ""), LANG === "es" ? "es" : "en", { sensitivity: "base" }) || String(b.fecha || "").localeCompare(String(a.fecha || "")));
      } else {
        bankExpenses.sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
      }
      const bankQuery = String(state.bankExpenseSearch || "").trim().toLowerCase(); const filteredBankExpenses = bankQuery ? bankExpenses.filter((tx) => String(tx.merchant_name || tx.descripcion || "").toLowerCase().indexOf(bankQuery) !== -1) : bankExpenses; filteredBankExpenses.splice(80);
      html += '<div class="sub-add-picker bank-expense-picker" id="bank-expense-picker">';
      html += '<div class="bank-expense-picker-head"><b>' + (LANG === "es" ? "Selecciona un gasto del banco" : "Select a bank expense") + '</b><button class="icon-del" data-action="toggleSubPresetPicker">' + icon("close") + '</button></div>';
      html += '<input type="search" id="bank-expense-search" placeholder="' + (LANG === "es" ? "Buscar por nombre" : "Search by name") + '" data-scope="bankExpenseSearch" value="' + esc(state.bankExpenseSearch || "") + '" style="width:100%;margin:8px 0;">';
      html += '<div class="bank-expense-sort"><button class="' + (state.bankExpenseSort === "fecha" ? "active" : "") + '" data-action="setBankExpenseSort" data-id="fecha">' + (LANG === "es" ? "Recientes" : "Recent") + '</button><button class="' + (state.bankExpenseSort === "monto" ? "active" : "") + '" data-action="setBankExpenseSort" data-id="monto">' + (LANG === "es" ? "Menor a mayor" : "Low to high") + '</button><button class="' + (state.bankExpenseSort === "monto_desc" ? "active" : "") + '" data-action="setBankExpenseSort" data-id="monto_desc">' + (LANG === "es" ? "Mayor a menor" : "High to low") + '</button><button class="' + (state.bankExpenseSort === "nombre" ? "active" : "") + '" data-action="setBankExpenseSort" data-id="nombre">' + (LANG === "es" ? "Por nombre" : "By name") + '</button></div>';
      if (filteredBankExpenses.length === 0) {
        html += '<div class="empty-state">' + (LANG === "es" ? "No hay gastos bancarios disponibles." : "No bank expenses are available.") + '</div>';
      } else {
        filteredBankExpenses.forEach((tx) => {
          html += '<button class="bank-expense-choice" data-action="addSubFromBankTx" data-id="' + esc(tx.id) + '">';
          html += renderTxChip(tx.categoria);
          html += '<span class="bank-expense-choice-info"><b>' + esc(tx.merchant_name || tx.descripcion || "") + '</b><small>' + esc(String(tx.fecha || "").slice(0, 10)) + ' · ' + t("cat_" + (tx.categoria || "otro")) + '</small></span>';
          html += '<strong>−' + sym() + fmt0(Math.abs(toNum(tx.monto))) + '</strong></button>';
        });
      }
      html += '</div>';
    }

    const todayFixed = new Date(); todayFixed.setHours(0, 0, 0, 0);
    function fixedDueDate(sub) {
      const day = Math.min(Math.max(parseInt(sub.diaPago, 10) || 1, 1), 31);
      let due = new Date(todayFixed.getFullYear(), todayFixed.getMonth(), day);
      if (sub.pagadoMes === monthKey()) due = new Date(todayFixed.getFullYear(), todayFixed.getMonth() + 1, day);
      return due;
    }
    const seenFixed = {};
    const uniqueSubs = state.subs.filter((sub) => { const key = String(sub.merchantKey || sub.nombre || "").trim().toLowerCase(); if (!key || seenFixed[key]) return false; seenFixed[key] = true; return true; });
    const unifiedFixed = uniqueSubs.map((sub) => ({ kind: "manual", due: fixedDueDate(sub), item: sub }))
      .sort((a, b) => a.due - b.due);

    unifiedFixed.forEach((entry) => {
      const sub = entry.item;
      if (state.confirmDeleteSubId === sub.id) {
        html += '<div class="confirm-row"><span>' + esc(t("confirmDeleteSubMsg")(sub.nombre || t("subNombrePh"))) + '</span><div class="confirm-row-btns"><button class="pill-btn confirm" data-action="removeSub" data-id="' + sub.id + '">' + t("yesDelete") + '</button><button class="pill-btn" data-action="cancelDeleteSub">' + t("cancel") + '</button></div></div>';
      } else if (state.editingSubs) {
        const icoActual = sub.icono || CATEGORY_ICON[sub.categoria] || CATEGORY_ICON.otro;
        html += '<div class="sub-edit"><button class="sub-ico-btn" id="sub-icon-' + sub.id + '" data-action="abrirIconPicker" data-id="' + sub.id + '">' + icon(icoActual) + '<span class="sub-ico-edit">' + icon("pencil") + '</span></button>';
        html += '<div class="sub-edit-fields"><input type="text" placeholder="' + t("subNombrePh") + '" data-scope="sub" data-id="' + sub.id + '" data-field="nombre" value="' + esc(sub.nombre) + '">';
        html += '<div class="sub-edit-row2"><div class="amount-field"><span class="amount-sym">' + sym() + '</span><input type="text" inputmode="decimal" placeholder="0" data-scope="sub" data-id="' + sub.id + '" data-field="monto" value="' + esc(sub.monto) + '"></div>';
        html += '<input class="sub-due-day" type="number" inputmode="numeric" min="1" max="31" placeholder="' + (LANG === "es" ? "Día" : "Day") + '" data-scope="sub" data-id="' + sub.id + '" data-field="diaPago" value="' + esc(sub.diaPago || "") + '">';
        html += '<select data-scope="sub" data-id="' + sub.id + '" data-field="categoria">';
        CATEGORIES.forEach((cat) => { html += '<option value="' + cat + '"' + (sub.categoria === cat ? " selected" : "") + '>' + t("cat_" + cat) + '</option>'; });
        html += '</select></div></div><button class="icon-del" data-action="askDeleteSub" data-id="' + sub.id + '">' + icon("close") + '</button></div>';
        if (state.iconPickerSubId === sub.id) {
          html += '<div class="icon-picker"><div class="icon-picker-head"><span>' + t("elegirIconoLbl") + '</span><button class="icon-del" data-action="cerrarIconPicker">' + icon("close") + '</button></div><div class="icon-grid">';
          ICON_PICKER.forEach((ik) => { html += '<button class="icon-opt' + (icoActual === ik ? " sel" : "") + '" data-action="elegirIconoSub" data-id="' + sub.id + '|' + ik + '">' + icon(ik) + '</button>'; });
          html += '</div></div>';
        }
      } else {
        const pagado = sub.pagadoMes === monthKey();
        if (state.payingSubId === sub.id) {
          html += '<div class="pay-form" style="margin:8px 0;"><p class="opt-row-sub">' + esc(sub.nombre || t("subNombrePh")) + '</p>';
          html += '<input type="text" inputmode="decimal" placeholder="0" data-scope="payFormMonto" value="' + esc(state.payFormMonto) + '" style="width:100%;margin-top:8px;font-size:18px;font-weight:700;">';
          html += '<div style="display:flex;gap:8px;margin-top:8px;"><button class="pill-btn confirm" style="flex:1;" data-action="confirmPagoSub">' + t("confirmarPago") + '</button><button class="pill-btn" style="flex:1;" data-action="cancelPagoSub">' + t("cancel") + '</button></div></div>';
        } else {
          const ico = sub.icono || CATEGORY_ICON[sub.categoria] || CATEGORY_ICON.otro;
          html += '<div class="sub-item' + (pagado ? " pagado" : "") + '" data-action="toggleSubPagado" data-id="' + sub.id + '" style="cursor:pointer;"><button class="paid-check' + (pagado ? " checked" : "") + '" data-action="toggleSubPagado" data-id="' + sub.id + '">' + (pagado ? icon("check") : "") + '</button>';
          html += '<span class="sub-item-ico">' + icon(ico) + '</span><div class="sub-item-mid"><span class="sub-item-name">' + esc(sub.nombre || t("subNombrePh")) + '</span><span class="sub-item-cat">' + t("cat_" + (sub.categoria || "otro")) + (sub.diaPago ? ' · ' + esc(formatDate(entry.due)) : "") + '</span></div>';
          html += '<span class="sub-item-amt">' + sym() + fmt0(toNum(sub.monto)) + '</span></div>';
        }
      }
    });
    if (unifiedFixed.length === 0 && !state.editingSubs) html += '<div class="empty-state">' + t("subsEmpty") + '</div>';
    if (state.editingSubs) html += '<button class="add-btn" data-action="toggleSubPresetPicker">' + t("addSub") + '</button>';
    if (state.subs.length > 0) {
      const paidCount = state.subs.filter((sub) => sub.pagadoMes === monthKey()).length;
      html += '<div class="mini-total"><span>' + t("subsPagados")(paidCount, state.subs.length) + '</span></div>';
    }
    const unifiedTotal = state.subs.reduce((sum, sub) => sum + toNum(sub.monto), 0);
    html += '<div class="mini-total"><span>' + t("totalPagosFijos") + '</span><b>' + sym() + fmt0(unifiedTotal) + '</b></div></div>';

    html += '<button class="section-collapser" data-action="togglePlazos"><span>' + icon("bills") + ' ' + t("loansTitle") + '</span><span class="chev' + (state.plazosAbierto ? " open" : "") + '">' + icon("chevron") + '</span></button>';
    if (state.plazosAbierto) {
    html += '<div class="panel"><div class="panel-head-row"><div><p class="hint" style="margin-bottom:0;">' + t("loansHint") + '</p></div><button class="icon-pencil' + (state.editingLoans ? " done" : "") + '" data-action="toggleEditLoans">' + (state.editingLoans ? icon("check") : icon("pencil")) + '</button></div>';
    state.loans.forEach((l) => {
      const saldo = toNum(l.saldoTotal);
      const original = toNum(l.montoOriginal);
      const pago = toNum(l.montoPago);
      const pagado = saldo <= 0;
      const proyeccion = loanProjection(l, 0);
      const pagosRestantes = proyeccion.periodos;
      const interesEstimado = proyeccion.interesTotal;
      const extraSugerido = pago > 0 ? Math.max(10, Math.round(pago * 0.2)) : 0;
      const proyeccionExtra = extraSugerido > 0 ? loanProjection(l, extraSugerido) : null;
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
        if (!pagado && !proyeccion.imposible) {
          html += '<div class="loan-projection">';
          html += '<div><span>' + (LANG === "es" ? "Total que pagarás" : "Total to pay") + '</span><b>' + sym() + fmt0(proyeccion.totalPagado) + '</b></div>';
          html += '<div><span>' + (LANG === "es" ? "Interés restante" : "Remaining interest") + '</span><b class="negative-text">' + sym() + fmt0(interesEstimado) + '</b></div>';
          html += '<div><span>' + (LANG === "es" ? "Cuotas restantes" : "Payments left") + '</span><b>' + pagosRestantes + '</b></div>';
          html += '</div>';
          if (proyeccionExtra && proyeccionExtra.periodos < proyeccion.periodos) {
            html += '<div class="loan-suggestion">' + (LANG === "es"
              ? "Sugerencia: paga " + sym() + fmt0(extraSugerido) + " extra por cuota. Terminarías " + (proyeccion.periodos - proyeccionExtra.periodos) + " cuotas antes y ahorrarías " + sym() + fmt0(proyeccion.interesTotal - proyeccionExtra.interesTotal) + " en intereses."
              : "Suggestion: pay " + sym() + fmt0(extraSugerido) + " extra per payment. You would finish " + (proyeccion.periodos - proyeccionExtra.periodos) + " payments sooner and save " + sym() + fmt0(proyeccion.interesTotal - proyeccionExtra.interesTotal) + " in interest.") + '</div>';
          }
        } else if (!pagado && proyeccion.imposible) {
          html += '<div class="debt-warn">' + (LANG === "es" ? "La cuota no alcanza para cubrir el interés. Debes aumentar el pago." : "The payment does not cover the interest. Increase the payment.") + '</div>';
        }
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
        html += '<div class="pay-config"><label>' + (LANG === "es" ? "Pago desde el banco" : "Payment from bank") + '</label><button class="pill-btn wide" data-action="toggleLoanBankPicker" data-id="' + l.id + '">' + (l.ultimoPago ? (LANG === "es" ? "Cambiar (\u00faltimo: " : "Change (last: ") + esc(formatDate(l.ultimoPago)) + ')' : (LANG === "es" ? "Seleccionar pago del banco" : "Select payment from bank")) + '</button>';
        html += '<p class="hint" style="margin:5px 0 0;">' + (LANG === "es" ? "Si aún no se te ha cobrado, deja el pago mensual escrito a mano arriba." : "If you haven't been charged yet, leave the monthly payment typed in by hand above.") + '</p></div>';
        if (state.loanBankPicker === l.id) html += renderLoanBankPicker(l.id);
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

    html += '<button class="section-collapser" data-action="toggleCalcTiempo"><span>' + icon("clock") + ' ' + (LANG === "es" ? "Calculadora de tiempo" : "Time calculator") + '</span><span class="chev' + (state.calcTiempoAbierto ? " open" : "") + '">' + icon("chevron") + '</span></button>';
    if (state.calcTiempoAbierto && toNum(state.job.pagoHora) > 0) {
      html += '<div class="panel" style="padding:18px;"><p class="hint" style="margin:0 0 12px;">' + (LANG === "es" ? "Mide una compra con tu tiempo neto de trabajo." : "Measure a purchase using your net working time.") + '</p>';
      html += '<div class="goal-field"><label>' + (LANG === "es" ? "Monto de la compra" : "Purchase amount") + ' ' + sym() + '</label><input id="purchase-time-input" type="text" inputmode="decimal" value="' + esc(state.evaluarCompraMonto || "") + '" placeholder="45"></div>';
      html += '<div id="purchase-time-result" style="font-size:18px;font-weight:800;margin-top:12px;color:var(--accent);">' + esc(textoGastoEnTiempo(state.evaluarCompraMonto)) + '</div>';
      html += '<p class="hint" style="margin:8px 0 0;">' + (LANG === "es" ? "Basado en " : "Based on ") + sym() + fmt2(tarifaNetaTrabajo()) + '/h ' + (LANG === "es" ? "netos estimados." : "estimated net.") + '</p></div>';
    } else if (state.calcTiempoAbierto) {
      html += '<div class="panel" style="padding:18px;"><p class="hint" style="margin:0;">' + (LANG === "es" ? "Configura tu pago por hora en Trabajo para usar la calculadora." : "Set your hourly rate in Work to use the calculator.") + '</p></div>';
    }
  }


  if (tab === "tarjetas") {
    if (state.payFlash) html += '<div class="flash">' + icon("check") + ' ' + t("pagoRegistrado") + '</div>';

    const cloudCards = cloudCreditCards();
    const cardStats = cloudCards.map((card) => {
      const balance = Math.max(toNum(card.balance_current), 0);
      const limit = Math.max(toNum(card.balance_limit), 0);
      const apr = Math.max(toNum(card.liab_apr), 0);
      const minimum = Math.max(toNum(card.liab_pago_minimo), 0);
      const utilization = limit > 0 ? balance / limit * 100 : null;
      const monthlyInterest = apr > 0 ? balance * apr / 1200 : 0;
      return { card, balance, limit, apr, minimum, utilization, monthlyInterest };
    });
    const totalCardBalance = cardStats.reduce((sum, item) => sum + item.balance, 0);
    const totalCardLimit = cardStats.reduce((sum, item) => sum + item.limit, 0);
    const totalMinimum = cardStats.reduce((sum, item) => sum + item.minimum, 0);
    const totalInterestMonth = cardStats.reduce((sum, item) => sum + item.monthlyInterest, 0);
    const overallUtilization = totalCardLimit > 0 ? totalCardBalance / totalCardLimit * 100 : null;
    const unpaidBills = state.subs.filter((sub) => sub.pagadoMes !== monthKey()).reduce((sum, sub) => sum + Math.max(toNum(sub.monto), 0), 0);
    const safeExtra = Math.max(saldoDebitoBanco() + toNum(state.ahorroActual) - unpaidBills - 300, 0);
    const rankedCards = cardStats.slice().sort((a, b) => {
      const aHigh = a.utilization != null && a.utilization > 30 ? 1 : 0;
      const bHigh = b.utilization != null && b.utilization > 30 ? 1 : 0;
      if (aHigh !== bHigh) return bHigh - aHigh;
      if (aHigh) return b.utilization - a.utilization;
      return b.apr - a.apr;
    });
    const priorityCard = rankedCards.find((item) => item.balance > 0) || null;

    if (cloudCards.length > 0) {
      html += '<div class="panel"><div class="panel-head-row"><h2 style="margin-bottom:0;">' + t("tarjetasNubeTitle") + '</h2><span class="sync-badge">' + icon("bank") + t("sincronizadoLbl") + '</span></div>';
      const ccGrads = [
        "linear-gradient(140deg,#1B4E8C 0%,#0C2C52 55%,#081E39 100%)",
        "linear-gradient(140deg,#B3202E 0%,#7A1220 55%,#4A0A14 100%)",
        "linear-gradient(140deg,#6E7681 0%,#454B54 55%,#2A2E34 100%)",
        "linear-gradient(140deg,#0E7C66 0%,#0A5347 55%,#06332C 100%)",
        "linear-gradient(140deg,#5B3A9E 0%,#3A2468 55%,#22143F 100%)"
      ];
      html += '<div class="cc-stack">';
      const expandedCloudCards = state.expandedCloudCardIds || {};
      cloudCards.forEach((c, ccIdx) => {
        const saldo = toNum(c.balance_current);
        const limite = toNum(c.balance_limit);
        const uso = limite > 0 ? Math.min((saldo / limite) * 100, 100) : null;
        const usoNivel = uso === null ? "verde" : uso < 30 ? "verde" : uso < 70 ? "amarillo" : "rojo";
        const liab = c.liab_apr != null || c.liab_pago_minimo != null ? { apr: c.liab_apr, pago_minimo: c.liab_pago_minimo, fecha_limite: c.liab_fecha_limite } : null;
        const exp = !!expandedCloudCards[c.account_id];
        const dim = false;
        html += '<button type="button" class="cc-card' + (exp ? " expanded" : "") + (dim ? " dimmed" : "") + '" data-action="toggleCardNube" data-id="' + esc(c.account_id) + '" style="background:' + ccGrads[ccIdx % ccGrads.length] + ';z-index:' + (exp ? 9 : cloudCards.length - ccIdx) + ';" aria-expanded="' + (exp ? "true" : "false") + '">';
        html += '<div class="cc-top"><span class="cc-bank">' + esc(c.name || t("cardNombrePh")) + '</span>' + (uso !== null ? '<span class="status-pill ' + usoNivel + '">' + Math.round(uso) + '%</span>' : "") + '</div>';
        html += '<div class="cc-mid"><span class="cc-chip"></span><svg class="cc-wave" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 7a7 7 0 0 1 0 6M9 5a10 10 0 0 1 0 10M13 3a13.5 13.5 0 0 1 0 14"/></svg></div>';
        html += '<div class="cc-number">\u2022\u2022\u2022\u2022&nbsp;&nbsp;\u2022\u2022\u2022\u2022&nbsp;&nbsp;\u2022\u2022\u2022\u2022&nbsp;&nbsp;' + (c.mask ? esc(c.mask) : "\u2022\u2022\u2022\u2022") + '</div>';
        html += '<div class="cc-bottom"><span class="cc-label">' + t("debesAhoraLbl") + '</span><span class="cc-balance">' + sym() + fmt0(saldo) + '</span></div>';
        html += '<div class="cc-detail">';
        if (limite > 0) {
          html += utilBarHtml(uso, usoNivel);
          html += '<div class="cc-line"><span>' + sym() + fmt0(saldo) + ' ' + t("deLimiteLbl") + ' ' + sym() + fmt0(limite) + '</span></div>';
          html += '<div class="cc-line"><span>' + t("creditoDisponible") + '</span><span>' + sym() + fmt0(Math.max(limite - saldo, 0)) + '</span></div>';
        }
        if (liab) {
          if (liab.apr) html += '<div class="cc-line"><span>' + t("cardAprLbl") + '</span><span>' + liab.apr + '%</span></div>';
          if (liab.pago_minimo != null) html += '<div class="cc-line"><span>' + t("cardMinimoLbl") + '</span><span>' + sym() + fmt0(toNum(liab.pago_minimo)) + '</span></div>';
          if (liab.apr && saldo > 0) {
            const monthlyInterest = saldo * toNum(liab.apr) / 1200;
            const recommendedPayment = Math.max(toNum(liab.pago_minimo), monthlyInterest + saldo / 36, saldo * 0.03);
            html += '<div class="cc-line"><span>' + (LANG === "es" ? "Interés estimado al mes" : "Estimated monthly interest") + '</span><span>' + sym() + fmt0(monthlyInterest) + '</span></div>';
            html += '<div class="cc-line"><span>' + (LANG === "es" ? "Pago mensual recomendado" : "Recommended monthly payment") + '</span><span>' + sym() + fmt0(recommendedPayment) + '</span></div>';
          }
          if (limite > 0 && uso !== null && uso > 30) {
            const paraTreinta = Math.max(saldo - limite * 0.3, 0);
            html += '<div class="cc-line"><span>' + (LANG === "es" ? "Para bajar a 30% de uso" : "To get to 30% usage") + '</span><span>' + sym() + fmt0(paraTreinta) + '</span></div>';
          }
          if (liab.fecha_limite) html += '<div class="cc-line"><span>' + t("proximoPago") + '</span><span>' + esc(liab.fecha_limite) + '</span></div>';
        }
        html += '</div></button>';
      });
      const totalLimiteTodas = cloudCards.reduce((sum, c) => sum + toNum(c.balance_limit), 0);
      const totalSaldoTodas = cloudCards.reduce((sum, c) => sum + toNum(c.balance_current), 0);
      const totalDisponibleTodas = Math.max(totalLimiteTodas - totalSaldoTodas, 0);
      if (totalLimiteTodas > 0) {
        html += '<div style="text-align:center;margin-top:16px;padding-top:14px;border-top:1px solid var(--border);">';
        html += '<span class="hint" style="display:block;margin-bottom:2px;">' + t("creditoDisponible") + '</span>';
        html += '<b style="font-size:26px;font-weight:800;color:var(--accent);">' + sym() + fmt0(totalDisponibleTodas) + '</b>';
        html += '</div>';
      }
      html += '</div></div>';
    }

    html += '<div class="panel cards-dashboard">';
    html += '<div class="panel-head-row"><div><h2>' + (LANG === "es" ? "Estadísticas de tus tarjetas" : "Your card statistics") + '</h2><p class="hint">' + (LANG === "es" ? "Análisis calculado con saldos, límites e intereses disponibles." : "Analysis based on available balances, limits and interest rates.") + '</p></div></div>';
    if (cloudCards.length === 0) {
      html += '<div class="empty-state">' + (LANG === "es" ? "Conecta una tarjeta bancaria para ver su análisis." : "Connect a bank card to see its analysis.") + '</div>';
    } else {
      html += '<div class="card-stat-grid">';
      html += '<div class="card-stat"><span>' + (LANG === "es" ? "Deuda total" : "Total debt") + '</span><b style="color:var(--negative);">' + sym() + fmt0(totalCardBalance) + '</b></div>';
      html += '<div class="card-stat"><span>' + (LANG === "es" ? "Utilización total" : "Total utilization") + '</span><b class="' + (overallUtilization != null && overallUtilization >= 50 ? "bad" : overallUtilization != null && overallUtilization >= 30 ? "warn" : "good") + '">' + (overallUtilization == null ? "—" : Math.round(overallUtilization) + "%") + '</b></div>';
      html += '<div class="card-stat"><span>' + (LANG === "es" ? "Mínimos del mes" : "Monthly minimums") + '</span><b>' + sym() + fmt0(totalMinimum) + '</b></div>';
      html += '<div class="card-stat"><span>' + (LANG === "es" ? "Interés mensual estimado" : "Estimated monthly interest") + '</span><b class="bad">' + sym() + fmt0(totalInterestMonth) + '</b></div>';
      html += '</div>';

      if (priorityCard) {
        const target30 = priorityCard.limit > 0 ? Math.max(priorityCard.balance - priorityCard.limit * 0.30, 0) : 0;
        const normalPayment = Math.max(priorityCard.minimum, priorityCard.monthlyInterest + priorityCard.balance / 36, priorityCard.balance * 0.03);
        const suggestedExtra = Math.min(safeExtra, target30 > 0 ? target30 : normalPayment);
        html += '<div class="card-priority"><div class="card-priority-title">' + icon("alert") + '<span>' + (LANG === "es" ? "Primera prioridad" : "First priority") + '</span></div>';
        html += '<h3>' + esc(priorityCard.card.name || (LANG === "es" ? "Tarjeta" : "Card")) + '</h3>';
        if (priorityCard.utilization != null && priorityCard.utilization > 30) {
          html += '<p>' + (LANG === "es" ? "Está usando " + Math.round(priorityCard.utilization) + "% del límite. Para llegar a 30%, reduce aproximadamente " : "It is using " + Math.round(priorityCard.utilization) + "% of its limit. To reach 30%, reduce it by about ") + '<b>' + sym() + fmt0(target30) + '</b>.</p>';
        } else if (priorityCard.apr > 0) {
          html += '<p>' + (LANG === "es" ? "Es la tarjeta con mayor APR disponible (" : "It has the highest available APR (") + priorityCard.apr + '%). ' + (LANG === "es" ? "Después de pagar todos los mínimos, dirige aquí el dinero extra." : "After all minimums, direct extra money here.") + '</p>';
        }
        html += '<div class="card-action-amount"><span>' + (LANG === "es" ? "Pago sugerido ahora sin usar el dinero reservado para el mes" : "Suggested payment now without using reserved monthly money") + '</span><b>' + sym() + fmt0(suggestedExtra) + '</b></div>';
        if (suggestedExtra <= 0) html += '<p class="hint">' + (LANG === "es" ? "Primero cubre tus pagos pendientes. No se recomienda quedarte sin dinero para bajar la tarjeta." : "Cover pending bills first. Do not run out of cash to lower a card balance.") + '</p>';
        html += '</div>';
      }

      html += '<div class="card-level-list">';
      rankedCards.forEach((item, index) => {
        const level = item.utilization == null ? "unknown" : item.utilization < 10 ? "excellent" : item.utilization < 30 ? "good" : item.utilization < 50 ? "warn" : "bad";
        const label = level === "excellent" ? (LANG === "es" ? "Excelente" : "Excellent") : level === "good" ? (LANG === "es" ? "Bien" : "Good") : level === "warn" ? (LANG === "es" ? "Alta" : "High") : level === "bad" ? (LANG === "es" ? "Crítica" : "Critical") : (LANG === "es" ? "Sin límite disponible" : "No limit available");
        const toThirty = item.limit > 0 ? Math.max(item.balance - item.limit * 0.30, 0) : 0;
        html += '<div class="card-level-row"><span class="card-rank">' + (index + 1) + '</span><div><b>' + esc(item.card.name || (LANG === "es" ? "Tarjeta" : "Card")) + '</b><small>' + (item.apr ? item.apr + "% APR · " : "") + (LANG === "es" ? "Mínimo " : "Minimum ") + sym() + fmt0(item.minimum) + '</small></div><div class="card-level-right"><span class="card-level ' + level + '">' + label + '</span><b>' + (item.utilization == null ? "—" : Math.round(item.utilization) + "%") + '</b></div></div>';
        if (toThirty > 0) html += '<p class="card-level-tip">' + (LANG === "es" ? "Baja " : "Reduce by ") + sym() + fmt0(toThirty) + (LANG === "es" ? " para llegar a 30%." : " to reach 30%.") + '</p>';
      });
      html += '</div>';
      html += '<div class="credit-help"><h3>' + (LANG === "es" ? "Orden recomendado" : "Recommended order") + '</h3><ol><li>' + (LANG === "es" ? "Paga al menos el mínimo de todas antes de la fecha límite." : "Pay at least every minimum before its due date.") + '</li><li>' + (LANG === "es" ? "Baja primero cualquier tarjeta sobre 30%, empezando por la de mayor utilización." : "First lower cards above 30%, starting with the highest utilization.") + '</li><li>' + (LANG === "es" ? "Cuando estén debajo de 30%, dirige el extra a la de mayor APR." : "Once below 30%, direct extra money to the highest APR.") + '</li><li>' + (LANG === "es" ? "Evita cerrar tarjetas antiguas sin revisar antes su impacto en el límite total." : "Avoid closing older cards without checking the impact on total available credit.") + '</li></ol></div>';
    }
    html += '</div>';
  }

  if (tab === "trabajo") {
    if (state.workNotifBanner) html += '<div class="top-action rojo"><b>' + esc(state.workNotifBanner.title) + '</b><br>' + esc(state.workNotifBanner.body) + '</div>';
    if (state.workPagoFlash) html += '<div class="flash">' + icon("check") + ' ' + t("pagoTrabajoRegistrado") + '</div>';

    if (toNum(state.job.pagoHora) > 0) {
      html += '<div class="panel" style="text-align:center;padding:14px 18px;"><p class="hint" style="margin:0;">' + esc(horarioStatusText()) + '</p></div>';
    }

    // resumen del mes/semana
    const tm = totalesMes(); const ts = totalesSemana();
    html += '<div class="summary">';
    html += '<div class="sum-card"><div class="sum-label">' + t(state.trabajoPeriodoDefault === "semanal" ? "ganadoSemanaLbl" : state.trabajoPeriodoDefault === "mensual" ? "ganadoEsteMesLbl" : "ganadoQuincenaLbl") + '</div><div class="sum-val blue">' + sym() + fmt0(ganadoPeriodoDefault()) + '</div></div>';
    html += '<div class="sum-card"><div class="sum-label">' + t("recibidoEsteMesLbl") + '</div><div class="sum-val green">' + sym() + fmt0(recibidoEsteMes()) + '</div></div>';
    html += '<div class="sum-card"><div class="sum-label">' + t("pendienteLbl") + '</div><div class="sum-val blue">' + sym() + fmt0(pendienteDePago()) + '</div></div>';
    html += '<div class="sum-card"><div class="sum-label">' + t("horasSemanaLbl") + '</div><div class="sum-val blue" style="font-size:16px;">' + fmtHoras(ts.horas) + '</div></div>';
    html += '</div>';

    // turno activo o boton empezar
    {
      const t2live = state.turnoActivo;
      const enBreak = !!(t2live && t2live.breakActivo);
      html += '<div class="panel" style="text-align:center;">';
      if (t2live && !enBreak) {
        const ms = turnoDurationMs(Object.assign({}, t2live, { breaks: t2live.breaks.concat(t2live.breakActivo ? [{ inicio: t2live.breakActivo.inicio }] : []) }), true);
        const bruto = toNum(state.job.pagoHora) * (ms / 3600000);
        html += '<p class="hint" style="margin-bottom:4px;">' + t("trabajandoAhoraLbl") + '</p>';
        html += '<div style="font-size:34px;font-weight:800;letter-spacing:-0.01em;font-family:monospace;">' + fmtCronometro(ms) + '</div>';
        html += '<div class="opt-row-sub" style="margin:4px 0 12px;">' + t("brutoAcumuladoLbl") + ': ' + sym() + bruto.toFixed(2) + '</div>';
      } else if (t2live && enBreak) {
        const ms = turnoDurationMs(Object.assign({}, t2live, { breaks: t2live.breaks.concat(t2live.breakActivo ? [{ inicio: t2live.breakActivo.inicio }] : []) }), true);
        const bruto = toNum(state.job.pagoHora) * (ms / 3600000);
        const limiteMin = toNum(state.job.limiteAlmuerzo) || 30;
        const breakMs = breakDurationMs(t2live.breakActivo);
        const limiteMs = limiteMin * 60000;
        const frac = Math.min(1, breakMs / limiteMs);
        const circ = 2 * Math.PI * 54;
        const offset = circ * (1 - frac);
        const ringColor = breakMs >= limiteMs ? "#FF3B30" : breakMs >= limiteMs * 0.8 ? "#FF9F0A" : "var(--accent)";
        html += '<div class="break-ring-wrap"><svg width="132" height="132" viewBox="0 0 132 132" style="transform:rotate(-90deg);">';
        html += '<circle cx="66" cy="66" r="54" stroke="var(--pill-bg)" stroke-width="10" fill="none"/>';
        html += '<circle cx="66" cy="66" r="54" stroke="' + ringColor + '" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '"/>';
        html += '</svg><div class="break-ring-text"><div class="break-ring-time">' + fmtBreakMS(breakMs) + '</div><div class="break-ring-limit">' + t("enBreakLbl") + ' \u00b7 ' + limiteMin + ' min</div></div></div>';
        if (state.job.descansoPagado) html += '<div class="opt-row-sub" style="margin:8px 0 0;">' + t("brutoAcumuladoLbl") + ': ' + sym() + bruto.toFixed(2) + '</div>';
      } else {
        html += '<p class="hint" style="margin-bottom:4px;">' + t("empezarTrabajoBtn") + '</p>';
      }
      html += '<div class="work-btn-grid">';
      html += slideOrDisabled(!t2live, "empezarTrabajo", t("empezarTrabajoBtn"), false);
      html += slideOrDisabled(!!t2live && !enBreak, "empezarBreak", t("empezarBreakBtn"), false);
      html += slideOrDisabled(enBreak, "terminarBreak", t("terminarBreakBtn"), false);
      html += slideOrDisabled(!!t2live, "terminarTrabajo", t("terminarTrabajoBtn"), true);
      html += '</div>';
      html += '<p class="hint" style="text-align:center;margin:8px 0 0;">' + t("deslizaHint") + '</p>';
      html += '</div>';
    }

    // calendario de turnos
    html += renderTrabajoCalendar();

    // panel configuracion del trabajo
    html += '<div class="panel" id="trabajo-job-panel"><div class="panel-head-row"><div><h2>' + t("miTrabajoTitle") + '</h2><p class="hint" style="margin-bottom:0;">' + t("miTrabajoHint") + '</p></div><button class="icon-pencil' + (state.editingJob ? " done" : "") + '" data-action="toggleEditJob">' + (state.editingJob ? icon("check") : icon("pencil")) + '</button></div>';
    if (!state.editingJob) {
      html += '<div class="sub-row-locked" style="border-bottom:none;"><span class="locked-name">' + esc(state.job.nombre || t("trabajoNombrePh")) + '<small style="display:block;color:var(--text-muted);font-weight:600;margin-top:3px;">' + (state.job.tipoLaboral === "1099" ? "1099" : "W-2") + ' · ' + porcentajeRetencionTrabajo() + '% · ' + sym() + fmt2(tarifaNetaTrabajo()) + '/h ' + (LANG === "es" ? "netos" : "net") + '</small></span><span class="locked-amount">' + sym() + fmt0(toNum(state.job.pagoHora)) + '/h</span></div>';
    } else {
      html += '<div class="goal-grid">';
      html += '<div class="goal-field"><label>' + t("trabajoNombreLbl") + '</label><input type="text" placeholder="' + t("trabajoNombrePh") + '" id="job-nombre" value="' + esc(state.job.nombre) + '" data-scope="job" data-field="nombre"></div>';
      html += '<div class="goal-field"><label>' + t("pagoHoraLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="18" id="job-pagoHora" value="' + esc(state.job.pagoHora) + '" data-scope="job" data-field="pagoHora"></div>';
      html += '</div>';
      html += '<div class="goal-field" style="margin-top:10px;"><label>' + (LANG === "es" ? "Tipo de ingreso" : "Income type") + '</label><div class="seg" style="width:100%;"><button style="flex:1;" class="' + (state.job.tipoLaboral !== "1099" ? "active" : "") + '" data-action="setJobW2">W-2</button><button style="flex:1;" class="' + (state.job.tipoLaboral === "1099" ? "active" : "") + '" data-action="setJob1099">1099</button></div></div>';
      html += '<div class="goal-field" style="margin-top:12px;"><label>' + (LANG === "es" ? "Retención estimada" : "Estimated withholding") + ' <b id="job-tax-value">' + porcentajeRetencionTrabajo() + '%</b></label><input id="job-tax-slider" type="range" min="0" max="60" step="1" value="' + porcentajeRetencionTrabajo() + '" style="width:100%;accent-color:var(--accent);"><p class="hint" style="margin:5px 0 0;">' + (LANG === "es" ? "Estimación manual; ajústala según tu recibo de pago." : "Manual estimate; adjust it to your paystub.") + '</p></div>';
      html += '<div class="goal-field" style="margin-top:10px;"><label>' + t("pagoDiaLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="' + t("limiteOpcionalPh") + '" id="job-pagoDia" value="' + esc(state.job.pagoDia) + '" data-scope="job" data-field="pagoDia"></div>';
      html += '<div class="pay-config"><label>' + t("frecuenciaPagoLbl") + '</label><div class="seg" style="width:100%;">';
      [["semanal", "paySemanal"], ["quincenal", "payQuincenal"], ["mensual", "payMensual"]].forEach((f) => { html += '<button style="flex:1;" class="' + (state.job.frecuenciaPago === f[0] ? "active" : "") + '" data-action="setJobFrecuencia" data-freq="' + f[0] + '">' + t(f[1]) + '</button>'; });
      html += '</div></div>';
      html += '<div class="goal-grid" style="margin-top:8px;">';
      html += '<div class="goal-field"><label>' + t("horasExtraDespuesLbl") + '</label><input type="text" inputmode="decimal" placeholder="40" id="job-horasExtraDespues" value="' + esc(state.job.horasExtraDespues) + '" data-scope="job" data-field="horasExtraDespues"></div>';
      html += '<div class="goal-field"><label>' + t("multiplicadorExtraLbl") + '</label><input type="text" inputmode="decimal" placeholder="1.5" id="job-multiplicadorExtra" value="' + esc(state.job.multiplicadorExtra) + '" data-scope="job" data-field="multiplicadorExtra"></div>';
      html += '</div>';
      html += '<div class="goal-grid" style="margin-top:8px;">';
      html += '<div class="goal-field"><label>' + t("limiteAlmuerzoLbl") + '</label><input type="text" inputmode="numeric" placeholder="30" id="job-limiteAlmuerzo" value="' + esc(state.job.limiteAlmuerzo) + '" data-scope="job" data-field="limiteAlmuerzo"></div>';
      html += '</div>';
      html += '<label style="font-size:13px;font-weight:600;color:var(--text-muted);display:block;margin:10px 0 6px;">' + t("horarioTrabajoLbl") + '</label>';
      html += '<div class="seg" style="margin-bottom:8px;">';
      t("diasSemanaCortos").forEach((dnom, di) => {
        html += '<button style="flex:1;padding:8px 0;font-size:11px;" class="' + (state.job.horarioDias[di] ? "active" : "") + '" data-action="toggleHorarioDia" data-id="' + di + '">' + dnom + '</button>';
      });
      html += '</div>';
      html += '<div class="goal-grid">';
      html += '<div class="goal-field"><label>' + t("horarioInicioLbl") + '</label><input type="text" inputmode="numeric" maxlength="5" placeholder="09:00" id="job-horarioInicio" value="' + esc(state.job.horarioInicio) + '" data-scope="job" data-field="horarioInicio"></div>';
      html += '<div class="goal-field"><label>' + t("horarioFinLbl") + '</label><input type="text" inputmode="numeric" maxlength="5" placeholder="17:00" id="job-horarioFin" value="' + esc(state.job.horarioFin) + '" data-scope="job" data-field="horarioFin"></div>';
      html += '</div>';
      html += '<div class="opt-row" style="margin-top:2px;"><span class="opt-row-label">' + t("horarioRecordarLbl") + '</span><div class="seg"><button class="' + (!state.job.horarioRecordar ? "active" : "") + '" data-action="setHorarioRecordarOff">' + t("off") + '</button><button class="' + (state.job.horarioRecordar ? "active" : "") + '" data-action="setHorarioRecordarOn">' + t("on") + '</button></div></div>';
      html += '<div class="opt-row" style="margin-top:8px;"><span class="opt-row-label">' + t("descansoPagadoLbl") + '</span><div class="seg"><button class="' + (!state.job.descansoPagado ? "active" : "") + '" data-action="setDescansoPagadoOff">' + t("off") + '</button><button class="' + (state.job.descansoPagado ? "active" : "") + '" data-action="setDescansoPagadoOn">' + t("on") + '</button></div></div>';
      html += '<p class="opt-row-sub" style="margin-top:6px;">' + notifStatusText() + '</p>';
    }
    html += '</div>';

    // lista de pagos recibidos
    if (state.pagosTrabajo.length > 0) {
      html += '<div class="panel"><h2>' + t("pagosRecibidosTitle") + '</h2>';
      state.pagosTrabajo.slice().reverse().slice(0, 10).forEach((p) => {
        if (state.confirmDeletePagoTrabajoId === p.id) {
          html += '<div class="confirm-row"><span>' + esc(t("confirmDeletePagoMsg")(p.fecha)) + '</span><div class="confirm-row-btns"><button class="pill-btn confirm" data-action="removePagoTrabajo" data-id="' + p.id + '">' + t("yesDelete") + '</button><button class="pill-btn" data-action="cancelDeletePagoTrabajo">' + t("cancel") + '</button></div></div>';
        } else {
          html += '<div class="history-row"><div class="history-top"><span class="history-month" style="text-transform:none;">' + esc(p.fecha) + '</span><span class="locked-amount">' + sym() + fmt0(toNum(p.montoNeto)) + '</span></div>';
          html += '<div class="history-meta"><span>' + esc(p.metodo || "") + '</span><button class="history-del" data-action="askDeletePagoTrabajo" data-id="' + p.id + '">' + t("eliminar") + '</button></div></div>';
        }
      });
      html += '</div>';
    }
  }


  if (tab === "cuentas") {
    const subscriptionInsights = computeInsights();
    const activeSubscriptions = subscriptionInsights.suscripcionesDetectadas.filter((s) => !s.cancelada);
    html += '<div id="subscription-review-panel">';
    html += '<button class="section-collapser" data-action="toggleSubscriptionReview"><span>' + icon("bills") + ' ' + (LANG === "es" ? "Suscripciones detectadas" : "Detected subscriptions") + ' <b>(' + activeSubscriptions.length + ')</b></span><span class="chev' + (state.subscriptionReviewOpen ? " open" : "") + '">' + icon("chevron") + '</span></button>';
    if (state.subscriptionReviewOpen) {
      html += '<div class="panel"><div class="mini-total"><span>' + (LANG === "es" ? "Costo mensual estimado" : "Estimated monthly cost") + '</span><b>' + sym() + fmt2(subscriptionInsights.suscripcionesTotalMensual) + '</b></div>';
      if (!activeSubscriptions.length) html += '<div class="empty-state">' + (LANG === "es" ? "Aún no hay cargos recurrentes suficientes para confirmar." : "There are not enough recurring charges to confirm yet.") + '</div>';
      activeSubscriptions.forEach((s) => {
        html += '<div class="card-entry"><div class="card-collapsed-top"><span class="card-collapsed-name">' + esc(s.nombre) + '</span><span class="locked-amount">' + sym() + fmt2(s.monto) + '</span></div>';
        html += '<p class="opt-row-sub" style="margin:2px 0 10px;">' + esc(s.frecuencia) + ' · ' + (s.diasFaltan >= 0 ? (LANG === "es" ? "en " : "in ") + s.diasFaltan + (LANG === "es" ? " días" : " days") : (LANG === "es" ? "fecha estimada vencida" : "estimated date passed")) + '</p>';
        html += '<div style="display:flex;gap:8px;"><button class="pill-btn confirm" style="flex:1;" data-action="addDetectedSubscription" data-id="' + esc(s.key) + '">' + (LANG === "es" ? "Agregar" : "Add") + '</button><button class="pill-btn" style="flex:1;" data-action="marcarNoSuscripcion" data-id="' + esc(s.key) + '">' + (LANG === "es" ? "No es suscripción" : "Not a subscription") + '</button></div></div>';
      });
      html += '</div>';
    }
    html += '</div>';
  }

  if (tab === "historial" || tab === "cuentas") {
    if (tab === "cuentas") {
      html += '<button class="section-collapser" data-action="toggleCuentasHistorial"><span>' + icon("clock") + ' ' + t("tabHistorial") + '</span><span class="chev' + (state.cuentasHistorialAbierto ? " open" : "") + '">' + icon("chevron") + '</span></button>';
    }
    if (tab === "historial" || state.cuentasHistorialAbierto) {
    const comprasBase = state.cloudTransactions.filter((tx) => toNum(tx.monto) < 0);
    const recibidosBase = state.cloudTransactions.filter((tx) => toNum(tx.monto) > 0);
    if (comprasBase.length > 0 || recibidosBase.length > 0) {
      html += '<div class="panel">';
      html += '<div class="seg" style="width:100%;margin-bottom:10px;"><button style="flex:1;" class="' + (state.historialVista === "compras" ? "active" : "") + '" data-action="setHistorialVista" data-id="compras">' + t("comprasTitle") + '</button><button style="flex:1;" class="' + (state.historialVista === "recibidos" ? "active" : "") + '" data-action="setHistorialVista" data-id="recibidos">' + t("pagosRecibidosBancoTitle") + '</button></div>';

      const listaBase = state.historialVista === "recibidos" ? recibidosBase : comprasBase;
      const categoriasPresentes = Array.from(new Set(listaBase.map((tx) => tx.categoria || "otros")));
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
      gruposCompras.forEach((grupo) => {
        const abierto = state.historialMesAbierto === grupo.monthKey;
        const totalMes = grupo.items.reduce((a, tx) => a + Math.abs(toNum(tx.monto)), 0);
        html += '<button class="sub-row-locked" style="width:100%;text-align:left;border:none;background:none;cursor:pointer;font:inherit;color:inherit;" data-action="toggleMesHistorial" data-id="' + grupo.monthKey + '"><span class="locked-name" style="display:flex;align-items:center;gap:6px;"><span class="chev' + (abierto ? " open" : "") + '">' + icon("chevron") + '</span>' + esc(grupo.label) + '</span><span class="locked-amount">' + sym() + fmt0(totalMes) + '</span></button>';
        if (abierto) {
          grupo.items.forEach((tx) => {
            html += renderTxRow(tx.descripcion, tx.categoria, tx.monto, String(tx.fecha).slice(0, 10), "", tx.id);
          });
        }
      });

      html += '</div>';
    } else {
      html += '<div class="panel"><div class="empty-state">' + (state.authToken ? (LANG === "es" ? "Aún no hay movimientos guardados." : "No transactions saved yet.") : (LANG === "es" ? "Conecta tu banco para ver tu historial aquí." : "Connect your bank to see your history here.")) + '</div></div>';
    }
    }
  }

  if (tab === "insights" || tab === "cuentas") {
    if (tab === "cuentas") {
      html += '<button class="section-collapser" data-action="toggleCuentasAnalisis"><span>' + icon("chart2") + ' ' + t("tabInsights") + '</span><span class="chev' + (state.cuentasAnalisisAbierto ? " open" : "") + '">' + icon("chevron") + '</span></button>';
    }
    if (tab === "insights" || state.cuentasAnalisisAbierto) {
    if (tab === "cuentas") html += '<div class="section-title-divider"><h2>' + t("tabInsights") + '</h2></div>';

    // Flujo de caja: grafica tipo velas (verde=ingreso, rojo=gasto)
    html += '<div class="panel">';
    html += '<div class="seg" style="margin-bottom:6px;">';
    [["day", "periodoDia"], ["week", "periodoSemana"], ["month", "periodoMes"]].forEach((p) => {
      html += '<button style="flex:1;" class="' + (state.cashflowPeriod === p[0] ? "active" : "") + '" data-action="setCashflowPeriod" data-id="' + p[0] + '">' + t(p[1]) + '</button>';
    });
    html += '</div>';
    html += renderCashflowChart(buildCashflowBuckets(state.cashflowPeriod));
    html += '</div>';

    if (state.subs.length > 0) {
      const subsAnual = state.subs.map((s) => ({ nombre: s.nombre || t("subNombrePh"), anual: toNum(s.monto) * 12 })).sort((a, b) => b.anual - a.anual);
      const totalAnual = subsAnual.reduce((sum, s) => sum + s.anual, 0);
      html += '<div class="panel"><h2>' + (LANG === "es" ? "Suscripciones al año" : "Subscriptions per year") + '</h2>';
      html += '<div class="mini-total"><span>' + (LANG === "es" ? "Total al año" : "Total per year") + '</span><b>' + sym() + fmt0(totalAnual) + '</b></div>';
      subsAnual.forEach((s) => {
        html += '<div class="sub-row-locked"><span class="locked-name">' + esc(s.nombre) + '</span><span class="locked-amount">' + sym() + fmt0(s.anual) + '/' + (LANG === "es" ? "año" : "yr") + '</span></div>';
      });
      html += '</div>';
    }

  }

  }

  if (tab === "opciones") {
    html += renderOpcionesTab();
  }

  html += '</div>';
  html += renderTabBar();
  if (state.showExport) html += renderExportSheet();
  if (state.showTxDetalle) html += renderTxDetalleSheet();
  if (state.subscriptionAssistKey) html += renderSubscriptionAssistSheet();
  if (state.showConsentimiento) html += renderConsentimientoSheet();
  html += '</div>';

  root.innerHTML = html;
}

function renderBreakLockScreen() {
  const turno = state.turnoActivo;
  const limiteMin = toNum(state.job.limiteAlmuerzo) || 30;
  const breakMs = breakDurationMs(turno.breakActivo);
  const limiteMs = limiteMin * 60000;
  const frac = Math.min(1, breakMs / limiteMs);
  const circ = 2 * Math.PI * 88;
  const offset = circ * (1 - frac);
  const ringColor = breakMs >= limiteMs ? "#FF3B30" : breakMs >= limiteMs * 0.8 ? "#FF9F0A" : "#34C759";
  const now = new Date();
  const timeStr = now.toLocaleTimeString(LANG === "es" ? "es-ES" : "en-US", { hour: "numeric", minute: "2-digit" });
  const dateStr = now.toLocaleDateString(LANG === "es" ? "es-ES" : "en-US", { weekday: "long", day: "numeric", month: "long" });

  let h = '<div style="position:fixed;inset:0;background:#0A0A0A;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:env(safe-area-inset-top,20px) 24px calc(env(safe-area-inset-bottom,20px) + 20px);z-index:5000;font-family:inherit;">';
  h += '<button data-action="dismissBreakLock" style="align-self:flex-end;background:none;border:none;color:rgba(255,255,255,0.5);font-size:13px;font-weight:700;font-family:inherit;padding:10px;">' + t("verAppLbl") + '</button>';
  h += '<div style="text-align:center;">';
  h += '<div style="font-size:15px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:capitalize;margin-bottom:2px;">' + esc(dateStr) + '</div>';
  h += '<div style="font-size:56px;font-weight:800;letter-spacing:-0.02em;margin-bottom:28px;">' + esc(timeStr) + '</div>';
  h += '<div style="position:relative;width:200px;height:200px;margin:0 auto;">';
  h += '<svg width="200" height="200" viewBox="0 0 200 200" style="transform:rotate(-90deg);">';
  h += '<circle cx="100" cy="100" r="88" stroke="rgba(255,255,255,0.12)" stroke-width="12" fill="none"/>';
  h += '<circle cx="100" cy="100" r="88" stroke="' + ringColor + '" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '"/>';
  h += '</svg>';
  h += '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">';
  h += '<div style="font-family:monospace;font-size:32px;font-weight:800;">' + fmtBreakMS(breakMs) + '</div>';
  h += '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);margin-top:2px;">' + t("enBreakLbl") + ' \u00b7 ' + limiteMin + ' min</div>';
  h += '</div></div>';
  h += '<p style="font-size:13px;color:rgba(255,255,255,0.55);margin-top:22px;max-width:260px;">' + t("pantallaBloqueadaHint") + '</p>';
  h += '</div>';
  h += '<div class="slide-confirm slide-big" style="width:100%;max-width:340px;" data-slide-action="terminarBreak"><div class="slide-track" style="background:rgba(52,199,89,0.18);"><span class="slide-label" style="color:rgba(255,255,255,0.75);">' + t("terminarBreakBtn") + '</span><div class="slide-handle">' + icon("chevron") + '</div></div></div>';
  h += '</div>';
  root.innerHTML = h;
}

function render() {
  try {
    applyTheme();
    document.documentElement.lang = state.lang;
    if (state.appLocked) renderPinScreen();
    else if (state.screen === "selector") renderSelector();
    else renderApp();
  } catch (e) {
    console.error("render() error:", e);
    try {
      root.innerHTML = '<div style="padding:40px 24px;text-align:center;font-family:inherit;">' +
        '<div style="font-size:15px;font-weight:700;margin-bottom:8px;">Se encontr\u00f3 un error al mostrar esta pantalla</div>' +
        '<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px;word-break:break-word;">' + esc(String(e && e.message || e)) + '</div>' +
        '<button style="padding:12px 22px;border-radius:12px;border:none;background:var(--accent);color:var(--accent-contrast);font-weight:700;font-family:inherit;" onclick="location.reload()">Recargar</button>' +
        '</div>';
    } catch (e2) {}
  }
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
