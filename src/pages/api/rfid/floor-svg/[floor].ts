// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';

// ── Zone layout constants ─────────────────────────────────────────────────────
// These MUST match the mapX/mapY/mapW/mapH values used in seed-demo.ts
// coordinates are % of 1000×700 image

const FLOORS: Record<string, { title: string; subtitle: string; accentColor: string; zones: Zone[] }> = {
  '1': {
    title: 'Floor 1 — Emergency & Diagnostic Center',
    subtitle: 'Apex Medical Center · AMC Main Building · Huawei AirEngine BLE 5.0',
    accentColor: '#3b82f6',
    zones: [
      { name: 'Pharmacy Store',         ap: 'AC:CE:8D:F1:01:AA', restricted: true,  x: 1,  y: 8,  w: 15, h: 40, icon: 'pharmacy',   assets: 2  },
      { name: 'Emergency Reception',    ap: 'AC:CE:8D:F1:02:AA', restricted: false, x: 17, y: 8,  w: 43, h: 40, icon: 'reception',  assets: 6  },
      { name: 'Trauma Bay A',           ap: 'AC:CE:8D:F1:03:AA', restricted: true,  x: 62, y: 8,  w: 36, h: 40, icon: 'trauma',     assets: 3  },
      { name: 'Radiology Suite',        ap: 'AC:CE:8D:F1:04:AA', restricted: false, x: 1,  y: 52, w: 59, h: 43, icon: 'radiology',  assets: 3  },
      { name: 'Trauma Bay B',           ap: 'AC:CE:8D:F1:05:AA', restricted: true,  x: 62, y: 52, w: 36, h: 43, icon: 'trauma',     assets: 3  },
    ],
  },
  '2': {
    title: 'Floor 2 — ICU & Critical Care',
    subtitle: 'Apex Medical Center · AMC Main Building · Huawei AirEngine BLE 5.0',
    accentColor: '#8b5cf6',
    zones: [
      { name: 'ICU Unit A',       ap: 'AC:CE:8D:F2:01:AA', restricted: false, x: 1,  y: 8,  w: 31, h: 40, icon: 'icu',        assets: 4  },
      { name: 'ICU Unit B',       ap: 'AC:CE:8D:F2:02:AA', restricted: false, x: 34, y: 8,  w: 31, h: 40, icon: 'icu',        assets: 3  },
      { name: 'Recovery Suite',   ap: 'AC:CE:8D:F2:03:AA', restricted: false, x: 67, y: 8,  w: 31, h: 40, icon: 'recovery',   assets: 2  },
      { name: 'Operating Room 1', ap: 'AC:CE:8D:F2:04:AA', restricted: true,  x: 1,  y: 52, w: 47, h: 43, icon: 'or',         assets: 2  },
      { name: 'Operating Room 2', ap: 'AC:CE:8D:F2:05:AA', restricted: true,  x: 50, y: 52, w: 48, h: 43, icon: 'or',         assets: 2  },
    ],
  },
  '3': {
    title: 'Floor 3 — Patient Wards & Administration',
    subtitle: 'Apex Medical Center · AMC Main Building · Huawei AirEngine BLE 5.0',
    accentColor: '#14b8a6',
    zones: [
      { name: 'Ward A — General',         ap: 'AC:CE:8D:F3:01:AA', restricted: false, x: 1,  y: 8,  w: 31, h: 40, icon: 'ward',    assets: 4  },
      { name: 'Ward B — Private',          ap: 'AC:CE:8D:F3:02:AA', restricted: false, x: 34, y: 8,  w: 31, h: 40, icon: 'ward',    assets: 4  },
      { name: 'Nursing Station',           ap: 'AC:CE:8D:F3:03:AA', restricted: false, x: 67, y: 8,  w: 31, h: 40, icon: 'nurse',   assets: 2  },
      { name: 'Medical Supplies Store',    ap: 'AC:CE:8D:F3:04:AA', restricted: true,  x: 1,  y: 52, w: 50, h: 43, icon: 'supply',  assets: 2  },
      { name: 'Administration Office',     ap: 'AC:CE:8D:F3:05:AA', restricted: false, x: 53, y: 52, w: 45, h: 43, icon: 'admin',   assets: 2  },
    ],
  },
};

