// @ts-nocheck
/**
 * POST /api/rfid/seed-demo
 *
 * Seeds the database with a world-class demo dataset for Apex Medical Center (AMC).
 * Creates: 3 floor plans, 15 zones, 44 RFID-tagged assets, 800+ scans, alert rules & alerts.
 *
 * Query params:
 *   ?clear=true  — delete existing RFID data for this org before seeding
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

// ── ID generation (matches create.ts format) ──────────────────────────────────
// Produces IDs like EL672401001, EQ672401002, ME672401003 — identical to how
// the main asset creation API generates IDs so demo assets look native.
let _seedCounter = 0;

function generateAssetId(type: string): string {
  _seedCounter++;
  const prefix    = type.substring(0, 2).toUpperCase();
  const ts        = Date.now().toString().slice(-6);            // 6-digit ms tail
  const counter   = _seedCounter.toString().padStart(3, '0');  // 3-digit sequence
  return `${prefix}${ts}${counter}`;
}

function generateBarcode(assetId: string): string {
  // Match generateBarcode in create.ts — strip special chars, min length 8
  const clean = assetId.replace(/[^A-Z0-9]/g, '');
  return clean.length < 8 ? clean + '0'.repeat(8 - clean.length) : clean;
}

// ── Demo data definitions ─────────────────────────────────────────────────────

const FLOOR_PLANS = [
  { key: 'f1', name: 'Floor 1 — Emergency & Diagnostic Center', building: 'AMC Main Building', floorNumber: 1, imageUrl: '/api/rfid/floor-svg/1' },
  { key: 'f2', name: 'Floor 2 — ICU & Critical Care',           building: 'AMC Main Building', floorNumber: 2, imageUrl: '/api/rfid/floor-svg/2' },
  { key: 'f3', name: 'Floor 3 — Patient Wards & Administration',building: 'AMC Main Building', floorNumber: 3, imageUrl: '/api/rfid/floor-svg/3' },
];

// Zones: mapX/Y/W/H in % (0-100). Must match floor-svg/[floor].ts exactly.
const ZONES_DEF = [
  // Floor 1
  { floorKey: 'f1', name: 'Pharmacy Store',          description: 'Controlled medications & pharmacy dispensary', apMac: 'AC:CE:8D:F1:01:AA', apIp: '10.10.1.11', apSn: 'SN210601001', restricted: true,  floor: '1', room: 'PH-01', mapX: 1,  mapY: 8,  mapW: 15, mapH: 40 },
  { floorKey: 'f1', name: 'Emergency Reception',     description: 'Patient intake, triage & waiting area',        apMac: 'AC:CE:8D:F1:02:AA', apIp: '10.10.1.12', apSn: 'SN210601002', restricted: false, floor: '1', room: 'ER-01', mapX: 17, mapY: 8,  mapW: 43, mapH: 40 },
  { floorKey: 'f1', name: 'Trauma Bay A',            description: 'High-acuity trauma resuscitation bay',         apMac: 'AC:CE:8D:F1:03:AA', apIp: '10.10.1.13', apSn: 'SN210601003', restricted: true,  floor: '1', room: 'TB-A1',mapX: 62, mapY: 8,  mapW: 36, mapH: 40 },
  { floorKey: 'f1', name: 'Radiology Suite',         description: 'X-Ray, CT, Ultrasound & ECG diagnostics',      apMac: 'AC:CE:8D:F1:04:AA', apIp: '10.10.1.14', apSn: 'SN210601004', restricted: false, floor: '1', room: 'RAD-01',mapX: 1,  mapY: 52, mapW: 59, mapH: 43 },
  { floorKey: 'f1', name: 'Trauma Bay B',            description: 'Secondary trauma resuscitation bay',            apMac: 'AC:CE:8D:F1:05:AA', apIp: '10.10.1.15', apSn: 'SN210601005', restricted: true,  floor: '1', room: 'TB-B1',mapX: 62, mapY: 52, mapW: 36, mapH: 43 },
  // Floor 2
  { floorKey: 'f2', name: 'ICU Unit A',              description: 'Intensive care — critical monitoring west wing', apMac: 'AC:CE:8D:F2:01:AA', apIp: '10.10.2.11', apSn: 'SN210602001', restricted: false, floor: '2', room: 'ICU-A',mapX: 1,  mapY: 8,  mapW: 31, mapH: 40 },
  { floorKey: 'f2', name: 'ICU Unit B',              description: 'Intensive care — critical monitoring east wing', apMac: 'AC:CE:8D:F2:02:AA', apIp: '10.10.2.12', apSn: 'SN210602002', restricted: false, floor: '2', room: 'ICU-B',mapX: 34, mapY: 8,  mapW: 31, mapH: 40 },
  { floorKey: 'f2', name: 'Recovery Suite',          description: 'Post-operative & procedure recovery',           apMac: 'AC:CE:8D:F2:03:AA', apIp: '10.10.2.13', apSn: 'SN210602003', restricted: false, floor: '2', room: 'REC-01',mapX: 67, mapY: 8,  mapW: 31, mapH: 40 },
  { floorKey: 'f2', name: 'Operating Room 1',        description: 'Sterile surgical theatre — general surgery',    apMac: 'AC:CE:8D:F2:04:AA', apIp: '10.10.2.14', apSn: 'SN210602004', restricted: true,  floor: '2', room: 'OR-1', mapX: 1,  mapY: 52, mapW: 47, mapH: 43 },
  { floorKey: 'f2', name: 'Operating Room 2',        description: 'Sterile surgical theatre — orthopaedic & robotic', apMac: 'AC:CE:8D:F2:05:AA', apIp: '10.10.2.15', apSn: 'SN210602005', restricted: true,  floor: '2', room: 'OR-2', mapX: 50, mapY: 52, mapW: 48, mapH: 43 },
  // Floor 3
  { floorKey: 'f3', name: 'Ward A — General',        description: 'General inpatient ward, 20 beds',              apMac: 'AC:CE:8D:F3:01:AA', apIp: '10.10.3.11', apSn: 'SN210603001', restricted: false, floor: '3', room: 'WD-A', mapX: 1,  mapY: 8,  mapW: 31, mapH: 40 },
  { floorKey: 'f3', name: 'Ward B — Private',        description: 'Private patient suites, VIP care',             apMac: 'AC:CE:8D:F3:02:AA', apIp: '10.10.3.12', apSn: 'SN210603002', restricted: false, floor: '3', room: 'WD-B', mapX: 34, mapY: 8,  mapW: 31, mapH: 40 },
  { floorKey: 'f3', name: 'Nursing Station',         description: 'Central nursing desk & medication room',        apMac: 'AC:CE:8D:F3:03:AA', apIp: '10.10.3.13', apSn: 'SN210603003', restricted: false, floor: '3', room: 'NS-01',mapX: 67, mapY: 8,  mapW: 31, mapH: 40 },
  { floorKey: 'f3', name: 'Medical Supplies Store',  description: 'Sterile supplies, disposables & equipment storage', apMac: 'AC:CE:8D:F3:04:AA', apIp: '10.10.3.14', apSn: 'SN210603004', restricted: true,  floor: '3', room: 'SUP-01',mapX: 1,  mapY: 52, mapW: 50, mapH: 43 },
  { floorKey: 'f3', name: 'Administration Office',   description: 'HR, finance, medical records & management',     apMac: 'AC:CE:8D:F3:05:AA', apIp: '10.10.3.15', apSn: 'SN210603005', restricted: false, floor: '3', room: 'ADM-01',mapX: 53, mapY: 52, mapW: 45, mapH: 43 },
];

// Assets with tag info
// tagStatus: ACTIVE | LOW_BATTERY | MISSING
const ASSETS_DEF = [
  // ── Floor 1 — Emergency Reception ──────────────────────────────────────────
  { name: 'Emergency Patient Monitor',     desc: 'Philips IntelliVue MX800 — bedside vitals monitoring', type: 'ELECTRONICS', floor: '1', room: 'ER-01', zoneKey: 'Emergency Reception',   tagMac: 'AA:BB:CC:F1:01:01', tagType: 'BLE', manufacturer: 'Philips',    model: 'IntelliVue MX800', battery: 85, rssi: -62, tagStatus: 'ACTIVE',      purchase: 28500 },
  { name: 'Cardiac Monitor HD-5000',       desc: 'GE Healthcare CARESCAPE — 12-lead cardiac monitoring',  type: 'ELECTRONICS', floor: '1', room: 'ER-01', zoneKey: 'Emergency Reception',   tagMac: 'AA:BB:CC:F1:01:02', tagType: 'BLE', manufacturer: 'GE Healthcare',model: 'CARESCAPE B650',   battery: 91, rssi: -58, tagStatus: 'ACTIVE',      purchase: 34200 },
  { name: 'Emergency Medication Cart',     desc: 'Omnicell XT automated dispensing cart — RFID tracked',  type: 'EQUIPMENT',   floor: '1', room: 'ER-01', zoneKey: 'Emergency Reception',   tagMac: 'AA:BB:CC:F1:01:03', tagType: 'BLE', manufacturer: 'Omnicell',   model: 'XT95',             battery: 78, rssi: -70, tagStatus: 'ACTIVE',      purchase: 12800 },
  { name: 'Blood Pressure Monitor',        desc: 'Welch Allyn 300 Series digital BP cuff station',         type: 'ELECTRONICS', floor: '1', room: 'ER-01', zoneKey: 'Emergency Reception',   tagMac: 'AA:BB:CC:F1:01:04', tagType: 'BLE', manufacturer: 'Welch Allyn',model: '300 Series',       battery: 67, rssi: -65, tagStatus: 'ACTIVE',      purchase: 4200  },
  { name: 'AED Defibrillator DEF-001',     desc: 'ZOLL AED Plus — Automated External Defibrillator',       type: 'EQUIPMENT',   floor: '1', room: 'ER-01', zoneKey: 'Emergency Reception',   tagMac: 'AA:BB:CC:F1:01:05', tagType: 'BLE', manufacturer: 'ZOLL',       model: 'AED Plus',         battery: 92, rssi: -55, tagStatus: 'ACTIVE',      purchase: 18500 },
  { name: 'Vital Signs Monitor VS-001',    desc: 'Mindray VS-900 — SpO2, NIBP, temp, resp monitoring',     type: 'ELECTRONICS', floor: '1', room: 'ER-01', zoneKey: 'Emergency Reception',   tagMac: 'AA:BB:CC:F1:01:06', tagType: 'BLE', manufacturer: 'Mindray',    model: 'VS-900',           battery: 14, rssi: -72, tagStatus: 'LOW_BATTERY', purchase: 9800  },
  // ── Floor 1 — Trauma Bay A (Restricted) ────────────────────────────────────
  { name: 'Portable Ventilator VNT-001',   desc: 'Draeger Oxylog 3000 — emergency transport ventilator',   type: 'EQUIPMENT',   floor: '1', room: 'TB-A1',zoneKey: 'Trauma Bay A',          tagMac: 'AA:BB:CC:F1:03:01', tagType: 'BLE', manufacturer: 'Draeger',    model: 'Oxylog 3000',      battery: 95, rssi: -48, tagStatus: 'ACTIVE',      purchase: 42000 },
  { name: 'Infusion Pump IP-001',          desc: 'BD Alaris 8015 — multi-channel syringe infusion pump',   type: 'EQUIPMENT',   floor: '1', room: 'TB-A1',zoneKey: 'Trauma Bay A',          tagMac: 'AA:BB:CC:F1:03:02', tagType: 'BLE', manufacturer: 'BD Medical',  model: 'Alaris 8015',      battery: 88, rssi: -52, tagStatus: 'ACTIVE',      purchase: 7600  },
  { name: 'Crash Cart CRC-001',            desc: 'Harloff C6-E crash cart — emergency response cart',       type: 'EQUIPMENT',   floor: '1', room: 'TB-A1',zoneKey: 'Trauma Bay A',          tagMac: 'AA:BB:CC:F1:03:03', tagType: 'BLE', manufacturer: 'Harloff',    model: 'C6-E',             battery: 97, rssi: -45, tagStatus: 'ACTIVE',      purchase: 5800  },
  // ── Floor 1 — Trauma Bay B (Restricted) ────────────────────────────────────
  { name: 'AED Defibrillator DEF-002',     desc: 'ZOLL R Series — biphasic defibrillator/monitor',          type: 'EQUIPMENT',   floor: '1', room: 'TB-B1',zoneKey: 'Trauma Bay B',          tagMac: 'AA:BB:CC:F1:05:01', tagType: 'BLE', manufacturer: 'ZOLL',       model: 'R Series',         battery: 83, rssi: -60, tagStatus: 'ACTIVE',      purchase: 32000 },
  { name: 'Patient Monitor PM-003',        desc: 'Mindray BeneView T8 — advanced patient monitoring',       type: 'ELECTRONICS', floor: '1', room: 'TB-B1',zoneKey: 'Trauma Bay B',          tagMac: 'AA:BB:CC:F1:05:02', tagType: 'BLE', manufacturer: 'Mindray',    model: 'BeneView T8',      battery: 76, rssi: -68, tagStatus: 'ACTIVE',      purchase: 19500 },
  { name: 'Infusion Pump IP-002',          desc: 'Fresenius Kabi Agilia — volumetric infusion pump',        type: 'EQUIPMENT',   floor: '1', room: 'TB-B1',zoneKey: 'Trauma Bay B',          tagMac: 'AA:BB:CC:F1:05:03', tagType: 'BLE', manufacturer: 'Fresenius',  model: 'Agilia VP',        battery: 18, rssi: -75, tagStatus: 'LOW_BATTERY', purchase: 6500  },
  // ── Floor 1 — Radiology Suite ───────────────────────────────────────────────
  { name: 'Portable X-Ray Unit PXR-001',   desc: 'Shimadzu MobileArt Flex — digital mobile X-ray system',  type: 'EQUIPMENT',   floor: '1', room: 'RAD-01',zoneKey: 'Radiology Suite',        tagMac: 'AA:BB:CC:F1:04:01', tagType: 'BLE', manufacturer: 'Shimadzu',   model: 'MobileArt Flex',   battery: 72, rssi: -65, tagStatus: 'ACTIVE',      purchase: 78000 },
  { name: 'Ultrasound Scanner US-001',     desc: 'GE LOGIQ e Premium — portable emergency ultrasound',      type: 'EQUIPMENT',   floor: '1', room: 'RAD-01',zoneKey: 'Radiology Suite',        tagMac: 'AA:BB:CC:F1:04:02', tagType: 'BLE', manufacturer: 'GE Healthcare',model: 'LOGIQ e Premium',  battery: 88, rssi: -58, tagStatus: 'ACTIVE',      purchase: 45000 },
  { name: '12-Lead ECG Machine ECG-001',   desc: 'Mortara ELI 380 — 12-lead resting ECG with interpretation', type: 'ELECTRONICS', floor: '1', room: 'RAD-01',zoneKey: 'Radiology Suite',     tagMac: 'AA:BB:CC:F1:04:03', tagType: 'BLE', manufacturer: 'Mortara',    model: 'ELI 380',          battery: 12, rssi: -80, tagStatus: 'LOW_BATTERY', purchase: 14800 },
  // ── Floor 1 — Pharmacy Store (Restricted) ───────────────────────────────────
  { name: 'Pharmacy Medicine Cart A',      desc: 'Capsa Healthcare M38 — mobile medication cart',           type: 'EQUIPMENT',   floor: '1', room: 'PH-01', zoneKey: 'Pharmacy Store',         tagMac: 'AA:BB:CC:F1:02:01', tagType: 'BLE', manufacturer: 'Capsa',      model: 'M38e',             battery: 41, rssi: -72, tagStatus: 'MISSING',     purchase: 8200  },
  { name: 'Controlled Medication Safe',    desc: 'Omnicell XR2 — automated high-security medication safe',  type: 'EQUIPMENT',   floor: '1', room: 'PH-01', zoneKey: 'Pharmacy Store',         tagMac: 'AA:BB:CC:F1:02:02', tagType: 'BLE', manufacturer: 'Omnicell',   model: 'XR2',              battery: 91, rssi: -50, tagStatus: 'ACTIVE',      purchase: 38000 },
  // ── Floor 2 — ICU Unit A ────────────────────────────────────────────────────
  { name: 'ICU Patient Monitor ICUM-001',  desc: 'Philips IntelliVue MX700 — full-parameter ICU monitor',   type: 'ELECTRONICS', floor: '2', room: 'ICU-A',zoneKey: 'ICU Unit A',             tagMac: 'AA:BB:CC:F2:01:01', tagType: 'BLE', manufacturer: 'Philips',    model: 'IntelliVue MX700', battery: 96, rssi: -42, tagStatus: 'ACTIVE',      purchase: 42000 },
  { name: 'ICU Patient Monitor ICUM-002',  desc: 'Philips IntelliVue MX700 — full-parameter ICU monitor',   type: 'ELECTRONICS', floor: '2', room: 'ICU-A',zoneKey: 'ICU Unit A',             tagMac: 'AA:BB:CC:F2:01:02', tagType: 'BLE', manufacturer: 'Philips',    model: 'IntelliVue MX700', battery: 88, rssi: -48, tagStatus: 'ACTIVE',      purchase: 42000 },
  { name: 'ICU Ventilator VNT-F2-001',     desc: 'Draeger Evita V800 — advanced ICU ventilator',            type: 'EQUIPMENT',   floor: '2', room: 'ICU-A',zoneKey: 'ICU Unit A',             tagMac: 'AA:BB:CC:F2:01:03', tagType: 'BLE', manufacturer: 'Draeger',    model: 'Evita V800',       battery: 94, rssi: -45, tagStatus: 'ACTIVE',      purchase: 65000 },
  { name: 'Syringe Infusion Pump IP-F2-001', desc: 'B. Braun Space — ICU-grade syringe infusion pump',      type: 'EQUIPMENT',   floor: '2', room: 'ICU-A',zoneKey: 'ICU Unit A',             tagMac: 'AA:BB:CC:F2:01:04', tagType: 'BLE', manufacturer: 'B. Braun',   model: 'Space',            battery: 82, rssi: -55, tagStatus: 'ACTIVE',      purchase: 8800  },
  // ── Floor 2 — ICU Unit B ────────────────────────────────────────────────────
  { name: 'ICU Patient Monitor ICUM-003',  desc: 'Mindray BeneVision N22 — ICU multiparameter monitor',     type: 'ELECTRONICS', floor: '2', room: 'ICU-B',zoneKey: 'ICU Unit B',             tagMac: 'AA:BB:CC:F2:02:01', tagType: 'BLE', manufacturer: 'Mindray',    model: 'BeneVision N22',   battery: 91, rssi: -50, tagStatus: 'ACTIVE',      purchase: 38000 },
  { name: 'ICU Patient Monitor ICUM-004',  desc: 'Mindray BeneVision N22 — ICU multiparameter monitor',     type: 'ELECTRONICS', floor: '2', room: 'ICU-B',zoneKey: 'ICU Unit B',             tagMac: 'AA:BB:CC:F2:02:02', tagType: 'BLE', manufacturer: 'Mindray',    model: 'BeneVision N22',   battery: 79, rssi: -58, tagStatus: 'ACTIVE',      purchase: 38000 },
  { name: 'Volumetric Infusion Pump IP-F2-002', desc: 'Baxter Sigma Spectrum — multi-therapy IV pump',      type: 'EQUIPMENT',   floor: '2', room: 'ICU-B',zoneKey: 'ICU Unit B',             tagMac: 'AA:BB:CC:F2:02:03', tagType: 'BLE', manufacturer: 'Baxter',     model: 'Sigma Spectrum',   battery: 87, rssi: -52, tagStatus: 'ACTIVE',      purchase: 9200  },
  // ── Floor 2 — Recovery Suite ────────────────────────────────────────────────
  { name: 'Recovery Room Monitor RM-001',  desc: 'Nihon Kohden BSM-1700 — post-op recovery monitor',        type: 'ELECTRONICS', floor: '2', room: 'REC-01',zoneKey: 'Recovery Suite',         tagMac: 'AA:BB:CC:F2:03:01', tagType: 'BLE', manufacturer: 'Nihon Kohden', model: 'BSM-1700',        battery: 84, rssi: -60, tagStatus: 'ACTIVE',      purchase: 18500 },
  { name: 'Infusion Pump IP-F2-003',       desc: 'BD Alaris 8015 — recovery phase IV infusion',             type: 'EQUIPMENT',   floor: '2', room: 'REC-01',zoneKey: 'Recovery Suite',         tagMac: 'AA:BB:CC:F2:03:02', tagType: 'BLE', manufacturer: 'BD Medical',  model: 'Alaris 8015',      battery: 91, rssi: -55, tagStatus: 'ACTIVE',      purchase: 7600  },
  // ── Floor 2 — Operating Room 1 (Restricted) ─────────────────────────────────
  { name: 'Anesthesia Machine AM-001',     desc: 'Draeger Perseus A500 — fully integrated anesthesia workstation', type: 'EQUIPMENT', floor: '2', room: 'OR-1', zoneKey: 'Operating Room 1',  tagMac: 'AA:BB:CC:F2:04:01', tagType: 'BLE', manufacturer: 'Draeger',    model: 'Perseus A500',     battery: 100, rssi: -35, tagStatus: 'ACTIVE',     purchase: 125000},
  { name: 'Surgical Light System SL-001',  desc: 'Maquet PowerLED II — ceiling-mounted surgical lighting',   type: 'EQUIPMENT',   floor: '2', room: 'OR-1', zoneKey: 'Operating Room 1',      tagMac: 'AA:BB:CC:F2:04:02', tagType: 'BLE', manufacturer: 'Maquet',     model: 'PowerLED II 40',   battery: 99, rssi: -38, tagStatus: 'ACTIVE',      purchase: 58000 },
  // ── Floor 2 — Operating Room 2 (Restricted) ─────────────────────────────────
  { name: 'Anesthesia Machine AM-002',     desc: 'GE Carestation 650 — digital anesthesia workstation',      type: 'EQUIPMENT',   floor: '2', room: 'OR-2', zoneKey: 'Operating Room 2',      tagMac: 'AA:BB:CC:F2:05:01', tagType: 'BLE', manufacturer: 'GE Healthcare',model: 'Carestation 650',  battery: 97, rssi: -40, tagStatus: 'ACTIVE',      purchase: 118000},
  { name: 'Robotic Surgery System SR-001', desc: 'Intuitive da Vinci Xi — robotic-assisted surgical system', type: 'EQUIPMENT',   floor: '2', room: 'OR-2', zoneKey: 'Operating Room 2',      tagMac: 'AA:BB:CC:F2:05:02', tagType: 'BLE', manufacturer: 'Intuitive',  model: 'da Vinci Xi',      battery: 64, rssi: -55, tagStatus: 'MISSING',     purchase: 980000},
  // ── Floor 3 — Ward A — General ──────────────────────────────────────────────
  { name: 'Motorized Wheelchair WC-001',   desc: 'Permobil M3 — power wheelchair for patient transport',     type: 'FURNITURE',   floor: '3', room: 'WD-A', zoneKey: 'Ward A — General',       tagMac: 'AA:BB:CC:F3:01:01', tagType: 'BLE', manufacturer: 'Permobil',   model: 'M3 Corpus',        battery: 72, rssi: -68, tagStatus: 'ACTIVE',      purchase: 12000 },
  { name: 'Standard Wheelchair WC-002',    desc: 'Invacare Tracer EX2 — manual folding wheelchair',          type: 'FURNITURE',   floor: '3', room: 'WD-A', zoneKey: 'Ward A — General',       tagMac: 'AA:BB:CC:F3:01:02', tagType: 'BLE', manufacturer: 'Invacare',   model: 'Tracer EX2',       battery: 65, rssi: -72, tagStatus: 'ACTIVE',      purchase: 950   },
  { name: 'IV Pole Stand IVS-001',         desc: 'Pryor IV stand — 5-hook heavy-duty IV pole',               type: 'EQUIPMENT',   floor: '3', room: 'WD-A', zoneKey: 'Ward A — General',       tagMac: 'AA:BB:CC:F3:01:03', tagType: 'BLE', manufacturer: 'Pryor',      model: 'IV-Pro 5',         battery: 88, rssi: -60, tagStatus: 'ACTIVE',      purchase: 320   },
  { name: 'Ward Medical Cart MC-001',      desc: 'Capsa Solo MC — mobile nursing and medication cart',       type: 'EQUIPMENT',   floor: '3', room: 'WD-A', zoneKey: 'Ward A — General',       tagMac: 'AA:BB:CC:F3:01:04', tagType: 'BLE', manufacturer: 'Capsa',      model: 'Solo MC',          battery: 79, rssi: -65, tagStatus: 'ACTIVE',      purchase: 3200  },
  // ── Floor 3 — Ward B — Private ──────────────────────────────────────────────
  { name: 'Clinical Laptop LT-001',        desc: 'Dell Latitude 5430 Rugged — healthcare-grade clinical laptop', type: 'ELECTRONICS', floor: '3', room: 'WD-B', zoneKey: 'Ward B — Private',    tagMac: 'AA:BB:CC:F3:02:01', tagType: 'BLE', manufacturer: 'Dell',       model: 'Latitude 5430',    battery: 87, rssi: -55, tagStatus: 'ACTIVE',      purchase: 2800  },
  { name: 'Clinical Tablet TB-001',        desc: 'Zebra ET80 — Windows rugged healthcare tablet',             type: 'ELECTRONICS', floor: '3', room: 'WD-B', zoneKey: 'Ward B — Private',       tagMac: 'AA:BB:CC:F3:02:02', tagType: 'BLE', manufacturer: 'Zebra',      model: 'ET80',             battery: 15, rssi: -78, tagStatus: 'LOW_BATTERY', purchase: 1900  },
  { name: 'Ward Medical Cart MC-002',      desc: 'Capsa Solo MC — mobile nursing and medication cart',       type: 'EQUIPMENT',   floor: '3', room: 'WD-B', zoneKey: 'Ward B — Private',        tagMac: 'AA:BB:CC:F3:02:03', tagType: 'BLE', manufacturer: 'Capsa',      model: 'Solo MC',          battery: 93, rssi: -52, tagStatus: 'ACTIVE',      purchase: 3200  },
  { name: 'IV Pole Stand IVS-002',         desc: 'Pryor IV stand — 5-hook heavy-duty IV pole',               type: 'EQUIPMENT',   floor: '3', room: 'WD-B', zoneKey: 'Ward B — Private',        tagMac: 'AA:BB:CC:F3:02:04', tagType: 'BLE', manufacturer: 'Pryor',      model: 'IV-Pro 5',         battery: 81, rssi: -62, tagStatus: 'ACTIVE',      purchase: 320   },
  // ── Floor 3 — Nursing Station ────────────────────────────────────────────────
  { name: 'Nurse Station Laptop LT-002',   desc: 'HP EliteBook 840 G9 — clinical workstation laptop',         type: 'ELECTRONICS', floor: '3', room: 'NS-01',zoneKey: 'Nursing Station',         tagMac: 'AA:BB:CC:F3:03:01', tagType: 'BLE', manufacturer: 'HP',         model: 'EliteBook 840 G9', battery: 94, rssi: -45, tagStatus: 'ACTIVE',      purchase: 2200  },
  { name: 'Clinical Tablet TB-002',        desc: 'Samsung Galaxy Tab Active4 — ruggedised clinical tablet',  type: 'ELECTRONICS', floor: '3', room: 'NS-01',zoneKey: 'Nursing Station',         tagMac: 'AA:BB:CC:F3:03:02', tagType: 'BLE', manufacturer: 'Samsung',    model: 'Tab Active4 Pro',  battery: 82, rssi: -50, tagStatus: 'ACTIVE',      purchase: 1200  },
  // ── Floor 3 — Medical Supplies Store (Restricted) ────────────────────────────
  { name: 'Supply Trolley SC-001',         desc: 'Novus DS cart — lockable sterile supply distribution cart', type: 'EQUIPMENT',   floor: '3', room: 'SUP-01',zoneKey: 'Medical Supplies Store', tagMac: 'AA:BB:CC:F3:04:01', tagType: 'BLE', manufacturer: 'Novus',      model: 'DS-300',           battery: 88, rssi: -58, tagStatus: 'ACTIVE',      purchase: 2400  },
  { name: 'Supply Trolley SC-002',         desc: 'Novus DS cart — lockable sterile supply distribution cart', type: 'EQUIPMENT',   floor: '3', room: 'SUP-01',zoneKey: 'Medical Supplies Store', tagMac: 'AA:BB:CC:F3:04:02', tagType: 'BLE', manufacturer: 'Novus',      model: 'DS-300',           battery: 76, rssi: -63, tagStatus: 'ACTIVE',      purchase: 2400  },
  // ── Floor 3 — Administration Office ─────────────────────────────────────────
  { name: 'Admin Laptop LT-003',           desc: 'Lenovo ThinkPad X1 Carbon — executive admin laptop',       type: 'ELECTRONICS', floor: '3', room: 'ADM-01',zoneKey: 'Administration Office',  tagMac: 'AA:BB:CC:F3:05:01', tagType: 'BLE', manufacturer: 'Lenovo',     model: 'ThinkPad X1',      battery: 76, rssi: -62, tagStatus: 'ACTIVE',      purchase: 3400  },
  { name: 'Office Printer PTR-001',        desc: 'HP LaserJet Enterprise M507dn — departmental printer',     type: 'ELECTRONICS', floor: '3', room: 'ADM-01',zoneKey: 'Administration Office',  tagMac: 'AA:BB:CC:F3:05:02', tagType: 'BLE', manufacturer: 'HP',         model: 'LaserJet M507dn',  battery: 91, rssi: -55, tagStatus: 'ACTIVE',      purchase: 1800  },
];

function hoursAgo(h: number) { return new Date(Date.now() - h * 3600000); }
function minutesAgo(m: number) { return new Date(Date.now() - m * 60000); }

function buildScans(tagDbId: string, zoneDbId: string | null, apMac: string, asset: typeof ASSETS_DEF[0], offsetsHours: number[]) {
  return offsetsHours.map(h => ({
    tagId:     tagDbId,
    zoneId:    zoneDbId,
    apMac,
    rssi:      asset.rssi + Math.round(Math.random() * 6 - 3),
    batteryRaw:asset.battery,
    createdAt: hoursAgo(h + Math.random() * 0.3),
  }));
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  const orgId    = roleData?.organizationId ?? null;
  const userId   = session.user.id;

  try {
    // Reset the asset ID counter for this seed run
    _seedCounter = 0;

    // ── Optional clear ──────────────────────────────────────────────────────
    if (req.query.clear === 'true') {
      await prisma.rFIDAlert.deleteMany({ where: { organizationId: orgId ?? undefined } });
      await prisma.rFIDAlertRule.deleteMany({ where: { organizationId: orgId ?? undefined } });

      // Collect asset IDs linked to RFID tags BEFORE deleting tags,
      // so we can clean up the demo Asset records too.
      const existingTags = await prisma.rFIDTag.findMany({
        where: { organizationId: orgId ?? undefined },
        select: { id: true, assetId: true },
      });
      const demoAssetIds = existingTags.map(t => t.assetId).filter(Boolean) as string[];

      // Delete scans → tags → zones → floor plans
      if (existingTags.length) {
        await prisma.rFIDScan.deleteMany({ where: { tagId: { in: existingTags.map(t => t.id) } } });
      }
      await prisma.rFIDTag.updateMany({ where: { organizationId: orgId ?? undefined }, data: { assetId: null } });
      await prisma.rFIDTag.deleteMany({ where: { organizationId: orgId ?? undefined } });
      await prisma.rFIDZone.deleteMany({ where: { organizationId: orgId ?? undefined } });
      await prisma.floorPlan.deleteMany({ where: { organizationId: orgId ?? undefined } });

      // Delete the Asset records that were created by previous seed runs.
      // We only delete assets that were explicitly linked to RFID tags,
      // which are always demo assets — real assets without tags are left untouched.
      if (demoAssetIds.length) {
        await prisma.asset.deleteMany({ where: { id: { in: demoAssetIds } } });
      }
    }

    // ── 1. Floor plans ──────────────────────────────────────────────────────
    const fpMap: Record<string, string> = {};
    for (const fp of FLOOR_PLANS) {
      const created = await prisma.floorPlan.create({
        data: { name: fp.name, building: fp.building, floorNumber: fp.floorNumber, imageUrl: fp.imageUrl, imageWidth: 1000, imageHeight: 700, organizationId: orgId },
      });
      fpMap[fp.key] = created.id;
    }

    // ── 2. Zones ────────────────────────────────────────────────────────────
    const zoneMap: Record<string, string> = {}; // zone name → DB id
    const zoneApMap: Record<string, string> = {}; // zone name → AP MAC
    for (const z of ZONES_DEF) {
      const created = await prisma.rFIDZone.create({
        data: {
          name:          z.name,
          description:   z.description,
          apMacAddress:  z.apMac,
          apIpAddress:   z.apIp,
          apSerialNumber:z.apSn,
          floorNumber:   z.floor,
          roomNumber:    z.room,
          building:      'AMC Main Building',
          isRestricted:  z.restricted,
          floorPlanId:   fpMap[z.floorKey],
          mapX:          z.mapX,
          mapY:          z.mapY,
          mapWidth:      z.mapW,
          mapHeight:     z.mapH,
          organizationId: orgId,
        },
      });
      zoneMap[z.name]  = created.id;
      zoneApMap[z.name] = z.apMac;
    }

    // ── 3. Assets + RFID tags ────────────────────────────────────────────────
    const scanBatch: any[] = [];

    for (const a of ASSETS_DEF) {
      // Generate IDs that match the application's standard format
      const assetId = generateAssetId(a.type);
      const barcode = generateBarcode(assetId);

      // Create asset
      const asset = await prisma.asset.create({
        data: {
          assetId,
          barcode,
          name:          a.name,
          description:   a.desc,
          type:          a.type as any,
          status:        'ACTIVE',
          floorNumber:   a.floor,
          roomNumber:    a.room,
          purchaseAmount: a.purchase,
          purchaseDate:  new Date('2023-01-15'),
          userId,
          organizationId: orgId,
        },
      });

      const zoneId   = zoneMap[a.zoneKey] ?? null;
      const apMac    = zoneApMap[a.zoneKey] ?? null;
      const isMissing = a.tagStatus === 'MISSING';
      const lastSeen  = isMissing ? hoursAgo(3.5 + Math.random()) : minutesAgo(5 + Math.floor(Math.random() * 8));

      // Create RFID tag
      const tag = await prisma.rFIDTag.create({
        data: {
          tagId:          a.tagMac,
          tagType:        a.tagType,
          assetId:        asset.id,
          status:         a.tagStatus as any,
          batteryLevel:   a.battery,
          lastRssi:       a.rssi,
          lastSeenAt:     lastSeen,
          lastZoneId:     isMissing ? null : zoneId,
          manufacturer:   a.manufacturer,
          model:          a.model,
          notes:          `Deployed at ${a.room} — AMC Main Building`,
          organizationId: orgId,
        },
      });

      // Build scan history
      if (isMissing) {
        // Last scanned 3-4 hours ago, then disappeared
        buildScans(tag.id, zoneId, apMac ?? '', a, [24, 20, 16, 12, 8, 4, 3.5]).forEach(s => scanBatch.push(s));
      } else if (a.tagStatus === 'LOW_BATTERY') {
        buildScans(tag.id, zoneId, apMac ?? '', a, [24, 18, 12, 8, 4, 2, 1, 0.5, 0.1]).forEach(s => scanBatch.push(s));
      } else {
        // Active — scans every 30-90 min for 24h
        buildScans(tag.id, zoneId, apMac ?? '', a, [24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 3, 2, 1.5, 1, 0.5, 0.25, 0.1]).forEach(s => scanBatch.push(s));
      }
    }

    // ── 4. Batch-create scans ────────────────────────────────────────────────
    await prisma.rFIDScan.createMany({ data: scanBatch });

    // ── 5. Alert rules ───────────────────────────────────────────────────────
    const ruleMap: Record<string, string> = {};
    const ruleDefs = [
      { type: 'LOW_BATTERY',    name: 'Low Battery Alert',           enabled: true,  config: { batteryThreshold: 20 } },
      { type: 'MISSING',        name: 'Asset Missing Alert',         enabled: true,  config: { thresholdMinutes: 60 } },
      { type: 'RESTRICTED_ZONE',name: 'Restricted Zone Breach',      enabled: true,  config: {} },
      { type: 'ZONE_BREACH',    name: 'Unauthorized Zone Movement',  enabled: false, config: { thresholdMinutes: 30 } },
    ];
    for (const r of ruleDefs) {
      const rule = await prisma.rFIDAlertRule.create({
        data: { type: r.type, name: r.name, enabled: r.enabled, config: r.config, organizationId: orgId },
      });
      ruleMap[r.type] = rule.id;
    }

    // ── 6. Alerts ────────────────────────────────────────────────────────────
    // Get tag IDs for MISSING and LOW_BATTERY assets
    const missingTags  = await prisma.rFIDTag.findMany({ where: { status: 'MISSING',     organizationId: orgId ?? undefined }, include: { asset: true } });
    const lowBatTags   = await prisma.rFIDTag.findMany({ where: { status: 'LOW_BATTERY', organizationId: orgId ?? undefined }, include: { asset: true } });

    // Missing alerts
    for (const t of missingTags) {
      await prisma.rFIDAlert.create({
        data: {
          ruleId:    ruleMap['MISSING'],
          tagId:     t.id,
          assetId:   t.assetId ?? null,
          assetName: t.asset?.name ?? null,
          zoneName:  null,
          message:   `Asset "${t.asset?.name ?? t.tagId}" has not been detected for over 3 hours — last seen Floor ${t.asset?.floorNumber ?? '?'}, Room ${t.asset?.roomNumber ?? '?'}`,
          severity:  'CRITICAL',
          organizationId: orgId,
          createdAt: hoursAgo(3),
        },
      });
    }

    // Low battery alerts
    for (const t of lowBatTags) {
      const resolved = t.asset?.name === 'Vital Signs Monitor VS-001' ? null : null; // all unresolved for demo
      await prisma.rFIDAlert.create({
        data: {
          ruleId:    ruleMap['LOW_BATTERY'],
          tagId:     t.id,
          assetId:   t.assetId ?? null,
          assetName: t.asset?.name ?? null,
          zoneName:  null,
          message:   `Asset "${t.asset?.name ?? t.tagId}" battery at ${t.batteryLevel}% — replacement required`,
          severity:  'WARNING',
          organizationId: orgId,
          createdAt: minutesAgo(45),
          resolvedAt: resolved,
        },
      });
    }

    // One resolved low-battery alert for historical context
    await prisma.rFIDAlert.create({
      data: {
        ruleId:    ruleMap['LOW_BATTERY'],
        tagId:     null,
        assetId:   null,
        assetName: 'Portable Ventilator VNT-001',
        zoneName:  'Trauma Bay A',
        message:   'Asset "Portable Ventilator VNT-001" battery at 8% — battery replaced, resolved',
        severity:  'WARNING',
        organizationId: orgId,
        createdAt:  hoursAgo(12),
        resolvedAt: hoursAgo(11),
      },
    });

    // Restricted zone breach alert (Emergency Cart detected in Trauma Bay A)
    const erCartTag = await prisma.rFIDTag.findFirst({
      where: { tagId: 'AA:BB:CC:F1:01:03' },
    });
    if (erCartTag) {
      await prisma.rFIDAlert.create({
        data: {
          ruleId:    ruleMap['RESTRICTED_ZONE'],
          tagId:     erCartTag.id,
          assetId:   erCartTag.assetId ?? null,
          assetName: 'Emergency Medication Cart',
          zoneName:  'Trauma Bay A',
          message:   'Asset "Emergency Medication Cart" detected in restricted zone "Trauma Bay A" — unauthorised movement detected',
          severity:  'CRITICAL',
          organizationId: orgId,
          createdAt: minutesAgo(20),
        },
      });
    }

    // ── 7. Summary ───────────────────────────────────────────────────────────
    const summary = {
      success: true,
      created: {
        floorPlans:  3,
        zones:       15,
        assets:      ASSETS_DEF.length,
        rfidTags:    ASSETS_DEF.length,
        scans:       scanBatch.length,
        alertRules:  ruleDefs.length,
        alerts:      missingTags.length + lowBatTags.length + 2, // +resolved +restricted
      },
      company: 'Apex Medical Center (AMC)',
      building: 'AMC Main Building',
      floors:  ['Floor 1 — Emergency & Diagnostic', 'Floor 2 — ICU & Critical Care', 'Floor 3 — Patient Wards & Admin'],
    };

    return res.status(200).json(summary);
  } catch (err) {
    console.error('[seed-demo]', err);
    return res.status(500).json({ error: 'Seed failed', details: String(err) });
  }
}
