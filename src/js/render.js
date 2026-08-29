"use strict";

const root = document.getElementById("root");

function renderBancoNubePanel(compact) {
  let html = '<div class="panel">';
  html += '<div class="panel-head-row"><div><h2>' + t("bancoNubeTitle") + '</h2><p class="hint" style="margin-bottom:0;">' + t("bancoNubeHint") + '</p></div></div>';
  if (state.cloudErrorMsg) html += '<p class="opt-row-sub" style="color:#FF3B30;margin:8px 0;">' + esc(state.cloudErrorMsg) + '</p>';
  if (state.cloudFlash) html += '<div class="flash">' + icon("check") + ' ' + esc(state.cloudFlash) + '</div>';

  if (!state.authUser) {
    html += '<button class="pay-trigger" style="background:var(--accent);" data-action="iniciarConectarBanco"' + (state.cloudBusy ? " disabled" : "") + '>' + icon("bank") + ' ' + (state.cloudBusy ? t("conectandoMsg") : t("conectarBancoPlaidBtn")) + '</button>';
    html += '<button class="delete-link" style="display:block;margin:8px auto 0;" data-action="resetConexionNube">' + t("restablecerConexionBtn") + '</button>';
    html += '</div>';
    return html;
  }

  state.cloudInstitutions.filter((inst) => inst.status === "active").forEach((inst) => {
    if (state.confirmDisconnectId === inst.id) {
      html += '<div class="confirm-row"><span>' + esc(t("confirmDesconectarMsg")(inst.institution_name || "")) + '</span><div class="confirm-row-btns"><button class="pill-btn confirm" data-action="confirmDisconnectBank" data-id="' + inst.id + '">' + t("yesDelete") + '</button><button class="pill-btn" data-action="cancelDisconnectBank">' + t("cancel") + '</button></div></div>';
    } else {
      html += '<div class="card-entry"><div class="card-collapsed-top"><span class="card-collapsed-name">' + esc(inst.institution_name || t("bancoDesconocido")) + '</span><span class="status-pill ' + (inst.status === "active" ? "verde" : "rojo") + '">' + (inst.status === "active" ? t("estadoActivo") : t("estadoDesconectado")) + '</span></div>';

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
  h += '<div class="panel"><p class="opt-section-title">' + (LANG === "es" ? "Seguridad local" : "Local security") + '</p>';
  h += '<div class="opt-row"><div><span class="opt-row-label">' + esc(activeProfile ? activeProfile.nombre : "") + '</span><p class="opt-row-sub">' + (pinConfigured ? (LANG === "es" ? "PIN de 6 dígitos activado" : "6-digit PIN enabled") : (LANG === "es" ? "Crea un PIN para bloquear la app en este teléfono." : "Create a PIN to lock the app on this phone.")) + '</p></div></div>';
  h += '<div class="pin-setup-row"><input id="pin-setup-input" data-scope="pinSetup" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" placeholder="••••••" value="' + esc(state.pinSetupInput) + '"><button class="pill-btn confirm" data-action="savePin">' + (pinConfigured ? (LANG === "es" ? "Cambiar PIN" : "Change PIN") : (LANG === "es" ? "Crear PIN" : "Create PIN")) + '</button></div>';
  if (state.pinError) h += '<p class="pin-error">' + esc(state.pinError) + '</p>';
  if (pinConfigured) {
    let biometricConfigured = false;
    try { biometricConfigured = !!localStorage.getItem(BIOMETRIC_CRED_KEY); } catch (error) {}
    h += '<div class="biometric-settings"><button class="pill-btn biometric-btn" data-action="setupBiometric"' + (state.biometricBusy ? " disabled" : "") + '>' + icon("lock") + ' ' + (biometricConfigured ? (LANG === "es" ? "Configurar huella otra vez" : "Set up biometrics again") : (LANG === "es" ? "Activar huella del teléfono" : "Enable phone biometrics")) + '</button>';
    if (biometricConfigured) h += '<span class="biometric-ready">' + icon("check") + ' ' + (LANG === "es" ? "Huella activada" : "Biometrics enabled") + '</span>';
    h += '</div>';
    h += '<button class="delete-link pin-lock-now" data-action="lockApp">' + (LANG === "es" ? "Bloquear ahora" : "Lock now") + '</button>';
  }
  h += '</div>';

  h += '<div class="panel"><p class="opt-section-title">' + t("secPreferencias") + '</p><div class="opt-row"><span class="opt-row-label">' + t("secIdioma") + '</span><div class="seg"><button class="' + (state.lang === "es" ? "active" : "") + '" data-action="setLangEs">ES</button><button class="' + (state.lang === "en" ? "active" : "") + '" data-action="setLangEn">EN</button></div></div>';
  h += '<div class="opt-row"><span class="opt-row-label">' + t("secMoneda") + '</span><div class="seg"><button class="' + (state.currency === "usd" ? "active" : "") + '" data-action="setCurUsd">$</button><button class="' + (state.currency === "eur" ? "active" : "") + '" data-action="setCurEur">€</button></div></div>';
  h += '<div class="opt-row"><span class="opt-row-label">' + t("secTema") + '</span><div class="seg"><button class="' + (state.theme === "light" ? "active" : "") + '" data-action="setThemeLight">' + icon("sun") + '</button><button class="' + (state.theme === "dark" ? "active" : "") + '" data-action="setThemeDark">' + icon("moon") + '</button></div></div>';
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
  h += '<button style="flex:1;" class="' + (state.savingsRate === 10 ? "active" : "") + '" data-action="setAhorroNormal" data-savings-rate="10">' + t("ahorroNormal") + '</button>';
  h += '<button style="flex:1;" class="' + (state.savingsRate === 20 ? "active" : "") + '" data-action="setAhorroMedio" data-savings-rate="20">' + t("ahorroMedio") + '</button>';
  h += '<button style="flex:1;" class="' + (state.savingsRate === 35 ? "active" : "") + '" data-action="setAhorroAgresivo" data-savings-rate="35">' + t("ahorroAgresivo") + '</button>';
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

function renderCashflowChart(buckets) {
  const width=720,height=300,left=20,right=72,top=24,bottom=42,plotW=width-left-right,plotH=height-top-bottom;
  const totalIncome=buckets.reduce((sum,item)=>sum+toNum(item.ingresos),0),totalExpense=buckets.reduce((sum,item)=>sum+toNum(item.gastos),0);
  const values=buckets.reduce((all,item)=>all.concat([toNum(item.open),toNum(item.close)]),[0]);let minValue=Math.min.apply(null,values),maxValue=Math.max.apply(null,values);
  if(minValue===maxValue){minValue-=1;maxValue+=1;}const padding=Math.max((maxValue-minValue)*.12,1);minValue-=padding;maxValue+=padding;
  const scaleY=(value)=>top+((maxValue-value)/(maxValue-minValue))*plotH,step=plotW/Math.max(buckets.length,1),candleW=Math.max(Math.min(step*.62,13),2.5);
  const moneyShort=(value)=>{const n=Math.abs(toNum(value));return n>=1000?(n/1000).toFixed(n>=10000?0:1)+"k":fmt0(n);};
  let h='<div class="trading-chart-shell real-candle-chart"><div class="trading-chart-head"><div><span class="trading-symbol">305 CASH FLOW</span><span class="trading-live"><i></i>'+(buckets.length?(LANG==="es"?"Movimientos reales":"Real transactions"):(LANG==="es"?"Sin actividad":"No activity"))+'</span></div>';
  h+='<div class="trading-net '+(totalIncome-totalExpense>=0?"positive":"negative")+'">'+(totalIncome-totalExpense>=0?"+":"−")+sym()+fmt0(Math.abs(totalIncome-totalExpense))+'</div></div><div class="trading-totals"><span class="positive-text">▲ '+(LANG==="es"?"Pagos":"Income")+' '+sym()+fmt0(totalIncome)+'</span><span class="negative-text">▼ '+(LANG==="es"?"Compras":"Purchases")+' '+sym()+fmt0(totalExpense)+'</span></div><svg class="trading-svg" viewBox="0 0 '+width+' '+height+'" role="img">';
  [0,.25,.5,.75,1].forEach((ratio)=>{const y=top+plotH*ratio,value=maxValue-(maxValue-minValue)*ratio;h+='<line class="trading-grid" x1="'+left+'" y1="'+y+'" x2="'+(width-right)+'" y2="'+y+'"></line><text class="trading-axis-label" x="'+(width-7)+'" y="'+(y+4)+'" text-anchor="end">'+(value<0?"−":"")+sym()+moneyShort(value)+'</text>';});
  if(!buckets.length)h+='<text class="trading-empty-label" x="'+(left+plotW/2)+'" y="'+(top+plotH/2)+'" text-anchor="middle">'+(LANG==="es"?"No hubo movimientos en este período":"No transactions in this period")+'</text>';
  buckets.forEach((item,index)=>{const x=left+step*(index+.5),yOpen=scaleY(item.open),yClose=scaleY(item.close),bodyTop=Math.min(yOpen,yClose),bodyHeight=Math.max(Math.abs(yClose-yOpen),3),cssClass=item.tipo==="income"?"income":"expense";h+='<g class="trade-candle '+cssClass+'"><title>'+esc(item.etiqueta+" · "+item.descripcion+" · "+sym()+fmt0(item.valor))+'</title><line x1="'+x+'" y1="'+Math.min(yOpen,yClose)+'" x2="'+x+'" y2="'+Math.max(yOpen,yClose)+'"></line><rect x="'+(x-candleW/2)+'" y="'+bodyTop+'" width="'+candleW+'" height="'+bodyHeight+'" rx="1.5"></rect></g>';if(index%Math.max(Math.ceil(buckets.length/7),1)===0||index===buckets.length-1)h+='<text class="trading-axis-label date" x="'+x+'" y="'+(height-11)+'" text-anchor="middle">'+esc(item.etiqueta)+'</text>';});
  h+='</svg><div class="trading-chart-foot"><span><i class="income-box"></i>'+(LANG==="es"?"Pagos e ingresos":"Payments and income")+'</span><span><i class="expense-box"></i>'+(LANG==="es"?"Compras y gastos":"Purchases and expenses")+'</span></div></div>';return h;
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
  const blink = uso >= 30 ? " blink" : "";
  return '<div class="util-bar-track"><div class="util-bar-fill ' + usoNivel + blink + '" style="width:' + uso + '%"></div><div class="util-bar-marker"></div></div>';
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

function renderTabBar() {
  const tabs = [
    { id: "cuentas", icon: "receipt", label: t("tabCuentas") },
    { id: "trabajo", icon: "clockmoney", label: t("tabTrabajo") },
    { id: "inicio", icon: "home", label: t("tabInicio") },
    { id: "tarjetas", icon: "card", label: LANG === "es" ? "Tarjetas" : "Cards" },
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
    html += '<div class="tab-subheader"><h2>' + t(tab === "cuentas" ? "tabCuentas" : tab === "insights" ? "tabInsights" : tab === "opciones" ? "optionsTitle" : tab === "tarjetas" ? (LANG === "es" ? "Tarjetas" : "Cards") : tab === "trabajo" ? "tabTrabajo" : "tabHistorial") + '</h2></div>';
  }

  if (tab === "inicio") {
    const patrimonioNeto = toNum(state.ahorroActual) + toNum(state.debito);
    const disponibleHoy = patrimonioNeto;
    const tarjetasReales = cloudCreditCards();
    const deudaTarjetas = tarjetasReales.length > 0
      ? tarjetasReales.reduce((sum, card) => sum + Math.max(toNum(card.balance_current), 0), 0)
      : t2.totalDeuda;
    const deudaPrestamos = state.loans.reduce((sum, loan) => sum + Math.max(toNum(loan.saldoTotal), 0), 0);
    const pagosFijosPendientes = state.subs
      .filter((sub) => sub.pagadoMes !== monthKey())
      .reduce((sum, sub) => sum + Math.max(toNum(sub.monto), 0), 0);
    const deudaTotalReal = deudaTarjetas + deudaPrestamos + pagosFijosPendientes;
    html += '<div class="hero-card">';
    html += '<span class="hero-lbl">' + t("patrimonioNetoLbl") + '</span>';
    html += '<div class="hero-val' + (patrimonioNeto < 0 ? " neg" : "") + '">' + (patrimonioNeto < 0 ? "\u2212" : "") + sym() + fmt0(Math.abs(patrimonioNeto)) + '</div>';
    html += '<div class="hero-sub"><span>' + t("disponibleHoyLbl") + '</span><b>' + sym() + fmt0(disponibleHoy) + '</b></div>';
    html += '</div>';
    const smartAdvice = computeSmartAdvice();
    if (smartAdvice.length) {
      html += '<div class="panel smart-advice-panel"><div class="panel-head-row"><h2>' + (LANG === "es" ? "Estado de tus pagos" : "Payment status") + '</h2></div>';
      smartAdvice.forEach((tip) => { html += '<div class="smart-advice ' + tip.level + '">' + icon(tip.level === "urgent" ? "alert" : tip.level === "credit" ? "card" : tip.level === "save" ? "bills" : "check") + '<span>' + esc(tip.text) + '</span></div>'; });
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
    html += '<button class="sum-card sum-card-btn" data-action="toggleSaldosInicio"><div class="sum-label">' + t("debitoLbl") + ' ' + icon("pencil") + '</div><div class="sum-val blue">' + sym() + fmt0(toNum(state.debito)) + '</div></button>';
    html += '<div class="sum-card"><div class="sum-label">' + t("debesTarjetas") + '</div><div class="sum-val red">' + sym() + fmt0(deudaTarjetas) + '</div></div>';
    html += '<div class="sum-card"><button class="sum-card-inner" data-action="toggleSaldosInicio"><div class="sum-label">' + t("ahorradoActual") + ' ' + icon("pencil") + '</div><div class="sum-val green">' + sym() + fmt0(toNum(state.ahorroActual)) + '</div></button>';
    html += '<div class="sum-card"><div class="sum-label">' + t("debesTotal") + '</div><div class="sum-val red">' + sym() + fmt0(deudaTotalReal) + '</div></div>';
    if (state.confirmSumarAhorro) {
      html += '<div class="quick-confirm"><span>' + t("confirmSumar100Msg")(sym()) + '</span><div class="quick-confirm-btns"><button class="pill-btn confirm" data-action="sumarAhorro100">' + t("siSumar") + '</button><button class="pill-btn" data-action="cancelSumarAhorro">' + t("cancel") + '</button></div></div>';
    } else {
      html += '<button class="quick-add" data-action="pedirSumarAhorro">+' + sym() + '100</button>';
    }
    html += '</div>';
    html += '</div>';

    if (state.editingSaldosInicio) {
      html += '<div class="panel"><h2>' + t("saldosManualesTitle") + '</h2>';
      html += '<div class="goal-field"><label>' + t("debitoLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="0" id="debito-input" data-scope="debito" value="' + esc(state.debito) + '" style="width:100%;"></div>';
      html += '<div class="goal-field" style="margin-top:10px;"><label>' + t("ahorroActualLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="0" id="ahorro-actual-input" data-scope="ahorroActual" value="' + esc(state.ahorroActual) + '" style="width:100%;"></div>';
      html += '<button class="pill-btn confirm" style="width:100%;margin-top:10px;" data-action="toggleSaldosInicio">' + t("listoBtn") + '</button>';
      html += '</div>';
    }
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
      if (!state.showConfirmarAhorro) {
        html += '<button class="pill-btn wide" style="margin-top:8px;" data-action="abrirConfirmarAhorro">' + t("confirmarAhorroBtn") + '</button>';
      } else {
        html += '<div class="goal-field" style="margin-top:8px;"><label>' + t("montoAhorradoLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" id="confirmar-ahorro-input" placeholder="0" data-scope="montoConfirmarAhorro" value="' + esc(state.montoConfirmarAhorro) + '" style="width:100%;"></div>';
        html += '<div style="display:flex;gap:8px;margin-top:8px;"><button class="pill-btn confirm" style="flex:1;" data-action="confirmarAhorroMes">' + t("guardarBtn") + '</button><button class="pill-btn" style="flex:1;" data-action="cancelarConfirmarAhorro">' + t("cancel") + '</button></div>';
      }

      const historialAhorro = state.history.slice().sort((a, b) => (a.month < b.month ? 1 : -1)).slice(0, 6);
      if (historialAhorro.length > 0) {
        html += '<p class="opt-section-title" style="margin-top:14px;">' + t("historialAhorroTitle") + '</p>';
        historialAhorro.forEach((h) => {
          html += '<div class="sub-row-locked"><span class="locked-name">' + esc(monthLabel(h.month)) + '</span><span class="locked-amount">' + sym() + fmt0(toNum(h.ahorro)) + '</span></div>';
        });
      }
      html += '</div>';

      const resultadoConsejos = t2.ingresoEfectivo > 0 ? computeResultado(t2) : null;
      const consejosHome = buildSugerencias(t2, resultadoConsejos);
      if (consejosHome.length > 0) {
        html += '<div class="panel"><h2>' + t("consejosTitle") + '</h2>';
        consejosHome.forEach((c) => { html += '<p class="opt-row-sub" style="margin-bottom:8px;">\u2022 ' + esc(c) + '</p>'; });
        html += '</div>';
      }
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

    if (state.goals.length > 0 || state.editingGoals) {
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
        html += '<div class="goal-grid" style="margin-bottom:6px;"><input type="text" id="goal-nombre-' + g.id + '" placeholder="' + t("goalNombrePh") + '" data-scope="goal" data-id="' + g.id + '" data-field="nombre" value="' + esc(g.nombre) + '"><button class="icon-del" data-action="askDeleteGoal" data-id="' + g.id + '">' + icon("close") + '</button></div>';
        html += '<div class="goal-grid">';
        html += '<div class="goal-field"><label>' + t("goalActualLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" id="goal-actual-' + g.id + '" placeholder="0" data-scope="goal" data-id="' + g.id + '" data-field="montoActual" value="' + esc(g.montoActual) + '"></div>';
        html += '<div class="goal-field"><label>' + t("goalObjetivoLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" id="goal-objetivo-' + g.id + '" placeholder="0" data-scope="goal" data-id="' + g.id + '" data-field="montoObjetivo" value="' + esc(g.montoObjetivo) + '"></div>';
        html += '</div>';
        html += '<div class="progress-track" style="margin-top:6px;"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
      }
      html += '</div>';
      });
      if (state.editingGoals) html += '<button class="add-btn" data-action="addGoal">' + t("addGoal") + '</button>';
      html += '</div>';
    } else {
      html += '<button class="fab-add" data-action="addGoal">+ ' + t("addGoal") + '</button>';
    }

    // resumen de Trabajo (para tener todo en un solo vistazo en Inicio)
    html += '<div class="panel" style="cursor:pointer;" data-action="goTab" data-id="trabajo">';
    html += '<div class="panel-head-row"><h2>' + icon("clockmoney") + ' ' + t("tabTrabajo") + '</h2>' + icon("chevron") + '</div>';
    if (state.turnoActivo) {
      const enBreak = !!state.turnoActivo.breakActivo;
      html += '<div class="mini-total"><span>' + t(enBreak ? "enBreakLbl" : "trabajandoAhoraLbl") + '</span><b class="locked-amount" style="color:' + (enBreak ? "#FF9F0A" : "#34C759") + ';">\u25cf</b></div>';
    }
    html += '<div class="mini-total"><span>' + t("ganadoEsteMesLbl") + '</span><b>' + sym() + fmt0(ganadoEsteMes()) + '</b></div>';
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
        .slice()
        .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")))
        .slice(0, 80);
      html += '<div class="sub-add-picker bank-expense-picker" id="bank-expense-picker">';
      html += '<div class="bank-expense-picker-head"><b>' + (LANG === "es" ? "Selecciona un gasto del banco" : "Select a bank expense") + '</b><button class="icon-del" data-action="toggleSubPresetPicker">' + icon("close") + '</button></div>';
      if (bankExpenses.length === 0) {
        html += '<div class="empty-state">' + (LANG === "es" ? "No hay gastos bancarios disponibles." : "No bank expenses are available.") + '</div>';
      } else {
        bankExpenses.forEach((tx) => {
          html += '<button class="bank-expense-choice" data-action="addSubFromBankTx" data-id="' + esc(tx.id) + '">';
          html += '<span class="bank-expense-choice-icon">' + icon(CATEGORY_ICON[tx.categoria] || CATEGORY_ICON.otro) + '</span>';
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
    const unifiedFixed = state.subs.map((sub) => ({ kind: "manual", due: fixedDueDate(sub), item: sub }))
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
          html += '<div class="sub-item' + (pagado ? " pagado" : "") + '"><button class="paid-check' + (pagado ? " checked" : "") + '" data-action="toggleSubPagado" data-id="' + sub.id + '">' + (pagado ? icon("check") : "") + '</button>';
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

    html += '<div class="panel"><div class="panel-head-row"><div><h2>' + t("loansTitle") + '</h2><p class="hint" style="margin-bottom:0;">' + t("loansHint") + '</p></div><button class="icon-pencil' + (state.editingLoans ? " done" : "") + '" data-action="toggleEditLoans">' + (state.editingLoans ? icon("check") : icon("pencil")) + '</button></div>';
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
    const safeExtra = Math.max(toNum(state.debito) + toNum(state.ahorroActual) - unpaidBills - 300, 0);
    const rankedCards = cardStats.slice().sort((a, b) => {
      const aHigh = a.utilization != null && a.utilization > 30 ? 1 : 0;
      const bHigh = b.utilization != null && b.utilization > 30 ? 1 : 0;
      if (aHigh !== bHigh) return bHigh - aHigh;
      if (aHigh) return b.utilization - a.utilization;
      return b.apr - a.apr;
    });
    const priorityCard = rankedCards.find((item) => item.balance > 0) || null;

    html += '<div class="panel cards-dashboard">';
    html += '<div class="panel-head-row"><div><h2>' + (LANG === "es" ? "Estadísticas de tus tarjetas" : "Your card statistics") + '</h2><p class="hint">' + (LANG === "es" ? "Análisis calculado con saldos, límites e intereses disponibles." : "Analysis based on available balances, limits and interest rates.") + '</p></div></div>';
    if (cloudCards.length === 0) {
      html += '<div class="empty-state">' + (LANG === "es" ? "Conecta una tarjeta bancaria para ver su análisis." : "Connect a bank card to see its analysis.") + '</div>';
    } else {
      html += '<div class="card-stat-grid">';
      html += '<div class="card-stat"><span>' + (LANG === "es" ? "Deuda total" : "Total debt") + '</span><b>' + sym() + fmt0(totalCardBalance) + '</b></div>';
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
          if (liab.fecha_limite) html += '<div class="cc-line"><span>' + t("proximoPago") + '</span><span>' + esc(liab.fecha_limite) + '</span></div>';
        }
        html += '</div></button>';
      });
      html += '</div></div>';
    }
  }

  if (tab === "trabajo") {
    if (state.workNotifBanner) html += '<div class="top-action rojo"><b>' + esc(state.workNotifBanner.title) + '</b><br>' + esc(state.workNotifBanner.body) + '</div>';
    if (state.workPagoFlash) html += '<div class="flash">' + icon("check") + ' ' + t("pagoTrabajoRegistrado") + '</div>';

    // panel configuracion del trabajo
    html += '<div class="panel"><div class="panel-head-row"><div><h2>' + t("miTrabajoTitle") + '</h2><p class="hint" style="margin-bottom:0;">' + t("miTrabajoHint") + '</p></div><button class="icon-pencil' + (state.editingJob ? " done" : "") + '" data-action="toggleEditJob">' + (state.editingJob ? icon("check") : icon("pencil")) + '</button></div>';
    if (!state.editingJob) {
      html += '<div class="sub-row-locked" style="border-bottom:none;"><span class="locked-name">' + esc(state.job.nombre || t("trabajoNombrePh")) + '</span><span class="locked-amount">' + sym() + fmt0(toNum(state.job.pagoHora)) + '/h</span></div>';
    } else {
      html += '<div class="goal-grid">';
      html += '<div class="goal-field"><label>' + t("trabajoNombreLbl") + '</label><input type="text" placeholder="' + t("trabajoNombrePh") + '" id="job-nombre" value="' + esc(state.job.nombre) + '" data-scope="job" data-field="nombre"></div>';
      html += '<div class="goal-field"><label>' + t("pagoHoraLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="18" id="job-pagoHora" value="' + esc(state.job.pagoHora) + '" data-scope="job" data-field="pagoHora"></div>';
      html += '</div>';
      html += '<div class="goal-grid">';
      html += '<div class="goal-field"><label>' + t("pagoDiaLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="' + t("limiteOpcionalPh") + '" id="job-pagoDia" value="' + esc(state.job.pagoDia) + '" data-scope="job" data-field="pagoDia"></div>';
      html += '<div class="goal-field"><label>' + t("impuestoPctLbl") + '</label><input type="text" inputmode="decimal" placeholder="0" id="job-impuestoPct" value="' + esc(state.job.impuestoPct) + '" data-scope="job" data-field="impuestoPct"></div>';
      html += '</div>';
      html += '<div class="pay-config"><label>' + t("frecuenciaPagoLbl") + '</label><div class="seg" style="width:100%;">';
      [["semanal", "paySemanal"], ["quincenal", "payQuincenal"], ["dosVecesMes", "freqDosVecesMes"], ["mensual", "payMensual"]].forEach((f) => { html += '<button style="flex:1;" class="' + (state.job.frecuenciaPago === f[0] ? "active" : "") + '" data-action="setJobFrecuencia" data-freq="' + f[0] + '">' + t(f[1]) + '</button>'; });
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
      html += '<div class="goal-field"><label>' + t("horarioInicioLbl") + '</label><input type="time" id="job-horarioInicio" value="' + esc(state.job.horarioInicio) + '" data-scope="job" data-field="horarioInicio"></div>';
      html += '<div class="goal-field"><label>' + t("horarioFinLbl") + '</label><input type="time" id="job-horarioFin" value="' + esc(state.job.horarioFin) + '" data-scope="job" data-field="horarioFin"></div>';
      html += '</div>';
      html += '<div class="opt-row" style="margin-top:2px;"><span class="opt-row-label">' + t("horarioRecordarLbl") + '</span><div class="seg"><button class="' + (!state.job.horarioRecordar ? "active" : "") + '" data-action="setHorarioRecordarOff">' + t("off") + '</button><button class="' + (state.job.horarioRecordar ? "active" : "") + '" data-action="setHorarioRecordarOn">' + t("on") + '</button></div></div>';
      html += '<div class="opt-row" style="margin-top:8px;"><span class="opt-row-label">' + t("descansoPagadoLbl") + '</span><div class="seg"><button class="' + (!state.job.descansoPagado ? "active" : "") + '" data-action="setDescansoPagadoOff">' + t("off") + '</button><button class="' + (state.job.descansoPagado ? "active" : "") + '" data-action="setDescansoPagadoOn">' + t("on") + '</button></div></div>';
      html += '<button class="pill-btn wide" style="margin-top:10px;" data-action="requestWorkNotifPermission">' + t("notifBtnLbl") + '</button>';
      html += '<p class="opt-row-sub" style="margin-top:6px;">' + notifStatusText() + '</p>';
    }
    html += '</div>';

    // resumen del mes/semana
    const tm = totalesMes(); const ts = totalesSemana();
    html += '<div class="summary">';
    html += '<div class="sum-card"><div class="sum-label">' + t("ganadoEsteMesLbl") + '</div><div class="sum-val blue">' + sym() + fmt0(ganadoEsteMes()) + '</div></div>';
    html += '<div class="sum-card"><div class="sum-label">' + t("recibidoEsteMesLbl") + '</div><div class="sum-val green">' + sym() + fmt0(recibidoEsteMes()) + '</div></div>';
    html += '<div class="sum-card"><div class="sum-label">' + t("pendienteLbl") + '</div><div class="sum-val red">' + sym() + fmt0(pendienteDePago()) + '</div></div>';
    html += '<div class="sum-card"><div class="sum-label">' + t("horasSemanaLbl") + '</div><div class="sum-val blue" style="font-size:16px;">' + fmtHoras(ts.horas) + '</div></div>';
    html += '</div>';

    // turno activo o boton empezar
    if (state.turnoActivo) {
      const t2live = state.turnoActivo;
      const enBreak = !!t2live.breakActivo;
      const ms = turnoDurationMs(Object.assign({}, t2live, { breaks: t2live.breaks.concat(t2live.breakActivo ? [{ inicio: t2live.breakActivo.inicio }] : []) }), true);
      const bruto = toNum(state.job.pagoHora) * (ms / 3600000);
      html += '<div class="panel" style="text-align:center;">';
      if (!enBreak) {
        html += '<p class="hint" style="margin-bottom:4px;">' + t("trabajandoAhoraLbl") + '</p>';
        html += '<div style="font-size:34px;font-weight:800;letter-spacing:-0.01em;font-family:monospace;">' + fmtCronometro(ms) + '</div>';
        html += '<div class="opt-row-sub" style="margin:4px 0 12px;">' + t("brutoAcumuladoLbl") + ': ' + sym() + fmt0(bruto) + '</div>';
      } else {
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
        if (state.job.descansoPagado) html += '<div class="opt-row-sub" style="margin:8px 0 0;">' + t("brutoAcumuladoLbl") + ': ' + sym() + fmt0(bruto) + '</div>';
      }
      html += '<div style="display:flex;gap:8px;margin-top:12px;">';
      if (enBreak) html += '<button class="pill-btn wide confirm" style="flex:1;" data-action="terminarBreak">' + t("terminarBreakBtn") + '</button>';
      else if (!state.confirmEmpezarBreak) html += '<button class="pill-btn wide" style="flex:1;" data-action="askEmpezarBreak">' + t("empezarBreakBtn") + '</button>';
      else html += '<div style="flex:1;display:flex;gap:8px;"><button class="pill-btn confirm" style="flex:1;" data-action="empezarBreak">' + t("siEmpezar") + '</button><button class="pill-btn" style="flex:1;" data-action="cancelEmpezarBreak">' + t("cancel") + '</button></div>';
      html += '</div>';
      if (!enBreak && state.confirmEmpezarBreak) html += '<p class="hint" style="text-align:center;margin:6px 0 0;">' + t("confirmEmpezarBreakMsg") + '</p>';
      if (!state.confirmTerminarTrabajo) {
        html += '<button class="pay-trigger" style="margin-top:8px;background:#FF3B30;" data-action="askTerminarTrabajo">' + t("terminarTrabajoBtn") + '</button>';
      } else {
        html += '<div class="confirm-row" style="margin-top:8px;justify-content:center;"><span>' + t("confirmTerminarMsg") + '</span></div>';
        html += '<div style="display:flex;gap:8px;"><button class="pill-btn confirm" style="flex:1;" data-action="terminarTrabajo">' + t("yesDelete") + '</button><button class="pill-btn" style="flex:1;" data-action="cancelTerminarTrabajo">' + t("cancel") + '</button></div>';
      }
      html += '</div>';
    } else {
      html += '<button class="calc-btn" data-action="empezarTrabajo">' + t("empezarTrabajoBtn") + '</button>';
    }

    // registrar pago recibido
    if (state.showPagoTrabajo) {
      const f = state.pagoTrabajoForm;
      const sinPagar = state.turnos.filter((x) => x.estado !== "pagado");
      html += '<div class="panel"><h2>' + t("agregarPagoTrabajoTitle") + '</h2>';
      html += '<div class="goal-grid">';
      html += '<div class="goal-field"><label>' + t("fechaLbl") + '</label><input type="date" id="pt-fecha" value="' + esc(f.fecha) + '" data-scope="pagoTrabajo" data-field="fecha"></div>';
      html += '<div class="goal-field"><label>' + t("montoNetoLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="0" id="pt-neto" value="' + esc(f.montoNeto) + '" data-scope="pagoTrabajo" data-field="montoNeto"></div>';
      html += '</div>';
      html += '<div class="goal-grid">';
      html += '<div class="goal-field"><label>' + t("montoBrutoLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" placeholder="' + t("limiteOpcionalPh") + '" id="pt-bruto" value="' + esc(f.montoBruto) + '" data-scope="pagoTrabajo" data-field="montoBruto"></div>';
      html += '<div class="goal-field"><label>' + t("metodoLbl") + '</label><input type="text" placeholder="' + t("metodoPh") + '" id="pt-metodo" value="' + esc(f.metodo) + '" data-scope="pagoTrabajo" data-field="metodo"></div>';
      html += '</div>';
      if (sinPagar.length > 0) {
        html += '<p class="opt-row-sub" style="margin:8px 0 6px;">' + t("turnosIncluidosLbl") + '</p>';
        sinPagar.forEach((tn) => {
          const r = turnoPagoBruto(tn);
          const checked = !!f.turnosSel[tn.id];
          html += '<div class="opt-row" style="padding:6px 0;"><span class="opt-row-label" style="font-weight:500;font-size:12.5px;">' + esc(tn.fecha) + ' \u00b7 ' + fmtHoras(r.horas) + ' \u00b7 ' + sym() + fmt0(r.bruto) + '</span><button class="paid-check' + (checked ? " checked" : "") + '" data-action="toggleTurnoSel" data-id="' + tn.id + '">' + (checked ? icon("check") : "") + '</button></div>';
        });
      }
      html += '<div style="display:flex;gap:8px;margin-top:10px;"><button class="pill-btn confirm" style="flex:1;" data-action="confirmPagoTrabajo">' + t("confirmarPago") + '</button><button class="pill-btn" style="flex:1;" data-action="cancelPagoTrabajo">' + t("cancel") + '</button></div>';
      html += '</div>';
    } else {
      html += '<button class="save-month-btn" data-action="startPagoTrabajo">' + t("agregarPagoTrabajoBtn") + '</button>';
    }

    // lista de turnos
    html += '<div class="panel"><div class="panel-head-row"><h2>' + t("turnosTitle") + '</h2><button class="icon-pencil' + (state.showAgregarTurno ? " done" : "") + '" data-action="' + (state.showAgregarTurno ? "cancelAgregarTurno" : "startAgregarTurno") + '">' + (state.showAgregarTurno ? icon("close") : icon("plus")) + '</button></div><p class="hint">' + t("turnosHint") + '</p>';
    if (state.showAgregarTurno) {
      html += '<div class="goal-grid" style="margin-bottom:10px;">';
      html += '<div class="goal-field"><label>' + t("fechaLbl") + '</label><input type="date" id="at-fecha" value="' + esc(state.agregarTurnoForm.fecha) + '" data-scope="agregarTurno" data-field="fecha"></div>';
      html += '<div class="goal-field"><label>' + t("horasTrabajadasLbl") + '</label><input type="text" inputmode="decimal" placeholder="8" id="at-horas" value="' + esc(state.agregarTurnoForm.horas) + '" data-scope="agregarTurno" data-field="horas"></div>';
      html += '</div>';
      html += '<button class="pill-btn wide confirm" data-action="confirmAgregarTurno">' + t("agregarTurnoBtn") + '</button>';
    }
    const turnosRecientes = state.turnos.slice(0, 15);
    turnosRecientes.forEach((tn) => {
      const r = turnoPagoBruto(tn);
      if (state.confirmDeleteTurnoId === tn.id) {
        html += '<div class="confirm-row"><span>' + esc(t("confirmDeleteTurnoMsg")(tn.fecha)) + '</span><div class="confirm-row-btns"><button class="pill-btn confirm" data-action="removeTurno" data-id="' + tn.id + '">' + t("yesDelete") + '</button><button class="pill-btn" data-action="cancelDeleteTurno">' + t("cancel") + '</button></div></div>';
        return;
      }
      const expanded = !!state.expandedTurnoIds[tn.id];
      html += '<div class="card-entry">';
      html += '<div class="card-collapsed-top"><span class="card-collapsed-name">' + esc(tn.fecha) + ' \u00b7 ' + fmtHoras(r.horas) + '</span><span class="status-pill ' + (tn.estado === "pagado" ? "verde" : "amarillo") + '">' + (tn.estado === "pagado" ? t("estadoPagado") : t("estadoTrabajado")) + '</span></div>';
      html += '<div class="history-meta"><span>' + sym() + fmt0(r.bruto) + ' ' + t("brutoLbl") + '</span><button class="icon-pencil" data-action="toggleExpandTurno" data-id="' + tn.id + '">' + (expanded ? icon("check") : icon("pencil")) + '</button></div>';
      if (expanded) {
        html += '<div class="card-fields" style="margin-top:8px;">';
        html += '<div><span class="field-label">' + t("propinasLbl") + ' ' + sym() + '</span><input type="text" inputmode="decimal" placeholder="0" data-scope="turno" data-id="' + tn.id + '" data-field="propinas" value="' + esc(tn.propinas) + '"></div>';
        html += '<div><span class="field-label">' + t("bonosLbl") + ' ' + sym() + '</span><input type="text" inputmode="decimal" placeholder="0" data-scope="turno" data-id="' + tn.id + '" data-field="bonos" value="' + esc(tn.bonos) + '"></div>';
        html += '</div>';
        html += '<div class="goal-field" style="margin-top:8px;"><label>' + t("notasLbl") + '</label><input type="text" placeholder="' + t("notasPh") + '" data-scope="turno" data-id="' + tn.id + '" data-field="notas" value="' + esc(tn.notas) + '"></div>';
        html += '<button class="delete-link" data-action="askDeleteTurno" data-id="' + tn.id + '">' + t("eliminarTurnoLink") + '</button>';
      }
      html += '</div>';
    });
    if (state.turnos.length === 0) html += '<div class="empty-state">' + t("turnosEmpty") + '</div>';
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

  if (tab === "historial" || tab === "cuentas") {
    if (tab === "cuentas") {
      html += '<button class="section-collapser" data-action="toggleCuentasHistorial"><span>' + icon("clock") + ' ' + t("tabHistorial") + '</span><span class="chev' + (state.cuentasHistorialAbierto ? " open" : "") + '">' + icon("chevron") + '</span></button>';
    }
    if (tab === "historial" || state.cuentasHistorialAbierto) {
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
        html += '<button class="sub-row-locked" style="width:100%;text-align:left;border:none;background:none;cursor:pointer;font:inherit;color:inherit;" data-action="toggleMesHistorial" data-id="' + grupo.monthKey + '"><span class="locked-name" style="display:flex;align-items:center;gap:6px;"><span class="chev' + (abierto ? " open" : "") + '">' + icon("chevron") + '</span>' + esc(grupo.label) + '</span><span class="locked-amount">' + sym() + fmt0(totalMes) + '</span></button>';
        if (abierto) {
          grupo.items.forEach((tx) => {
            html += renderTxRow(tx.descripcion, tx.categoria, tx.monto, String(tx.fecha).slice(0, 10), "", tx.id);
          });
        }
      });

      html += '</div>';
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
    html += '<div class="panel-head-row"><h2>' + t("flujoCajaTitle") + '</h2></div>';
    html += '<div class="cash-month-picker" aria-label="Mes del gráfico">';
    for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
      const monthDate = new Date();
      monthDate.setDate(1);
      monthDate.setMonth(monthDate.getMonth() - monthOffset);
      const monthKey = monthDate.getFullYear() + "-" + String(monthDate.getMonth() + 1).padStart(2, "0");
      html += '<button class="cash-month-btn' + (Number(state.cashflowMonthOffset || 0) === monthOffset ? " active" : "") + '" data-action="setCashflowMonth" data-id="' + monthOffset + '">' + esc(monthLabel(monthKey)) + '</button>';
    }
    html += '</div>';
    html += '<div class="seg" style="margin-bottom:6px;">';
    [["day", "periodoDia"], ["week", "periodoSemana"], ["month", "periodoMes"]].forEach((p) => {
      html += '<button style="flex:1;" class="' + (state.cashflowPeriod === p[0] ? "active" : "") + '" data-action="setCashflowPeriod" data-id="' + p[0] + '">' + t(p[1]) + '</button>';
    });
    html += '</div>';
    html += renderCashflowChart(buildCashflowBuckets(state.cashflowPeriod, state.cashflowMonthOffset));
    html += '<div style="display:flex;gap:14px;font-size:11.5px;color:var(--text-muted);margin-bottom:4px;"><span>\ud83d\udfe2 ' + t("legendIngreso") + '</span><span>\ud83d\udd34 ' + t("legendGasto") + '</span></div>';
    html += '<p class="hint" style="margin-bottom:0;">' + t("flujoCajaHint") + '</p>';
    html += '</div>';

    const deudasPlan = listaDeudas();
    if (deudasPlan.length > 0) {
      const comp = computeComparativaDeuda(state.debtStrategy, toNum(state.extraPagoDeuda));
      html += '<div class="panel"><h2>' + t("planDeudaTitle") + '</h2><p class="hint">' + t("planDeudaHint") + '</p>';
      html += '<div class="seg" style="width:100%;margin-top:8px;"><button style="flex:1;" class="' + (state.debtStrategy === "avalancha" ? "active" : "") + '" data-action="setDebtAvalancha">' + t("estrategiaAvalancha") + '</button><button style="flex:1;" class="' + (state.debtStrategy === "bola_nieve" ? "active" : "") + '" data-action="setDebtBolaNieve">' + t("estrategiaBolaNieve") + '</button></div>';
      html += '<p class="opt-row-sub" style="margin-top:6px;">' + t(state.debtStrategy === "avalancha" ? "avalanchaExplica" : "bolaNieveExplica") + '</p>';
      html += '<div class="goal-field" style="margin-top:12px;"><label>' + t("extraPagoLbl") + ' ' + sym() + '</label><input type="text" inputmode="decimal" id="extra-pago-deuda-input" placeholder="0" data-scope="extraPagoDeuda" value="' + esc(state.extraPagoDeuda) + '" style="width:100%;"></div>';

      if (comp) {
        html += '<div class="debt-result">';
        html += '<div class="debt-big"><span class="debt-big-lbl">' + t("librePagoLbl") + '</span><b class="debt-big-val">' + (comp.meses ? esc(fechaLibre(comp.meses)) : t("noAlcanzaMsg")) + '</b>';
        if (comp.meses) html += '<span class="debt-big-sub">' + t("enMesesMsg")(comp.meses) + '</span>';
        html += '</div>';
        html += '<div class="debt-grid">';
        html += '<div class="debt-cell"><span>' + t("pagasAlMesLbl") + '</span><b>' + sym() + fmt0(comp.pagoMensual) + '</b></div>';
        html += '<div class="debt-cell"><span>' + t("interesTotalLbl") + '</span><b class="rojo">' + sym() + fmt0(comp.interes) + '</b></div>';
        html += '<div class="debt-cell"><span>' + t("deudaHoyLbl") + '</span><b>' + sym() + fmt0(comp.totalSaldo) + '</b></div>';
        html += '<div class="debt-cell"><span>' + t("totalPagarasLbl") + '</span><b>' + sym() + fmt0(comp.totalAPagar) + '</b></div>';
        html += '</div>';
        if (toNum(state.extraPagoDeuda) > 0 && comp.mesesAhorrados > 0) {
          html += '<div class="debt-win">' + icon("check") + '<span>' + t("ahorrasConExtraMsg")(comp.mesesAhorrados, sym() + fmt0(comp.interesAhorrado)) + '</span></div>';
        }
        if (comp.nuncaTermina && toNum(state.extraPagoDeuda) <= 0) {
          html += '<div class="debt-warn">' + t("soloMinimosNuncaMsg") + '</div>';
        }
        if (comp.sugerencia) {
          const txtSug = comp.sugerencia.ahorro > 0
            ? t("sugerenciaExtraMsg")(sym() + fmt0(comp.sugerencia.extra), comp.sugerencia.meses, sym() + fmt0(comp.sugerencia.ahorro))
            : t("sugerenciaExtraSimpleMsg")(sym() + fmt0(comp.sugerencia.extra), comp.sugerencia.meses);
          html += '<div class="debt-tip"><span class="debt-tip-lbl">' + t("sugerenciaLbl") + '</span><p>' + txtSug + '</p>';
          html += '<button class="pill-btn confirm" data-action="aplicarSugerenciaExtra" data-id="' + comp.sugerencia.extra + '">' + t("aplicarSugerenciaBtn")(sym() + fmt0(comp.sugerencia.extra)) + '</button></div>';
        }
        if (comp.sinApr > 0) html += '<p class="opt-row-sub" style="margin-top:10px;">' + t("faltaAprMsg")(comp.sinApr) + '</p>';

        html += '<p class="opt-section-title" style="margin-top:16px;">' + t("ordenAtaqueTitle") + '</p>';
        const ordenMostrar = state.debtStrategy === "avalancha" ? comp.orden.slice().sort((a, b) => b.apr - a.apr) : comp.orden.slice().sort((a, b) => a.saldo - b.saldo);
        ordenMostrar.forEach((d, idx) => {
          html += '<div class="debt-row"><span class="debt-num">' + (idx + 1) + '</span>';
          html += '<div class="debt-row-mid"><span class="debt-row-name">' + esc(d.nombre) + '</span><span class="debt-row-sub">' + (d.apr > 0 ? d.apr + "% APR" : t("sinAprLbl")) + (d.mesesParaPagar ? " \u00b7 " + t("enMesesCortoMsg")(d.mesesParaPagar) : "") + '</span></div>';
          html += '<span class="debt-row-amt">' + sym() + fmt0(d.saldo) + '</span></div>';
        });
      }
      html += '</div></div>';
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
  if (state.showConsentimiento) html += renderConsentimientoSheet();
  html += '</div>';

  root.innerHTML = html;
}

function render() {
  try {
    applyTheme();
    document.documentElement.lang = state.lang;
    if (state.appLocked) renderPinScreen(); else if (state.screen === "selector") renderSelector(); else renderApp();
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
