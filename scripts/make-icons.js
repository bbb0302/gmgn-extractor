const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function paint(x, y, size) {
  const pad = Math.max(1, Math.round(size * 0.14));
  if (x < pad || y < pad || x >= size - pad || y >= size - pad) return [0, 0, 0, 0];

  const radius = Math.round(size * 0.16);
  const left = pad;
  const top = pad;
  const right = size - pad - 1;
  const bottom = size - pad - 1;
  const dx = x < left + radius ? left + radius - x : x > right - radius ? x - (right - radius) : 0;
  const dy = y < top + radius ? top + radius - y : y > bottom - radius ? y - (bottom - radius) : 0;
  if (dx * dx + dy * dy > radius * radius) return [0, 0, 0, 0];

  const bg = [16, 20, 18, 255];
  const rowH = Math.max(2, Math.round(size * 0.08));
  const gap = Math.max(2, Math.round(size * 0.07));
  const innerX = pad + Math.round(size * 0.12);
  const innerRight = size - pad - Math.round(size * 0.12);
  let y0 = pad + Math.round(size * 0.2);
  for (let i = 0; i < 4; i++) {
    if (y >= y0 && y < y0 + rowH && x >= innerX && x < innerRight) {
      return i === 0 ? [126, 217, 168, 255] : [70, 84, 76, 255];
    }
    y0 += rowH + gap;
  }
  return bg;
}

function makePng(size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = paint(x, y, size);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, "..", "gmgn-extractor", "icons");
fs.mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), makePng(size));
}
console.log("icons written");
