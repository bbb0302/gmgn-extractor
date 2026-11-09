(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.__gmgnExtractRows = api.extractRows;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function clean(value) {
    return String(value || "")
      .replace(/[\u200B-\u200D\uFEFF\u2060]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function durationSeconds(text) {
    const raw = clean(text);
    if (!raw || raw === "--" || raw === "-" || raw === "—") return -1;
    const units = { w: 604800, d: 86400, h: 3600, m: 60, s: 1 };
    let total = 0;
    let matched = false;
    for (const part of raw.matchAll(/(\d+(?:\.\d+)?)\s*([wdhms])/gi)) {
      matched = true;
      total += Number(part[1]) * units[part[2].toLowerCase()];
    }
    return matched ? Math.round(total) : -1;
  }

  function decimalNumber(text) {
    const raw = clean(text).replace(/[$,]/g, "");
    if (!raw || raw === "--" || raw === "-" || raw === "—") return -1;
    const match = raw.match(/^(-?\d+(?:\.\d+)?)\s*([kmbt])?$/i);
    if (!match) return -1;
    const scale = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[match[2] ? match[2].toLowerCase() : ""] || 1;
    return Number(match[1]) * scale;
  }

  function marketCapNumber(text) {
    const raw = clean(text).replace(/[$,]/g, "");
    if (!raw || raw === "--" || raw === "-" || raw === "—") return -1;
    const match = raw.match(/^(-?\d+(?:\.\d+)?)\s*([kmbt])?$/i);
    if (!match) return -1;
    const scale = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[match[2] ? match[2].toLowerCase() : ""] || 1;
    return Math.round(Number(match[1]) * scale);
  }

  function divs(el) {
    if (!el) return [];
    return [...el.children].filter((node) => node.tagName === "DIV");
  }

  function cellsOf(row) {
    return [...row.querySelectorAll(":scope > .g-table-cell")];
  }

  function splitValueTime(text) {
    const match = text.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (!match) return { value: text, time: "" };
    return { value: match[1].trim(), time: match[2].trim() };
  }

  const PLATFORM_RULES = [
    [/pump[\s._-]?swap|pump[\s._-]?amm|pumpswap|pumpamm/i, "pumpamm"],
    [/pump\.?fun|pumplab|\bpump\b/i, "pumpfun"],
    [/virtual[_\s.-]?curve|dynamic[\s._-]?bc|\bdbc\b/i, "dynamic bc"],
    [/\bdamm\b|meteora/i, "meteora"],
    [/launchlab|ray[_\s.-]?launchpad|letsbonk/i, "launchlab"],
    [/raydium/i, "raydium"],
    [/moonit|moonshot/i, "moonit"],
    [/heaven/i, "heaven"],
    [/stonk/i, "stonk"],
    [/mayhem/i, "mayhem"],
  ];

  function normalizePlatform(raw) {
    const text = clean(raw).toLowerCase();
    if (!text) return "";
    for (const [pattern, name] of PLATFORM_RULES) {
      if (pattern.test(text)) return name;
    }
    return "";
  }

  function platformFromImage(img) {
    if (!img) return "";
    return (
      normalizePlatform(img.getAttribute("title")) ||
      normalizePlatform(img.getAttribute("alt")) ||
      normalizePlatform(img.getAttribute("src"))
    );
  }

function platformOf(row) {
  const migrationImg = divs(row.querySelector(".token-info-container"))[0]?.querySelector("img");
  const badge = row.querySelector('img[src*="/static/lpp/"]');
  return platformFromImage(migrationImg) || platformFromImage(badge) || "raydium";
}

function rowStatus(row) {
  const status = [];
  if (row.querySelector(".gmgn-row-status-dump")) status.push("dump");
  if (row.querySelector(".gmgn-row-status-eat")) status.push("eat");
  return status.join(",");
}

  function infoBox(cell, marker) {
    if (!cell) return null;
    return (
      cell.querySelector(`:scope > .ath-info-container.${marker}`) ||
      cell.querySelector(`.ath-info-container.${marker}`) ||
      cell.querySelector(":scope > .ath-info-container") ||
      cell.querySelector(".ath-info-container")
    );
  }

  function tokenIdentity(row) {
    const link = row.querySelector("a[href*='/token/']");
    const href = link ? link.getAttribute("href") || "" : "";
    const address = (href.match(/\/token\/([^/?#]+)/) || [])[1] || "";
    const chain = (href.match(/\/([A-Za-z0-9]+)\/token\//) || [])[1] || "";
    const nameEl = row.querySelector("div.whitespace-nowrap.cursor-pointer");
    const token = clean(
      (nameEl && (nameEl.getAttribute("title") || nameEl.textContent)) || ""
    );
    return {
      token,
      chain,
      address: address ? decodeURIComponent(address) : "",
    };
  }

  function extractRow(row) {
    const info = row.querySelector(".token-info-container");
    const migrationAge = clean(divs(divs(info)[0])[0]?.textContent);
    const tokenAgeText = clean(row.querySelector(".token-age-display")?.textContent);
    const tokenAge = durationSeconds(tokenAgeText);

    const cells = cellsOf(row);
    const holdingDuration = clean(divs(divs(cells[6])[0])[0]?.textContent);

    const buyDivs = divs(infoBox(cells[7], "gmgn-enrich-fb"));
    const hold = splitValueTime(
      clean(infoBox(cells[8], "gmgn-enrich-ath")?.querySelector(".gmgn-ath-hold")?.textContent)
    );
    const range = splitValueTime(
      clean(infoBox(cells[8], "gmgn-enrich-ath")?.querySelector(".gmgn-ath-rise")?.textContent)
    );

    return {
      ...tokenIdentity(row),
      platform: platformOf(row),
      status: rowStatus(row),
      wallet: tokenAge === -1 ? "dev" : "",
      migrationAge: durationSeconds(migrationAge),
      tokenAge,
      holdingDuration: durationSeconds(holdingDuration),
      firstBuyMc: marketCapNumber(buyDivs[0]?.textContent),
      firstBuyAmount: decimalNumber(buyDivs[1]?.textContent),
      athMcHolding: marketCapNumber(hold.value),
      athHoldingAge: durationSeconds(hold.time),
      athMcRange: marketCapNumber(range.value),
      athRangeAge: durationSeconds(range.time),
    };
  }

  function extractRows(root) {
    const scope = root && typeof root.querySelectorAll === "function" ? root : root?.document;
    if (!scope) return [];
    return [...scope.querySelectorAll(".g-table-tbody .g-table-row")].map(extractRow);
  }

  return { extractRows };
});
