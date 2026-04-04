/**
 * Generates proper PNG icon assets for the AssetXAI mobile app.
 * Uses only Node.js built-ins (zlib) — no external dependencies.
 * Brand color: #4f46e5 (indigo)
 *
 * Run from the mobile/ directory: node scripts/generate-icons.js
 */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

// ─── PNG encoder ────────────────────────────────────────────────────────────

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput  = Buffer.concat([typeBytes, data]);
  return Buffer.concat([uint32BE(data.length), typeBytes, data, uint32BE(crc32(crcInput))]);
}

/**
 * Create a solid-color PNG image.
 * @param {number}  width
 * @param {number}  height
 * @param {number}  r  0-255
 * @param {number}  g  0-255
 * @param {number}  b  0-255
 * @param {boolean} rounded  Whether to punch out rounded corners (for adaptive icons)
 * @returns {Buffer}
 */
function createSolidPNG(width, height, r, g, b, rounded = false) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 2; // colour type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data (filter byte 0 + RGB per pixel)
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      let pr = r, pg = g, pb = b;
      if (rounded) {
        // Transparent corners for rounded look (we keep RGB — PNG here is RGB not RGBA)
        // Instead, use a white background in corners
        const cx = x - width / 2, cy = y - height / 2;
        const cr = width * 0.44; // corner radius ~44%
        const dx = Math.abs(cx) - (width / 2 - cr);
        const dy = Math.abs(cy) - (height / 2 - cr);
        if (dx > 0 && dy > 0 && Math.sqrt(dx * dx + dy * dy) > cr) {
          pr = 255; pg = 255; pb = 255; // white outside rounded corner
        }
      }
      row[1 + x * 3]     = pr;
      row[1 + x * 3 + 1] = pg;
      row[1 + x * 3 + 2] = pb;
    }
    rawRows.push(row);
  }

  const raw  = Buffer.concat(rawRows);
  const idat = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Draw an "X" letter onto the icon to make it recognisable as AssetXAI.
 * Simple approach: overlay dark pixels in an X pattern.
 */
function createLogoIcon(size, bgR, bgG, bgB) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;

  const rawRows = [];
  const cx = size / 2, cy = size / 2;
  const armW = size * 0.12;  // arm width of X
  const armL = size * 0.32;  // arm half-length

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;

      // Diagonal arms of the X (two lines at ±45°)
      const rot1 = Math.abs( dx + dy) / Math.SQRT2;
      const rot2 = Math.abs(-dx + dy) / Math.SQRT2;
      const dist1 = Math.abs( dx - dy) / Math.SQRT2; // perpendicular distance to first arm
      const dist2 = Math.abs( dx + dy) / Math.SQRT2; // same for second arm

      // On arm1 (top-left to bottom-right)?
      const onArm1 = Math.abs(dx - dy) / Math.SQRT2 < armW && Math.sqrt(dx*dx + dy*dy) < armL * 1.4;
      // On arm2 (top-right to bottom-left)?
      const onArm2 = Math.abs(dx + dy) / Math.SQRT2 < armW && Math.sqrt(dx*dx + dy*dy) < armL * 1.4;

      // Rounded outer edge (clip to circle)
      const r = Math.sqrt(dx*dx + dy*dy);
      const inCircle = r < size * 0.42;

      if (!inCircle) {
        row[1 + x*3] = 255; row[1 + x*3+1] = 255; row[1 + x*3+2] = 255;
      } else if (onArm1 || onArm2) {
        // White X on indigo background
        row[1 + x*3] = 255; row[1 + x*3+1] = 255; row[1 + x*3+2] = 255;
      } else {
        row[1 + x*3] = bgR; row[1 + x*3+1] = bgG; row[1 + x*3+2] = bgB;
      }
    }
    rawRows.push(row);
  }

  const raw  = Buffer.concat(rawRows);
  const idat = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Generate assets ────────────────────────────────────────────────────────

const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

// Brand colours: indigo #4f46e5  →  rgb(79, 70, 229)
const [IR, IG, IB] = [79, 70, 229];

console.log('Generating icon assets...');

// 1. icon.png  — 1024×1024  (iOS App Store + EAS)
fs.writeFileSync(path.join(assetsDir, 'icon.png'), createLogoIcon(1024, IR, IG, IB));
console.log('  ✓ icon.png  (1024×1024)');

// 2. adaptive-icon.png  — 1024×1024  foreground layer (Android)
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), createLogoIcon(1024, IR, IG, IB));
console.log('  ✓ adaptive-icon.png  (1024×1024)');

// 3. splash-icon.png  — 512×512  (splash screen)
fs.writeFileSync(path.join(assetsDir, 'splash-icon.png'), createLogoIcon(512, IR, IG, IB));
console.log('  ✓ splash-icon.png  (512×512)');

// 4. favicon.png  — 64×64  (web)
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), createLogoIcon(64, IR, IG, IB));
console.log('  ✓ favicon.png  (64×64)');

console.log('\nAll icon assets generated in mobile/assets/');
console.log('Each icon shows a white X on indigo (#4f46e5) background — matching the AssetXAI brand.');
