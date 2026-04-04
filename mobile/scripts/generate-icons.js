/**
 * AssetXAI icon generator
 * Creates proper PNG assets with a premium indigo gradient + white cube logo.
 * Run: node scripts/generate-icons.js
 */
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// ── Minimal PNG writer ─────────────────────────────────────────────────────
function buildPNG(width, height, pixels) {
  function adler32(buf) {
    let s1 = 1, s2 = 0;
    for (let i = 0; i < buf.length; i++) {
      s1 = (s1 + buf[i]) % 65521;
      s2 = (s2 + s1)    % 65521;
    }
    return (s2 << 16) | s1;
  }
  function crc32(buf) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    let crc = 0xffffffff;
    for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function u32(n) {
    return Buffer.from([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
  }
  function chunk(type, data) {
    const t = Buffer.from(type);
    const c = crc32(Buffer.concat([t, data]));
    return Buffer.concat([u32(data.length), t, data, u32(c)]);
  }

  // Build raw scanlines
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter type = None
    for (let x = 0; x < width; x++) {
      const idx = y * (width * 4 + 1) + 1 + x * 4;
      const px  = pixels[(y * width + x) * 4];
      raw[idx]   = pixels[(y * width + x) * 4 + 0];
      raw[idx+1] = pixels[(y * width + x) * 4 + 1];
      raw[idx+2] = pixels[(y * width + x) * 4 + 2];
      raw[idx+3] = pixels[(y * width + x) * 4 + 3];
    }
  }
  const compressed = zlib.deflateSync(raw);

  const ihdr = Buffer.concat([u32(width), u32(height),
    Buffer.from([8, 2, 0, 0, 0])  // 8-bit, RGB (we'll switch to RGBA)
  ]);
  // Actually use RGBA (bit depth 8, colour type 6)
  const ihdr2 = Buffer.concat([u32(width), u32(height),
    Buffer.from([8, 6, 0, 0, 0])
  ]);

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG magic
    chunk('IHDR', ihdr2),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Draw helpers ──────────────────────────────────────────────────────────
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function setPixel(pixels, width, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= width || y >= width) return;
  const i = (Math.round(y) * width + Math.round(x)) * 4;
  // Alpha blend over existing
  const alpha = a / 255;
  pixels[i]   = Math.round(pixels[i]   * (1 - alpha) + r * alpha);
  pixels[i+1] = Math.round(pixels[i+1] * (1 - alpha) + g * alpha);
  pixels[i+2] = Math.round(pixels[i+2] * (1 - alpha) + b * alpha);
  pixels[i+3] = Math.min(255, pixels[i+3] + a);
}

function drawFilledCircle(pixels, w, cx, cy, radius, r, g, b, a) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= radius) {
        const aa = dist > radius - 1 ? Math.round((radius - dist) * 255) : a;
        setPixel(pixels, w, x, y, r, g, b, Math.min(a, aa));
      }
    }
  }
}

function drawRect(pixels, w, x1, y1, x2, y2, r, g, b, a, thickness = 1) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      setPixel(pixels, w, x, y, r, g, b, a);
    }
  }
}

function drawRoundedRect(pixels, w, x1, y1, x2, y2, radius, r, g, b, a) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      // Distance from nearest corner
      const cx = x < x1 + radius ? x1 + radius : x > x2 - radius ? x2 - radius : x;
      const cy = y < y1 + radius ? y1 + radius : y > y2 - radius ? y2 - radius : y;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= radius) {
        setPixel(pixels, w, x, y, r, g, b, a);
      }
    }
  }
}

// ── Gradient background ───────────────────────────────────────────────────
// Top-left: #3730a3  (55, 48, 163)
// Bottom-right: #7c3aed (124, 58, 237)
function generateIcon(size) {
  const pixels = new Uint8Array(size * size * 4);

  // Fill with gradient
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (size * 2);
      const r = lerp(55,  124, t);
      const g = lerp(48,  58,  t);
      const b = lerp(163, 237, t);
      const i = (y * size + x) * 4;
      pixels[i]   = r;
      pixels[i+1] = g;
      pixels[i+2] = b;
      pixels[i+3] = 255;
    }
  }

  // Subtle circle decoration top-right
  const cr = size * 0.35;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - size) ** 2 + (y - 0) ** 2);
      if (dist < cr) {
        const i = (y * size + x) * 4;
        const alpha = 0.08 * (1 - dist / cr);
        pixels[i]   = Math.round(pixels[i]   + (255 - pixels[i])   * alpha);
        pixels[i+1] = Math.round(pixels[i+1] + (255 - pixels[i+1]) * alpha);
        pixels[i+2] = Math.round(pixels[i+2] + (255 - pixels[i+2]) * alpha);
      }
    }
  }

  const cx = size / 2;
  const cy = size / 2;

  // White rounded-rect card (cube face front)
  const cardSize  = size * 0.44;
  const cardR     = size * 0.1;
  const cardAlpha = 240;
  drawRoundedRect(pixels, size,
    Math.round(cx - cardSize / 2), Math.round(cy - cardSize / 2),
    Math.round(cx + cardSize / 2), Math.round(cy + cardSize / 2),
    cardR, 255, 255, 255, cardAlpha
  );

  // Inner purple square (cube depth)
  const innerSize  = cardSize * 0.55;
  const innerAlpha = 180;
  const innerColor = { r: 79, g: 70, b: 229 }; // #4f46e5
  drawRoundedRect(pixels, size,
    Math.round(cx - innerSize / 2), Math.round(cy - innerSize / 2 + cardSize * 0.04),
    Math.round(cx + innerSize / 2), Math.round(cy + innerSize / 2 + cardSize * 0.04),
    cardR * 0.6, innerColor.r, innerColor.g, innerColor.b, innerAlpha
  );

  // Top face (parallelogram) — simplified as rectangle offset
  const topOff = cardSize * 0.15;
  drawRoundedRect(pixels, size,
    Math.round(cx - innerSize / 2 + topOff * 0.4), Math.round(cy - innerSize / 2 - topOff + cardSize * 0.04),
    Math.round(cx + innerSize / 2 + topOff * 0.4), Math.round(cy - innerSize / 2 + cardSize * 0.04),
    3, 130, 120, 240, 160
  );

  return buildPNG(size, size, pixels);
}

// ── Write files ───────────────────────────────────────────────────────────
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

const FILES = [
  { name: 'icon.png',          size: 1024 },
  { name: 'adaptive-icon.png', size: 1024 },
  { name: 'splash-icon.png',   size: 512  },
  { name: 'favicon.png',       size: 64   },
];

FILES.forEach(({ name, size }) => {
  const png = generateIcon(size);
  const out = path.join(ASSETS_DIR, name);
  fs.writeFileSync(out, png);
  console.log(`✓ ${name} (${size}x${size}) → ${(png.length / 1024).toFixed(1)} KB`);
});

console.log('\n✅ All icons generated in mobile/assets/');
