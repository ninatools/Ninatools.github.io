/* Shared NinaTools / RetireAtlas currency converter.
   Uses Frankfurter's public reference-rate API; no API key required.
   Rates are reference rates, not guaranteed transaction quotes. */
(() => {
  const CURRENCIES = [
    ["EUR", "Euro", "€"], ["USD", "US Dollar", "$"], ["GBP", "British Pound", "£"],
    ["THB", "Thai Baht", "฿"], ["MXN", "Mexican Peso", "$"], ["MYR", "Malaysian Ringgit", "RM"],
    ["CAD", "Canadian Dollar", "$"], ["AUD", "Australian Dollar", "$"], ["CHF", "Swiss Franc", "CHF"],
    ["JPY", "Japanese Yen", "¥"], ["SGD", "Singapore Dollar", "$"], ["NZD", "New Zealand Dollar", "$"],
    ["INR", "Indian Rupee", "₹"], ["PLN", "Polish Złoty", "zł"], ["SEK", "Swedish Krona", "kr"],
    ["NOK", "Norwegian Krone", "kr"], ["DKK", "Danish Krone", "kr"], ["CZK", "Czech Koruna", "Kč"],
    ["HUF", "Hungarian Forint", "Ft"], ["RON", "Romanian Leu", "lei"], ["TRY", "Turkish Lira", "₺"],
    ["BRL", "Brazilian Real", "R$"], ["ZAR", "South African Rand", "R"], ["KRW", "South Korean Won", "₩"],
    ["CNY", "Chinese Yuan", "¥"], ["HKD", "Hong Kong Dollar", "$"], ["IDR", "Indonesian Rupiah", "Rp"],
    ["PHP", "Philippine Peso", "₱"], ["ILS", "Israeli New Shekel", "₪"], ["ISK", "Icelandic Króna", "kr"]
  ];
  const API = "https://api.frankfurter.dev/v2";
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function init(root) {
    if (root.dataset.currencyReady === "true") return;
    root.dataset.currencyReady = "true";
    const defaultFrom = root.dataset.from || "EUR";
    const defaultTo = root.dataset.to || "USD";
    root.innerHTML = `
      <form class="nt-currency-form">
        <label>Amount<input class="nt-amount" type="number" min="0" step="any" value="100" inputmode="decimal" required></label>
        <label>From<select class="nt-from"></select></label>
        <button class="nt-swap" type="button" aria-label="Swap currencies" title="Swap currencies">⇄</button>
        <label>To<select class="nt-to"></select></label>
        <button class="nt-convert" type="submit">Convert</button>
      </form>
      <div class="nt-currency-result" aria-live="polite">Enter an amount to convert.</div>
      <p class="nt-currency-note">Reference exchange rates, not transaction or cash-exchange quotes.</p>`;
    const style = document.createElement("style");
    style.textContent = `
      [data-currency-converter]{color:var(--currency-ink,#1f2937);font-family:inherit}
      [data-currency-converter] .nt-currency-form{display:grid;grid-template-columns:minmax(130px,1fr) minmax(130px,1fr) auto minmax(130px,1fr) auto;gap:12px;align-items:end}
      [data-currency-converter] label{display:grid;gap:6px;font-size:14px;font-weight:650}
      [data-currency-converter] input,[data-currency-converter] select{width:100%;min-width:0;padding:12px;border:1px solid #d7dce5;border-radius:10px;background:#fff;color:#172033;font:inherit}
      [data-currency-converter] button{border:0;border-radius:10px;padding:12px 16px;background:var(--currency-accent,#6d5ce7);color:#fff;font:inherit;font-weight:700;cursor:pointer;min-height:46px}
      [data-currency-converter] .nt-swap{padding:10px 13px;background:#eeeaff;color:#5146c7;font-size:20px}
      [data-currency-converter] .nt-currency-result{margin-top:18px;padding:18px;border-radius:12px;background:var(--currency-result-bg,#f7f6ff);font-size:16px;line-height:1.6;overflow-wrap:anywhere}
      [data-currency-converter] .nt-currency-result strong{display:block;font-size:clamp(24px,4vw,34px);line-height:1.25;margin:4px 0}
      [data-currency-converter] .nt-currency-note{font-size:12px;line-height:1.5;color:#687386;margin:10px 0 0}
      @media(max-width:680px){[data-currency-converter] .nt-currency-form{grid-template-columns:1fr 1fr}[data-currency-converter] .nt-currency-form label:first-child{grid-column:1/-1}[data-currency-converter] .nt-swap{justify-self:center;width:100%}[data-currency-converter] .nt-convert{grid-column:1/-1}}
    `;
    root.appendChild(style);
    const from = root.querySelector(".nt-from"), to = root.querySelector(".nt-to");
    const options = CURRENCIES.map(([code,name,symbol]) => `<option value="${code}">${code} — ${escapeHtml(name)} (${escapeHtml(symbol)})</option>`).join("");
    from.innerHTML = options; to.innerHTML = options;
    from.value = CURRENCIES.some(c => c[0] === defaultFrom) ? defaultFrom : "EUR";
    to.value = CURRENCIES.some(c => c[0] === defaultTo) ? defaultTo : "USD";
    const amount = root.querySelector(".nt-amount");
    const result = root.querySelector(".nt-currency-result");
    const form = root.querySelector(".nt-currency-form");
    const money = (value, code) => new Intl.NumberFormat(undefined,{style:"currency",currency:code,maximumFractionDigits: code==="JPY"||code==="KRW"?0:2}).format(value);
    let requestId = 0;
    let inputTimer;
    async function convert() {
      const currentRequest = ++requestId;
      if (amount.value.trim() === "") { result.textContent = "Enter an amount to convert."; return; }
      const value = Number(amount.value), base = from.value, quote = to.value;
      if (!Number.isFinite(value) || value < 0) { result.textContent = "Please enter a valid non-negative amount."; return; }
      result.textContent = "Loading latest available reference rate…";
      try {
        let rate = 1, date = new Date().toISOString().slice(0,10);
        if (base !== quote) {
          const response = await fetch(`${API}/rate/${encodeURIComponent(base.toLowerCase())}/${encodeURIComponent(quote.toLowerCase())}`, {cache:"no-store"});
          if (!response.ok) throw new Error("Rate unavailable");
          const data = await response.json();
          rate = Number(data.rate); date = data.date || date;
          if (!Number.isFinite(rate) || rate <= 0) throw new Error("Invalid rate");
        }
        if (currentRequest !== requestId) return;
        result.replaceChildren();
        const summary = document.createElement("div");
        summary.textContent = `${money(value,base)} =`;
        const total = document.createElement("strong");
        total.textContent = money(value * rate, quote);
        const details = document.createElement("div");
        details.textContent = `1 ${base} = ${new Intl.NumberFormat(undefined,{maximumFractionDigits:6}).format(rate)} ${quote}`;
        const stamp = document.createElement("div");
        stamp.textContent = `Rate date: ${date}`;
        result.append(summary,total,details,stamp);
      } catch (e) {
        if (currentRequest !== requestId) return;
        result.textContent = "Sorry, the exchange rate could not be loaded. Please check your connection and try again.";
      }
    }
    form.addEventListener("submit", e => { e.preventDefault(); clearTimeout(inputTimer); convert(); });
    from.addEventListener("change", convert); to.addEventListener("change", convert);
    root.querySelector(".nt-swap").addEventListener("click", () => { const old = from.value; from.value = to.value; to.value = old; convert(); });
    amount.addEventListener("input", () => {
      clearTimeout(inputTimer);
      inputTimer = setTimeout(convert, 350);
    });
    amount.addEventListener("change", () => { clearTimeout(inputTimer); convert(); });
    convert();
  }
  function start() { document.querySelectorAll("[data-currency-converter]").forEach(init); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();