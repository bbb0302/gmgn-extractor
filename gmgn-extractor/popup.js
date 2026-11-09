const statusEl = document.querySelector("#status");
const tableWrap = document.querySelector("#table-wrap");
const refreshBtn = document.querySelector("#refresh");
const copyBtn = document.querySelector("#copy");
const csvBtn = document.querySelector("#csv");

const COLUMNS = [
  ["token", "Token"],
  ["platform", "Platform"],
  ["status", "Status"],
  ["wallet", "Wallet"],
  ["migrationAge", "Migration (s)"],
  ["tokenAge", "Age (s)"],
  ["holdingDuration", "Holding (s)"],
  ["firstBuyMc", "First buy MC"],
  ["firstBuyAmount", "First buy amt"],
  ["athMcHolding", "ATH MC holding"],
  ["athHoldingAge", "ATH age holding (s)"],
  ["athMcRange", "ATH MC range"],
  ["athRangeAge", "ATH age range (s)"],
];

let rows = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function render(message, failed) {
  statusEl.textContent = message;
  const hasRows = rows.length > 0;
  copyBtn.disabled = !hasRows;
  csvBtn.disabled = !hasRows;

  if (!hasRows) {
    tableWrap.innerHTML = failed
      ? ""
      : `<div class="empty">No table rows found. Open a GMGN page with a .g-table-tbody, then extract again. Only rows currently rendered in the page are included.</div>`;
    return;
  }

  const head = COLUMNS.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = COLUMNS.map(([key]) => {
        const value = escapeHtml(row[key]);
        if (key === "token") {
          const title = escapeHtml(`${row.chain || ""} ${row.address || ""}`.trim());
          return `<td class="token" title="${title}">${value}<span class="sub">${escapeHtml(row.chain || "")}</span></td>`;
        }
        return `<td>${value}</td>`;
      }).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  tableWrap.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

async function extractFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab.");
  const url = tab.url || "";
  if (
    !url ||
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:")
  ) {
    throw new Error("Open a GMGN table page first.");
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["extract.js"],
  });

  const [injected] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.__gmgnExtractRows(document),
  });

  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    host = "";
  }

  return { rows: injected?.result || [], host };
}

async function runExtract() {
  refreshBtn.disabled = true;
  statusEl.textContent = "Reading the open table…";
  try {
    const result = await extractFromActiveTab();
    rows = result.rows;
    const where = result.host ? ` from ${result.host}` : "";
    render(`${rows.length} row${rows.length === 1 ? "" : "s"}${where}`);
  } catch (error) {
    rows = [];
    render(error?.message || "Could not read this page.", true);
  } finally {
    refreshBtn.disabled = false;
  }
}

function download(filename, contents, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
  copyBtn.textContent = "Copied";
  setTimeout(() => {
    copyBtn.textContent = "Copy JSON";
  }, 1200);
});

csvBtn.addEventListener("click", () => {
  const header = ["chain", "address", ...COLUMNS.map(([key]) => key)];
  const labels = ["chain", "address", ...COLUMNS.map(([, label]) => label)];
  const lines = [
    labels.map(csvCell).join(","),
    ...rows.map((row) => header.map((key) => csvCell(row[key])).join(",")),
  ];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  download(`gmgn-rows-${stamp}.csv`, `\uFEFF${lines.join("\r\n")}`, "text/csv;charset=utf-8");
});

refreshBtn.addEventListener("click", runExtract);
runExtract();
