"use strict";

(function () {
  const KEY = "cc_local_bank_import_v1";

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === ',' && !quoted) { row.push(cell.trim()); cell = ""; }
      else if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell.trim()); cell = "";
        if (row.some(Boolean)) rows.push(row);
        row = [];
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
    return rows;
  }

  function amount(value) {
    const cleaned = String(value || "").replace(/[$,()]/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function category(description) {
    const d = description.toLowerCase();
    if (/payroll|direct dep|amazon.*pay|salary|deposit/.test(d)) return "Ingreso";
    if (/publix|walmart|aldi|sedano|grocery|market/.test(d)) return "Comida";
    if (/shell|chevron|exxon|mobil|wawa|gas/.test(d)) return "Gasolina";
    if (/netflix|spotify|hulu|disney|apple.com\/bill|google/.test(d)) return "Suscripción";
    if (/geico|progressive|insurance/.test(d)) return "Seguro";
    if (/rent|apartment|mortgage/.test(d)) return "Vivienda";
    if (/restaurant|mcdonald|burger|pizza|doordash|uber eats/.test(d)) return "Restaurante";
    if (/amazon|ebay|temu|target/.test(d)) return "Compras";
    return "Otros";
  }

  function normalize(rows) {
    if (rows.length < 2) throw new Error("El archivo no contiene movimientos suficientes.");
    const header = rows[0].map(x => x.toLowerCase());
    const find = (...names) => header.findIndex(h => names.some(n => h.includes(n)));
    const dateI = find("date", "fecha");
    const descI = find("description", "descripción", "payee", "details");
    const amountI = find("amount", "importe", "monto");
    const debitI = find("debit", "retiro");
    const creditI = find("credit", "depósito", "deposit");
    if (dateI < 0 || descI < 0 || (amountI < 0 && debitI < 0 && creditI < 0)) {
      throw new Error("No reconozco las columnas. Descarga el archivo CSV de Bank of America.");
    }
    return rows.slice(1).map((r, idx) => {
      let value = amountI >= 0 ? amount(r[amountI]) : amount(r[creditI]) - amount(r[debitI]);
      const description = String(r[descI] || "Movimiento").trim();
      const date = String(r[dateI] || "").trim();
      return { id: `${date}|${description}|${value}|${idx}`, date, description, amount: value, category: category(description) };
    }).filter(x => x.date && x.description);
  }

  function analyze(items) {
    const income = items.filter(x => x.amount > 0).reduce((s, x) => s + x.amount, 0);
    const expenses = Math.abs(items.filter(x => x.amount < 0).reduce((s, x) => s + x.amount, 0));
    const subscriptions = items.filter(x => x.category === "Suscripción" && x.amount < 0);
    const available = income - expenses;
    const advice = [];
    if (income <= 0) advice.push("No detecté ingresos en este archivo; importa un período que incluya tu depósito de salario.");
    else if (available < 0) advice.push(`Gastaste $${Math.abs(available).toFixed(2)} más de lo que entró. Reduce primero compras y restaurantes.`);
    else {
      const emergency = Math.min(available * 0.5, income * 0.15);
      advice.push(`Aparta $${emergency.toFixed(2)} para tu fondo de emergencia.`);
      advice.push(`Te quedan aproximadamente $${available.toFixed(2)} después de los gastos importados.`);
    }
    if (subscriptions.length) advice.push(`Revisa ${subscriptions.length} posible(s) suscripción(es) antes de la próxima renovación.`);
    return { income, expenses, available, subscriptions: subscriptions.length, advice };
  }

  function save(items) {
    const previous = JSON.parse(localStorage.getItem(KEY) || "{\"transactions\":[]}");
    const map = new Map((previous.transactions || []).map(x => [x.id, x]));
    items.forEach(x => map.set(x.id, x));
    const transactions = [...map.values()];
    const data = { transactions, analysis: analyze(transactions), updatedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(data));
    return data;
  }

  function openPanel() {
    document.getElementById("cc-bank-panel")?.remove();
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    const panel = document.createElement("div");
    panel.id = "cc-bank-panel";
    panel.innerHTML = `<div class="cc-bank-card"><button class="cc-bank-close">×</button><h2>Actualizar movimientos</h2><p>Descarga en Bank of America el archivo CSV de movimientos y selecciónalo aquí. Todo se procesa solo en este teléfono.</p><input id="cc-bank-file" type="file" accept=".csv,text/csv" hidden><button id="cc-bank-import">Elegir CSV</button><div id="cc-bank-result"></div></div>`;
    document.body.appendChild(panel);
    panel.querySelector(".cc-bank-close").onclick = () => panel.remove();
    panel.querySelector("#cc-bank-import").onclick = () => panel.querySelector("#cc-bank-file").click();
    const result = panel.querySelector("#cc-bank-result");
    function render(data) {
      if (!data) return;
      result.innerHTML = `<hr><b>Última actualización:</b> ${new Date(data.updatedAt).toLocaleString()}<br><b>Ingresos:</b> $${data.analysis.income.toFixed(2)}<br><b>Gastos:</b> $${data.analysis.expenses.toFixed(2)}<br><b>Disponible:</b> $${data.analysis.available.toFixed(2)}<h3>Qué hacer ahora</h3>${data.analysis.advice.map(x => `<p>• ${x}</p>`).join("")}`;
    }
    render(saved);
    panel.querySelector("#cc-bank-file").onchange = async (event) => {
      try {
        result.textContent = "Analizando…";
        const file = event.target.files[0];
        const data = save(normalize(parseCsv(await file.text())));
        render(data);
        window.dispatchEvent(new CustomEvent("cc:bank-imported", { detail: data }));
      } catch (e) { result.textContent = e.message || "No se pudo importar el archivo."; }
    };
  }

  function install() {
    const style = document.createElement("style");
    style.textContent = `#cc-bank-button{position:fixed;right:18px;bottom:88px;z-index:9998;border:0;border-radius:999px;padding:14px 18px;background:#007aff;color:white;font-weight:700;box-shadow:0 6px 22px #0003}#cc-bank-panel{position:fixed;inset:0;z-index:9999;background:#0008;display:grid;place-items:end center;padding:16px}.cc-bank-card{position:relative;width:min(560px,100%);max-height:85vh;overflow:auto;background:white;color:#111;border-radius:22px;padding:22px}.cc-bank-card button{border:0;border-radius:12px;padding:12px 16px;background:#007aff;color:white;font-weight:700}.cc-bank-close{position:absolute;right:14px;top:12px;background:#eee!important;color:#111!important;font-size:22px}`;
    document.head.appendChild(style);
    const button = document.createElement("button");
    button.id = "cc-bank-button";
    button.textContent = "Actualizar banco";
    button.onclick = openPanel;
    document.body.appendChild(button);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
})();
