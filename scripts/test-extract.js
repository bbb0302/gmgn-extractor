const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const { extractRows } = require("../gmgn-extractor/extract.js");

const htmlPath = path.join(__dirname, "..", "1.html");
const html = fs.readFileSync(htmlPath, "utf8");
const dom = new JSDOM(html);
const rows = extractRows(dom.window.document);

const statuses = [
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "dump",
  "dump",
  "dump",
  "",
  "eat",
];

if (rows.length !== statuses.length) {
  throw new Error(`expected ${statuses.length} rows, got ${rows.length}`);
}

statuses.forEach((status, index) => {
  if (rows[index].status !== status) {
    throw new Error(
      `row ${index} ${rows[index].token} status: expected ${JSON.stringify(status)}, got ${JSON.stringify(rows[index].status)}`
    );
  }
  const wallet = rows[index].tokenAge === -1 ? "dev" : "";
  if (rows[index].wallet !== wallet) {
    throw new Error(
      `row ${index} ${rows[index].token} wallet: expected ${JSON.stringify(wallet)}, got ${JSON.stringify(rows[index].wallet)}`
    );
  }
});

const required = [
  "token",
  "address",
  "tokenAge",
  "holdingDuration",
  "firstBuyMc",
  "firstBuyAmount",
  "athMcHolding",
  "athHoldingAge",
  "athMcRange",
  "athRangeAge",
];

const numericKeys = [
  "migrationAge",
  "tokenAge",
  "holdingDuration",
  "firstBuyMc",
  "firstBuyAmount",
  "athMcHolding",
  "athHoldingAge",
  "athMcRange",
  "athRangeAge",
];
rows.forEach((row, index) => {
  for (const key of numericKeys) {
    if (typeof row[key] !== "number" || Number.isNaN(row[key])) {
      throw new Error(`row ${index} ${key} is not a number: ${JSON.stringify(row[key])}`);
    }
  }
});

const knownPlatforms = new Set([
  "pumpfun",
  "pumpamm",
  "dynamic bc",
  "meteora",
  "stonk",
  "launchlab",
  "raydium",
  "mayhem",
  "moonit",
  "heaven",
]);
rows.forEach((row, index) => {
  if (!knownPlatforms.has(row.platform)) {
    throw new Error(`row ${index} ${row.token} platform: ${JSON.stringify(row.platform)}`);
  }
});

const badgeHtml = [
  ["ray_launchpad_16px.png", "LaunchLab Icon", "launchlab"],
  ["raydium_16px.png", "Raydium Icon", "raydium"],
  ["moonshot_16px.png", "Moonshot Icon", "moonit"],
  ["heaven_16px.png", "Heaven Icon", "heaven"],
  ["stonk_16px.png", "Stonk Icon", "stonk"],
  ["mayhem_16px.png", "Mayhem Icon", "mayhem"],
  ["meteora_16px--sol-meteora_virtual_curve.png", "Dynamic BC Icon", "dynamic bc"],
].map(
  ([src, alt, name]) =>
    `<tr class="g-table-row"><td class="g-table-cell"><img src="/static/lpp/${src}" alt="${alt}"></td></tr>`
);
const badges = extractRows(
  new JSDOM(
    `<table><tbody class="g-table-tbody">${badgeHtml.join("")}<tr class="g-table-row"><td class="g-table-cell"></td></tr></tbody></table>`
  ).window.document
);
["launchlab", "raydium", "moonit", "heaven", "stonk", "mayhem", "dynamic bc", "raydium"].forEach((name, index) => {
  if (badges[index].platform !== name) {
    throw new Error(`badge ${name}: got ${JSON.stringify(badges[index].platform)}`);
  }
});

const statusRows = extractRows(
  new JSDOM(`<table><tbody class="g-table-tbody">
    <tr class="g-table-row"><td class="g-table-cell"><span class="gmgn-row-status-dump"></span></td></tr>
    <tr class="g-table-row"><td class="g-table-cell"><span class="gmgn-row-status-eat"></span></td></tr>
    <tr class="g-table-row"><td class="g-table-cell"><span class="gmgn-row-status-dump"></span><span class="gmgn-row-status-eat"></span></td></tr>
    <tr class="g-table-row"><td class="g-table-cell"></td></tr>
    <tr class="g-table-row"><td class="g-table-cell"><div class="token-age-display">14s</div></td></tr>
  </tbody></table>`).window.document
);
["dump", "eat", "dump,eat", ""].forEach((status, index) => {
  if (statusRows[index].status !== status) {
    throw new Error(`status fixture ${index}: got ${JSON.stringify(statusRows[index].status)}`);
  }
  if (statusRows[index].wallet !== "dev" || statusRows[index].tokenAge !== -1) {
    throw new Error(`status fixture ${index} should be a dev wallet: ${JSON.stringify(statusRows[index])}`);
  }
});
if (statusRows[4].wallet !== "" || statusRows[4].tokenAge !== 14) {
  throw new Error(`aged wallet fixture: ${JSON.stringify(statusRows[4])}`);
}

rows.forEach((row, index) => {
  for (const key of required) {
    if (row[key] === "" || row[key] == null) {
      throw new Error(`row ${index} missing ${key}: ${JSON.stringify(row)}`);
    }
  }
});

console.log(`extracted ${rows.length} rows`);
for (const row of rows) {
  console.log(
    [
      row.token,
      row.status,
      row.wallet,
      row.platform,
      row.migrationAge,
      row.tokenAge,
      row.holdingDuration,
      row.firstBuyMc,
      row.firstBuyAmount,
      `${row.athMcHolding} (${row.athHoldingAge})`,
      `${row.athMcRange} (${row.athRangeAge})`,
    ].join(" | ")
  );
}