interface Zone {
  name: string; ap: string; restricted: boolean;
  x: number; y: number; w: number; h: number;
  icon: string; assets: number;
}

// ── SVG generator ─────────────────────────────────────────────────────────────
function pct(val: number, base: number) { return (val / 100) * base; }

function zoneSvg(z: Zone, accent: string): string {
  const px = pct(z.x, 1000);
  const py = pct(z.y, 700);
  const pw = pct(z.w, 1000);
  const ph = pct(z.h, 700);
  const cx = px + pw / 2;
  const cy = py + ph / 2;

  const fill      = z.restricted ? '#fff1f2' : '#eff6ff';
  const stroke    = z.restricted ? '#fca5a5' : '#bfdbfe';
  const header    = z.restricted ? '#dc2626' : accent;
  const labelClr  = z.restricted ? '#ef4444' : '#1d4ed8';

  const iconSvg   = getIcon(z.icon, cx, cy - 28, z.restricted);
  const nameLines = z.name.split(' — ').join('\n').split(' ');
  // wrap at ~18 chars
  const lines: string[] = [];
  let cur = '';
  for (const word of nameLines) {
    if ((cur + ' ' + word).trim().length > 17 && cur) { lines.push(cur.trim()); cur = word; }
    else cur = cur ? cur + ' ' + word : word;
  }
  if (cur) lines.push(cur.trim());

  const textY = cy + (z.restricted ? 8 : 4);

  return `
  <rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" rx="2"/>
  <rect x="${px}" y="${py}" width="${pw}" height="5" fill="${header}" rx="2"/>
  ${iconSvg}
  ${lines.map((l, i) => `<text x="${cx}" y="${textY + i * 14}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="${labelClr}">${escXml(l)}</text>`).join('\n  ')}
  ${z.restricted ? `<text x="${cx}" y="${textY + lines.length * 14 + 2}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="#dc2626">⚠ RESTRICTED ACCESS</text>` : ''}
  <text x="${cx}" y="${py + ph - 18}" text-anchor="middle" font-family="monospace,sans-serif" font-size="8" fill="#94a3b8">AP: ${z.ap}</text>
  <text x="${px + pw - 8}" y="${py + 16}" text-anchor="end" font-family="system-ui,sans-serif" font-size="9" fill="${z.restricted ? '#dc2626' : '#3b82f6'}">${z.assets} assets</text>`;
}

function getIcon(icon: string, cx: number, cy: number, restricted: boolean): string {
  const c = restricted ? '#fca5a5' : '#bfdbfe';
  const f = restricted ? '#fee2e2' : '#dbeafe';
  switch (icon) {
    case 'pharmacy':
      return `<rect x="${cx-12}" y="${cy-8}" width="24" height="16" rx="3" fill="${f}" stroke="${c}"/>
              <rect x="${cx-2}" y="${cy-13}" width="4" height="26" rx="2" fill="${c}"/>
              <rect x="${cx-9}" y="${cy-2}" width="18" height="4" rx="2" fill="${c}"/>`;
    case 'reception':
      return `<rect x="${cx-20}" y="${cy-6}" width="40" height="12" rx="3" fill="${f}" stroke="${c}"/>
              <circle cx="${cx-10}" cy="${cy}" r="5" fill="${c}"/>
              <circle cx="${cx+10}" cy="${cy}" r="5" fill="${c}"/>`;
    case 'trauma':
      return `<circle cx="${cx}" cy="${cy}" r="14" fill="${f}" stroke="${c}"/>
              <rect x="${cx-2}" y="${cy-10}" width="4" height="20" rx="2" fill="${c}"/>
              <rect x="${cx-10}" y="${cy-2}" width="20" height="4" rx="2" fill="${c}"/>`;
    case 'radiology':
      return `<circle cx="${cx}" cy="${cy}" r="14" fill="${f}" stroke="${c}"/>
              <circle cx="${cx}" cy="${cy}" r="7" fill="${c}" opacity="0.5"/>`;
    case 'icu':
      return `<rect x="${cx-18}" y="${cy-8}" width="36" height="16" rx="3" fill="${f}" stroke="${c}"/>
              <rect x="${cx-6}" y="${cy-14}" width="12" height="6" rx="1" fill="${c}"/>`;
    case 'recovery':
      return `<path d="${`M${cx-14},${cy} Q${cx},${cy-14} ${cx+14},${cy} Q${cx},${cy+6} ${cx-14},${cy}`}" fill="${f}" stroke="${c}"/>`;
    case 'or':
      return `<rect x="${cx-16}" y="${cy-16}" width="32" height="32" rx="16" fill="${f}" stroke="${c}"/>
              <rect x="${cx-2}" y="${cy-12}" width="4" height="24" rx="2" fill="${c}"/>
              <rect x="${cx-12}" y="${cy-2}" width="24" height="4" rx="2" fill="${c}"/>`;
    case 'ward':
      return `<rect x="${cx-18}" y="${cy-10}" width="36" height="20" rx="3" fill="${f}" stroke="${c}"/>
              <rect x="${cx-14}" y="${cy-10}" width="10" height="7" rx="1" fill="${c}" opacity="0.5"/>
              <rect x="${cx+4}" y="${cy-10}" width="10" height="7" rx="1" fill="${c}" opacity="0.5"/>`;
    case 'nurse':
      return `<circle cx="${cx}" cy="${cy-8}" r="8" fill="${f}" stroke="${c}"/>
              <rect x="${cx-10}" y="${cy+2}" width="20" height="8" rx="2" fill="${f}" stroke="${c}"/>`;
    case 'supply':
      return `<rect x="${cx-16}" y="${cy-12}" width="32" height="24" rx="3" fill="${f}" stroke="${c}"/>
              <rect x="${cx-10}" y="${cy-8}" width="6" height="16" rx="1" fill="${c}" opacity="0.7"/>
              <rect x="${cx+4}" y="${cy-8}" width="6" height="16" rx="1" fill="${c}" opacity="0.7"/>`;
    case 'admin':
      return `<rect x="${cx-18}" y="${cy-12}" width="36" height="24" rx="3" fill="${f}" stroke="${c}"/>
              <rect x="${cx-14}" y="${cy-8}" width="12" height="8" rx="1" fill="${c}" opacity="0.5"/>
              <rect x="${cx+2}" y="${cy-8}" width="12" height="8" rx="1" fill="${c}" opacity="0.5"/>`;
    default:
      return `<rect x="${cx-12}" y="${cy-8}" width="24" height="16" rx="3" fill="${f}" stroke="${c}"/>`;
  }
}

function escXml(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function generateSVG(floor: string): string {
  const f = FLOORS[floor];
  if (!f) return '';

  const corridor = `<rect x="10" y="${pct(48.5, 700)}" width="980" height="${pct(3, 700)}" fill="#e2e8f0" rx="1"/>
  <text x="500" y="${pct(50.5, 700)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#94a3b8">MAIN CORRIDOR</text>`;

  const legend = `
  <rect x="0" y="670" width="1000" height="30" fill="#f8fafc"/>
  <line x1="0" y1="670" x2="1000" y2="670" stroke="#e2e8f0" stroke-width="1"/>
  <circle cx="12" cy="685" r="5" fill="${f.accentColor}"/>
  <text x="22" y="689" font-family="system-ui,sans-serif" font-size="9" fill="#64748b">Normal Zone</text>
  <circle cx="110" cy="685" r="5" fill="#dc2626"/>
  <text x="120" y="689" font-family="system-ui,sans-serif" font-size="9" fill="#64748b">Restricted Zone</text>
  <circle cx="218" cy="685" r="5" fill="#10b981"/>
  <text x="228" y="689" font-family="system-ui,sans-serif" font-size="9" fill="#64748b">Asset Active</text>
  <circle cx="316" cy="685" r="5" fill="#f59e0b"/>
  <text x="326" y="689" font-family="system-ui,sans-serif" font-size="9" fill="#64748b">Low Battery</text>
  <circle cx="406" cy="685" r="5" fill="#ef4444"/>
  <text x="416" y="689" font-family="system-ui,sans-serif" font-size="9" fill="#64748b">Missing / Alert</text>
  <text x="988" y="689" text-anchor="end" font-family="monospace,sans-serif" font-size="8" fill="#94a3b8">Apex Medical Center · Floor ${floor} · RFID Asset Tracking</text>`;

  // Grid lines (subtle)
  const gridH = Array.from({ length: 9 }, (_, i) =>
    `<line x1="${(i + 1) * 100}" y1="0" x2="${(i + 1) * 100}" y2="700" stroke="#f1f5f9" stroke-width="0.5"/>`
  ).join('');
  const gridV = Array.from({ length: 6 }, (_, i) =>
    `<line x1="0" y1="${(i + 1) * 100}" x2="1000" y2="${(i + 1) * 100}" stroke="#f1f5f9" stroke-width="0.5"/>`
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700">
  <!-- Background -->
  <rect width="1000" height="700" fill="#f8fafc"/>
  ${gridH}${gridV}

  <!-- Outer wall -->
  <rect x="3" y="50" width="994" height="620" fill="none" stroke="#334155" stroke-width="2" rx="2"/>

  <!-- Header -->
  <rect x="0" y="0" width="1000" height="50" fill="#0f172a"/>
  <rect x="0" y="0" width="6" height="50" fill="${f.accentColor}"/>
  <text x="18" y="28" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="white">${escXml(f.title)}</text>
  <text x="18" y="44" font-family="system-ui,sans-serif" font-size="10" fill="#64748b">${escXml(f.subtitle)}</text>
  <rect x="940" y="10" width="50" height="30" rx="4" fill="${f.accentColor}" opacity="0.2"/>
  <text x="965" y="30" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="${f.accentColor}">FL ${floor}</text>

  <!-- Corridor -->
  ${corridor}

  <!-- Zones -->
  ${f.zones.map(z => zoneSvg(z, f.accentColor)).join('\n')}

  <!-- AP WiFi indicators -->
  ${f.zones.map(z => {
    const px = pct(z.x + z.w, 1000) - 18;
    const py = pct(z.y, 700) + 10;
    return `<g opacity="0.5">
      <circle cx="${px+6}" cy="${py+6}" r="10" fill="none" stroke="${z.restricted ? '#ef4444' : '#3b82f6'}" stroke-width="1.2" opacity="0.4"/>
      <circle cx="${px+6}" cy="${py+6}" r="6" fill="none" stroke="${z.restricted ? '#ef4444' : '#3b82f6'}" stroke-width="1.2" opacity="0.6"/>
      <circle cx="${px+6}" cy="${py+6}" r="2.5" fill="${z.restricted ? '#ef4444' : '#3b82f6'}"/>
    </g>`;
  }).join('\n  ')}

  <!-- Legend -->
  ${legend}
</svg>`;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { floor } = req.query;
  const floorStr = Array.isArray(floor) ? floor[0] : floor ?? '1';

  if (!FLOORS[floorStr]) {
    return res.status(404).json({ error: 'Floor not found' });
  }

  const svg = generateSVG(floorStr);

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(svg);
}
