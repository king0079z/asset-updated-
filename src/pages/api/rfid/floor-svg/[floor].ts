// @ts-nocheck
/**
 * GET /api/rfid/floor-svg/[floor]
 *
 * Generates a clean dark architectural floor plan SVG.
 * This is a BACKGROUND blueprint — it shows room structure only.
 * All data visualization (zone fills, asset dots, labels) is handled
 * by the LiveTrackingMap overlay component on top of this image.
 *
 * Coordinates: 0–100 percentage scale on 1000×700 SVG canvas.
 * These MUST match the mapX/mapY/mapW/mapH values in seed-demo.ts
 * so the overlay aligns perfectly.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

// ── Zone definitions (must match seed-demo.ts) ────────────────────────────────
interface Zone {
  name: string; code: string; ap: string; restricted: boolean;
  x: number; y: number; w: number; h: number;
}

const FLOORS: Record<string, {
  label: string; sub: string; floorCode: string;
  accent: string; accentDark: string;
  zones: Zone[];
}> = {
  '1': {
    label: 'Floor 1 — Emergency & Diagnostic Center',
    sub: 'Apex Medical Center · AMC Main Building · Huawei AirEngine BLE 5.0',
    floorCode: 'FL-01',
    accent: '#3b82f6', accentDark: '#1d4ed8',
    zones: [
      { name: 'Pharmacy Store',      code: 'PH-01', ap: 'AC:CE:8D:F1:01', restricted: true,  x: 1,  y: 8,  w: 15, h: 40 },
      { name: 'Emergency Reception', code: 'ER-01', ap: 'AC:CE:8D:F1:02', restricted: false, x: 17, y: 8,  w: 43, h: 40 },
      { name: 'Trauma Bay A',        code: 'TR-01', ap: 'AC:CE:8D:F1:03', restricted: true,  x: 62, y: 8,  w: 36, h: 40 },
      { name: 'Radiology Suite',     code: 'RD-01', ap: 'AC:CE:8D:F1:04', restricted: false, x: 1,  y: 52, w: 59, h: 43 },
      { name: 'Trauma Bay B',        code: 'TR-02', ap: 'AC:CE:8D:F1:05', restricted: true,  x: 62, y: 52, w: 36, h: 43 },
    ],
  },
  '2': {
    label: 'Floor 2 — ICU & Critical Care',
    sub: 'Apex Medical Center · AMC Main Building · Huawei AirEngine BLE 5.0',
    floorCode: 'FL-02',
    accent: '#8b5cf6', accentDark: '#6d28d9',
    zones: [
      { name: 'ICU Unit A',       code: 'IC-01', ap: 'AC:CE:8D:F2:01', restricted: false, x: 1,  y: 8,  w: 31, h: 40 },
      { name: 'ICU Unit B',       code: 'IC-02', ap: 'AC:CE:8D:F2:02', restricted: false, x: 34, y: 8,  w: 31, h: 40 },
      { name: 'Recovery Suite',   code: 'RC-01', ap: 'AC:CE:8D:F2:03', restricted: false, x: 67, y: 8,  w: 31, h: 40 },
      { name: 'Operating Room 1', code: 'OR-01', ap: 'AC:CE:8D:F2:04', restricted: true,  x: 1,  y: 52, w: 47, h: 43 },
      { name: 'Operating Room 2', code: 'OR-02', ap: 'AC:CE:8D:F2:05', restricted: true,  x: 50, y: 52, w: 48, h: 43 },
    ],
  },
  '3': {
    label: 'Floor 3 — Patient Wards & Administration',
    sub: 'Apex Medical Center · AMC Main Building · Huawei AirEngine BLE 5.0',
    floorCode: 'FL-03',
    accent: '#14b8a6', accentDark: '#0f766e',
    zones: [
      { name: 'Ward A — General',    code: 'WD-01', ap: 'AC:CE:8D:F3:01', restricted: false, x: 1,  y: 8,  w: 31, h: 40 },
      { name: 'Ward B — Private',    code: 'WD-02', ap: 'AC:CE:8D:F3:02', restricted: false, x: 34, y: 8,  w: 31, h: 40 },
      { name: 'Nursing Station',     code: 'NS-01', ap: 'AC:CE:8D:F3:03', restricted: false, x: 67, y: 8,  w: 31, h: 40 },
      { name: 'Medical Supplies',    code: 'MS-01', ap: 'AC:CE:8D:F3:04', restricted: true,  x: 1,  y: 52, w: 50, h: 43 },
      { name: 'Administration',      code: 'AD-01', ap: 'AC:CE:8D:F3:05', restricted: false, x: 53, y: 52, w: 45, h: 43 },
    ],
  },
};

function p(v: number, base: number) { return (v / 100) * base; }
function esc(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Build one wall divider between adjacent rooms
function wallRect(x1: number, y1: number, x2: number, y2: number): string {
  const px = p(Math.min(x1,x2), 1000);
  const py = p(Math.min(y1,y2), 700);
  const pw = p(Math.abs(x2-x1), 1000);
  const ph = p(Math.abs(y2-y1), 700);
  return `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" fill="#050b18"/>`;
}

function generateSVG(floorKey: string): string {
  const f = FLOORS[floorKey];

  // ── Coordinate helpers ──────────────────────────────────────────────────────
  // Each zone: px/py/pw/ph in SVG units
  const z2svg = (z: Zone) => ({
    px: p(z.x, 1000), py: p(z.y, 700),
    pw: p(z.w, 1000), ph: p(z.h, 700),
    cx: p(z.x + z.w/2, 1000), cy: p(z.y + z.h/2, 700),
  });

  // Room fill & border colors
  function roomFill(r: boolean)   { return r ? '#12080f' : '#0b1626'; }
  function roomStroke(r: boolean) { return r ? '#2d0d0d' : '#152a4a'; }

  // ── Zone rooms ──────────────────────────────────────────────────────────────
  const rooms = f.zones.map(z => {
    const { px, py, pw, ph, cx, cy } = z2svg(z);
    const fill   = roomFill(z.restricted);
    const stroke = roomStroke(z.restricted);
    const labelColor = z.restricted ? '#3d1212' : '#1a3a6a';
    const codeColor  = z.restricted ? '#2d0d0d' : '#112238';
    const apColor    = z.restricted ? '#3d1515' : '#1a2f52';

    // Hatch pattern is defined in <defs>, just reference it here
    const patternId = `hatch-${z.code.replace('-','_')}`;
    const hatchFill = z.restricted ? `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" fill="url(#${patternId})" opacity="0.4"/>` : '';

    // Corner accent bar (top of room)
    const accentBar = `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="3" fill="${z.restricted ? '#3b0f0f' : f.accentDark}" opacity="0.7"/>`;

    // Room code — bottom-right corner, small, architectural
    const codeText = `<text x="${(px+pw-6).toFixed(1)}" y="${(py+ph-5).toFixed(1)}" text-anchor="end" font-family="'Courier New',Courier,monospace" font-size="9" fill="${codeColor}" opacity="0.8" letter-spacing="0.5">${esc(z.code)}</text>`;

    // AP indicator — tiny wifi dot top-right inside corner
    const apX = px + pw - 14;
    const apY = py + 10;
    const apDot = `
      <circle cx="${apX.toFixed(1)}" cy="${apY.toFixed(1)}" r="2" fill="${apColor}" opacity="0.9"/>
      <circle cx="${apX.toFixed(1)}" cy="${apY.toFixed(1)}" r="5" fill="none" stroke="${apColor}" stroke-width="0.8" opacity="0.5"/>
      <circle cx="${apX.toFixed(1)}" cy="${apY.toFixed(1)}" r="8.5" fill="none" stroke="${apColor}" stroke-width="0.6" opacity="0.3"/>`;

    // Restricted "RESTRICTED" watermark (very subtle, center of room)
    const restrictedMark = z.restricted ? `
      <text x="${cx.toFixed(1)}" y="${(cy+28).toFixed(1)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="900" fill="#3d0d0d" opacity="0.6" letter-spacing="4">RESTRICTED</text>` : '';

    return `
    <rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
    ${hatchFill}
    ${accentBar}
    ${codeText}
    ${apDot}
    ${restrictedMark}`;
  }).join('\n');

  // ── Corridor ────────────────────────────────────────────────────────────────
  const cY  = p(48, 700);
  const cH  = p(4,  700);
  const corridor = `
  <rect x="5" y="${cY.toFixed(1)}" width="990" height="${cH.toFixed(1)}" fill="#040a16" stroke="#0d1e36" stroke-width="0.5"/>
  <text x="500" y="${(cY + cH/2 + 3.5).toFixed(1)}" text-anchor="middle" font-family="'Courier New',Courier,monospace" font-size="8" fill="#0f2a4a" letter-spacing="6">MAIN CORRIDOR</text>`;

  // ── Subtle measurement grid ─────────────────────────────────────────────────
  const gridLines = [
    ...Array.from({length:9},(_,i)=>`<line x1="${(i+1)*100}" y1="52" x2="${(i+1)*100}" y2="695" stroke="#0a1629" stroke-width="0.5"/>`),
    ...Array.from({length:5},(_,i)=>`<line x1="5" y1="${100*(i+1)}" x2="995" y2="${100*(i+1)}" stroke="#0a1629" stroke-width="0.5"/>`),
  ].join('\n  ');

  // ── Header ──────────────────────────────────────────────────────────────────
  const header = `
  <rect x="0" y="0" width="1000" height="52" fill="#040c1a"/>
  <line x1="0" y1="52" x2="1000" y2="52" stroke="#0f2040" stroke-width="1"/>
  <rect x="0" y="0" width="4" height="52" fill="${f.accent}"/>
  <text x="18" y="22" font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="800" fill="#c8d8ed" letter-spacing="0.3">${esc(f.label)}</text>
  <text x="18" y="40" font-family="'Courier New',Courier,monospace" font-size="9" fill="#213a5e" letter-spacing="0.5">${esc(f.sub)}</text>
  <rect x="938" y="9" width="52" height="28" rx="5" fill="${f.accent}" opacity="0.12" stroke="${f.accent}" stroke-width="0.8" stroke-opacity="0.3"/>
  <text x="964" y="28" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="800" fill="${f.accent}">${esc(f.floorCode)}</text>`;

  // ── Compass / north indicator ────────────────────────────────────────────────
  const compass = `
  <g transform="translate(22, 650)">
    <circle cx="0" cy="0" r="14" fill="#04101f" stroke="#0f2040" stroke-width="1"/>
    <polygon points="0,-10 3,-2 0,0 -3,-2" fill="${f.accent}" opacity="0.8"/>
    <polygon points="0,10 3,2 0,0 -3,2" fill="#0f2040"/>
    <text x="0" y="-14" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7" font-weight="800" fill="${f.accent}" opacity="0.7">N</text>
  </g>`;

  // ── Scale bar ────────────────────────────────────────────────────────────────
  const scaleBar = `
  <g transform="translate(50, 685)">
    <line x1="0" y1="0" x2="60" y2="0" stroke="#0f2040" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="0" y1="-3" x2="0" y2="3" stroke="#0f2040" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="60" y1="-3" x2="60" y2="3" stroke="#0f2040" stroke-width="1.5" stroke-linecap="round"/>
    <text x="30" y="-5" text-anchor="middle" font-family="'Courier New',Courier,monospace" font-size="7.5" fill="#152a4a">10 m</text>
  </g>`;

  // ── Building info (bottom-right) ─────────────────────────────────────────────
  const buildingInfo = `
  <text x="992" y="680" text-anchor="end" font-family="'Courier New',Courier,monospace" font-size="7.5" fill="#0f2040">AMC · RFID ASSET TRACKING · ${new Date().getFullYear()}</text>
  <text x="992" y="692" text-anchor="end" font-family="'Courier New',Courier,monospace" font-size="7.5" fill="#0a1628">${esc(f.floorCode)} · Huawei AirEngine BLE 5.0</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700">
  <defs>
    <pattern id="bg-grid" patternUnits="userSpaceOnUse" width="50" height="50">
      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#090f1e" stroke-width="0.5"/>
    </pattern>
    ${f.zones.filter(z=>z.restricted).map(z=>{
      const patternId = `hatch-${z.code.replace('-','_')}`;
      return `<pattern id="${patternId}" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="14" stroke="#2a0909" stroke-width="1"/>
      </pattern>`;
    }).join('\n    ')}
  </defs>

  <!-- Deep navy background -->
  <rect width="1000" height="700" fill="#070d1c"/>
  <rect width="1000" height="700" fill="url(#bg-grid)"/>

  <!-- Grid lines -->
  ${gridLines}

  <!-- Building outer shell -->
  <rect x="3" y="52" width="994" height="643" fill="#080e1e" stroke="#0f2040" stroke-width="1.5" rx="2"/>

  <!-- Corner cross marks (architectural) -->
  ${[[5,54],[993,54],[5,693],[993,693]].map(([cx,cy])=>`
  <line x1="${cx-6}" y1="${cy}" x2="${cx+6}" y2="${cy}" stroke="#0f2040" stroke-width="1"/>
  <line x1="${cx}" y1="${cy-6}" x2="${cx}" y2="${cy+6}" stroke="#0f2040" stroke-width="1"/>`).join('')}

  <!-- Interior room layout -->
  ${rooms}

  <!-- Corridor -->
  ${corridor}

  <!-- Header bar -->
  ${header}

  <!-- Compass -->
  ${compass}

  <!-- Scale bar -->
  ${scaleBar}

  <!-- Building info -->
  ${buildingInfo}
</svg>`;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { floor } = req.query;
  const floorKey = Array.isArray(floor) ? floor[0] : floor ?? '1';

  if (!FLOORS[floorKey]) return res.status(404).json({ error: 'Floor not found' });

  const svg = generateSVG(floorKey);
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  return res.status(200).send(svg);
}
