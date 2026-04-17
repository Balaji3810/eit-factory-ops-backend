/**
 * EIT™ Mock Data Layer
 * =====================
 * Structured, realistic manufacturing data for 4 plants, 12 departments,
 * 40+ machines, 3 shifts, and 30 days of production/downtime/cost/labor logs.
 *
 * Data is generated deterministically so the dashboard is consistent across reloads.
 */

import { SHIFTS, DOWNTIME_CATEGORIES, FAILURE_CATEGORIES } from './config';

// ---------------------------------------------------------------------------
// Seeded pseudo-random generator (deterministic across runs)
// ---------------------------------------------------------------------------
function createRNG(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const rand = createRNG(2025);
const randBetween = (min, max) => min + rand() * (max - min);
const randInt = (min, max) => Math.floor(randBetween(min, max + 1));
const pick = (arr) => arr[randInt(0, arr.length - 1)];

// ---------------------------------------------------------------------------
// Plants
// ---------------------------------------------------------------------------
export const plants = [
  { id: 'DEN', name: 'Denver Plant',    location: 'Denver, CO',    type: 'Manufacturing', timezone: 'America/Denver' },
  { id: 'ATL', name: 'Atlanta Plant',   location: 'Atlanta, GA',   type: 'Packaging',    timezone: 'America/New_York' },
  { id: 'CHI', name: 'Chicago Plant',   location: 'Chicago, IL',   type: 'Assembly',     timezone: 'America/Chicago' },
  { id: 'HOU', name: 'Houston Plant',   location: 'Houston, TX',   type: 'Processing',   timezone: 'America/Chicago' },
];

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------
export const departments = [
  { id: 'DEN-PROD', name: 'Production',  plantId: 'DEN' },
  { id: 'DEN-PKG',  name: 'Packaging',   plantId: 'DEN' },
  { id: 'DEN-QA',   name: 'Quality',     plantId: 'DEN' },
  { id: 'ATL-PROD', name: 'Production',  plantId: 'ATL' },
  { id: 'ATL-PKG',  name: 'Packaging',   plantId: 'ATL' },
  { id: 'ATL-MAINT',name: 'Maintenance', plantId: 'ATL' },
  { id: 'CHI-PROD', name: 'Production',  plantId: 'CHI' },
  { id: 'CHI-ASM',  name: 'Assembly',    plantId: 'CHI' },
  { id: 'CHI-QA',   name: 'Quality',     plantId: 'CHI' },
  { id: 'HOU-PROD', name: 'Production',  plantId: 'HOU' },
  { id: 'HOU-PKG',  name: 'Packaging',   plantId: 'HOU' },
  { id: 'HOU-MAINT',name: 'Maintenance', plantId: 'HOU' },
];

// ---------------------------------------------------------------------------
// Lines (production lines within each plant)
// ---------------------------------------------------------------------------
export const lines = [
  { id: 'DEN-R1', name: 'Line R1', plantId: 'DEN', description: 'Primary Production' },
  { id: 'DEN-R2', name: 'Line R2', plantId: 'DEN', description: 'Packaging & Labeling' },
  { id: 'DEN-R3', name: 'Line R3', plantId: 'DEN', description: 'Quality & Inspection' },
  { id: 'ATL-A1', name: 'Line A1', plantId: 'ATL', description: 'Carton Forming & Sealing' },
  { id: 'ATL-A2', name: 'Line A2', plantId: 'ATL', description: 'Wrapping & Palletizing' },
  { id: 'ATL-A3', name: 'Line A3', plantId: 'ATL', description: 'Support & Logistics' },
  { id: 'CHI-C1', name: 'Line C1', plantId: 'CHI', description: 'Assembly & Robotics' },
  { id: 'CHI-C2', name: 'Line C2', plantId: 'CHI', description: 'CNC Machining & Finishing' },
  { id: 'CHI-C3', name: 'Line C3', plantId: 'CHI', description: 'Inspection & Testing' },
  { id: 'HOU-H1', name: 'Line H1', plantId: 'HOU', description: 'Reaction & Processing' },
  { id: 'HOU-H2', name: 'Line H2', plantId: 'HOU', description: 'Dispensing & Packing' },
  { id: 'HOU-H3', name: 'Line H3', plantId: 'HOU', description: 'Utilities & Lab' },
];

// ---------------------------------------------------------------------------
// Machines (assets) — each belongs to a plant, department, AND line
// ---------------------------------------------------------------------------
export const machines = [
  // Denver – Line R1 (Primary Production)
  { id: 'DEN-001', name: 'Machine D-01',  departmentId: 'DEN-PROD', lineId: 'DEN-R1', plantId: 'DEN', type: 'Station',   designSpeed: 12000 },
  { id: 'DEN-002', name: 'Machine D-02',  departmentId: 'DEN-PROD', lineId: 'DEN-R1', plantId: 'DEN', type: 'Station',   designSpeed: 10000 },
  { id: 'DEN-003', name: 'Machine D-03',  departmentId: 'DEN-PROD', lineId: 'DEN-R1', plantId: 'DEN', type: 'Module',    designSpeed: 14000 },
  { id: 'DEN-006', name: 'Machine D-04',  departmentId: 'DEN-PROD', lineId: 'DEN-R1', plantId: 'DEN', type: 'Press',     designSpeed: 15000 },
  { id: 'DEN-009', name: 'Machine D-05',  departmentId: 'DEN-PROD', lineId: 'DEN-R1', plantId: 'DEN', type: 'Washer',    designSpeed: 13000 },
  // Denver – Line R2 (Packaging & Labeling)
  { id: 'DEN-004', name: 'Machine D-06',  departmentId: 'DEN-PKG',  lineId: 'DEN-R2', plantId: 'DEN', type: 'Labeler',    designSpeed: 11000 },
  { id: 'DEN-005', name: 'Machine D-07',  departmentId: 'DEN-PKG',  lineId: 'DEN-R2', plantId: 'DEN', type: 'Palletizer', designSpeed: 8000 },
  { id: 'DEN-008', name: 'Machine D-08',  departmentId: 'DEN-PKG',  lineId: 'DEN-R2', plantId: 'DEN', type: 'Wrapper',    designSpeed: 6000 },
  { id: 'DEN-010', name: 'Machine D-09',  departmentId: 'DEN-PKG',  lineId: 'DEN-R2', plantId: 'DEN', type: 'Packer',     designSpeed: 9000 },
  // Denver – Line R3 (Quality)
  { id: 'DEN-007', name: 'Machine D-10',  departmentId: 'DEN-QA',   lineId: 'DEN-R3', plantId: 'DEN', type: 'Inspector',  designSpeed: 20000 },
  // Atlanta – Line A1 (Carton Forming)
  { id: 'ATL-001', name: 'Machine A-01',  departmentId: 'ATL-PROD', lineId: 'ATL-A1', plantId: 'ATL', type: 'Former',  designSpeed: 7000 },
  { id: 'ATL-002', name: 'Machine A-02',  departmentId: 'ATL-PROD', lineId: 'ATL-A1', plantId: 'ATL', type: 'Sealer',  designSpeed: 7500 },
  { id: 'ATL-008', name: 'Machine A-03',  departmentId: 'ATL-PROD', lineId: 'ATL-A1', plantId: 'ATL', type: 'Printer', designSpeed: 10000 },
  { id: 'ATL-009', name: 'Machine A-04',  departmentId: 'ATL-PROD', lineId: 'ATL-A1', plantId: 'ATL', type: 'Former',  designSpeed: 6000 },
  // Atlanta – Line A2 (Wrapping & Palletizing)
  { id: 'ATL-003', name: 'Machine A-05',  departmentId: 'ATL-PKG',  lineId: 'ATL-A2', plantId: 'ATL', type: 'Wrapper',    designSpeed: 6500 },
  { id: 'ATL-004', name: 'Machine A-06',  departmentId: 'ATL-PKG',  lineId: 'ATL-A2', plantId: 'ATL', type: 'Labeler',    designSpeed: 9000 },
  { id: 'ATL-005', name: 'Machine A-07',  departmentId: 'ATL-PKG',  lineId: 'ATL-A2', plantId: 'ATL', type: 'Palletizer', designSpeed: 8500 },
  { id: 'ATL-006', name: 'Machine A-08',  departmentId: 'ATL-PKG',  lineId: 'ATL-A2', plantId: 'ATL', type: 'Wrapper',    designSpeed: 5500 },
  // Atlanta – Line A3 (Support)
  { id: 'ATL-007', name: 'Machine A-09',  departmentId: 'ATL-MAINT',lineId: 'ATL-A3', plantId: 'ATL', type: 'Conveyor',  designSpeed: 12000 },
  { id: 'ATL-010', name: 'Machine A-10',  departmentId: 'ATL-MAINT',lineId: 'ATL-A3', plantId: 'ATL', type: 'Inspector', designSpeed: 11000 },
  // Chicago – Line C1 (Assembly & Robotics)
  { id: 'CHI-001', name: 'Machine C-01',  departmentId: 'CHI-ASM',  lineId: 'CHI-C1', plantId: 'CHI', type: 'Assembly', designSpeed: 5000 },
  { id: 'CHI-002', name: 'Machine C-02',  departmentId: 'CHI-ASM',  lineId: 'CHI-C1', plantId: 'CHI', type: 'Assembly', designSpeed: 4500 },
  { id: 'CHI-008', name: 'Machine C-03',  departmentId: 'CHI-ASM',  lineId: 'CHI-C1', plantId: 'CHI', type: 'Robot',    designSpeed: 4000 },
  { id: 'CHI-003', name: 'Machine C-04',  departmentId: 'CHI-PROD', lineId: 'CHI-C1', plantId: 'CHI', type: 'Welder',   designSpeed: 3000 },
  { id: 'CHI-009', name: 'Machine C-05',  departmentId: 'CHI-PROD', lineId: 'CHI-C1', plantId: 'CHI', type: 'Deburr',   designSpeed: 3200 },
  // Chicago – Line C2 (CNC Machining)
  { id: 'CHI-004', name: 'Machine C-06',  departmentId: 'CHI-PROD', lineId: 'CHI-C2', plantId: 'CHI', type: 'CNC',     designSpeed: 2500 },
  { id: 'CHI-005', name: 'Machine C-07',  departmentId: 'CHI-PROD', lineId: 'CHI-C2', plantId: 'CHI', type: 'CNC',     designSpeed: 2000 },
  { id: 'CHI-006', name: 'Machine C-08',  departmentId: 'CHI-PROD', lineId: 'CHI-C2', plantId: 'CHI', type: 'Painter', designSpeed: 3500 },
  // Chicago – Line C3 (Inspection)
  { id: 'CHI-007', name: 'Machine C-09',  departmentId: 'CHI-QA',   lineId: 'CHI-C3', plantId: 'CHI', type: 'Inspector', designSpeed: 6000 },
  { id: 'CHI-010', name: 'Machine C-10',  departmentId: 'CHI-QA',   lineId: 'CHI-C3', plantId: 'CHI', type: 'Tester',    designSpeed: 5500 },
  // Houston – Line H1 (Reaction & Processing)
  { id: 'HOU-001', name: 'Machine H-01',  departmentId: 'HOU-PROD', lineId: 'HOU-H1', plantId: 'HOU', type: 'Reactor',    designSpeed: 4000 },
  { id: 'HOU-002', name: 'Machine H-02',  departmentId: 'HOU-PROD', lineId: 'HOU-H1', plantId: 'HOU', type: 'Reactor',    designSpeed: 3800 },
  { id: 'HOU-003', name: 'Machine H-03',  departmentId: 'HOU-PROD', lineId: 'HOU-H1', plantId: 'HOU', type: 'Mixer',      designSpeed: 6000 },
  { id: 'HOU-008', name: 'Machine H-04',  departmentId: 'HOU-PROD', lineId: 'HOU-H1', plantId: 'HOU', type: 'Distiller',  designSpeed: 3500 },
  { id: 'HOU-009', name: 'Machine H-05',  departmentId: 'HOU-PROD', lineId: 'HOU-H1', plantId: 'HOU', type: 'Centrifuge', designSpeed: 4500 },
  // Houston – Line H2 (Filling & Packing)
  { id: 'HOU-004', name: 'Machine H-06',  departmentId: 'HOU-PKG',  lineId: 'HOU-H2', plantId: 'HOU', type: 'Dispenser', designSpeed: 8000 },
  { id: 'HOU-005', name: 'Machine H-07',  departmentId: 'HOU-PKG',  lineId: 'HOU-H2', plantId: 'HOU', type: 'Packer',    designSpeed: 3000 },
  { id: 'HOU-006', name: 'Machine H-08',  departmentId: 'HOU-PKG',  lineId: 'HOU-H2', plantId: 'HOU', type: 'Dispenser', designSpeed: 2500 },
  // Houston – Line H3 (Utilities & Lab)
  { id: 'HOU-007', name: 'Machine H-09',  departmentId: 'HOU-MAINT',lineId: 'HOU-H3', plantId: 'HOU', type: 'Pump',     designSpeed: 10000 },
  { id: 'HOU-010', name: 'Machine H-10',  departmentId: 'HOU-MAINT',lineId: 'HOU-H3', plantId: 'HOU', type: 'Analyzer',  designSpeed: 7000 },
];

// ---------------------------------------------------------------------------
// Production log generator (30 days × 3 shifts × all machines)
// ---------------------------------------------------------------------------
function generateProductionLogs() {
  const logs = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    const dateKey = date.toISOString().split('T')[0];

    for (const machine of machines) {
      for (const shift of SHIFTS) {
        const plannedTime = shift.hours * 60; // 480 min

        // Machine-specific performance profiles
        const perfFactor = 0.7 + rand() * 0.28;            // 70–98% base performance
        const qualFactor = 0.92 + rand() * 0.07;            // 92–99% quality
        const uptimeFactor = 0.80 + rand() * 0.18;          // 80–98% uptime

        // Occasional bad shifts (5% chance)
        const isBadShift = rand() < 0.05;
        const downtime = isBadShift
          ? randBetween(60, 180)
          : randBetween(5, plannedTime * (1 - uptimeFactor));

        const operatingTime = Math.max(plannedTime - downtime, 0);
        const idealCycleTime = 60 / machine.designSpeed; // min per unit
        const maxUnits = operatingTime / idealCycleTime;
        const totalCount = Math.round(maxUnits * perfFactor);
        const goodCount = Math.round(totalCount * qualFactor);

        // Cost: base + proportional to output
        const baseCost = randBetween(200, 500);
        const unitCost = randBetween(0.02, 0.08);
        const totalCost = baseCost + totalCount * unitCost;

        // Labor
        const operators = randInt(1, 3);
        const laborHours = operators * shift.hours;
        const standardOutput = Math.round(maxUnits * 0.9);
        const actualOutput = totalCount;

        logs.push({
          id: `${dateKey}-${machine.id}-${shift.id}`,
          machineId: machine.id,
          plantId: machine.plantId,
          departmentId: machine.departmentId,
          lineId: machine.lineId,
          date: dateKey,
          shiftId: shift.id,
          plannedProductionTime: plannedTime,
          operatingTime: Math.round(operatingTime),
          idealCycleTime,
          totalCount,
          goodCount,
          downtime: Math.round(downtime),
          totalCost: Math.round(totalCost * 100) / 100,
          laborHours,
          standardOutput,
          actualOutput,
        });
      }
    }
  }
  return logs;
}

// ---------------------------------------------------------------------------
// Downtime log generator
// ---------------------------------------------------------------------------
function generateDowntimeLogs(productionLogs) {
  const logs = [];
  let id = 0;

  for (const pLog of productionLogs) {
    if (pLog.downtime < 5) continue; // skip negligible downtime

    // Split downtime into 1–3 events
    const eventCount = pLog.downtime > 60 ? randInt(2, 4) : randInt(1, 2);
    let remaining = pLog.downtime;

    for (let e = 0; e < eventCount && remaining > 2; e++) {
      const dur = e === eventCount - 1
        ? remaining
        : Math.round(randBetween(2, remaining * 0.6));
      remaining -= dur;

      const category = pick(DOWNTIME_CATEGORIES);
      logs.push({
        id: `DT-${++id}`,
        machineId: pLog.machineId,
        plantId: pLog.plantId,
        lineId: pLog.lineId,
        date: pLog.date,
        shiftId: pLog.shiftId,
        duration: dur,
        category,
        isFailure: FAILURE_CATEGORIES.includes(category),
        reason: pick([
          'Belt wear detected', 'Sensor misalignment', 'Material jam',
          'Bearing overheated', 'PLC fault', 'Conveyor stall',
          'Quality deviation', 'Supply delay', 'Routine cleaning',
          'Shift changeover', 'Lubrication required', 'Valve leak',
          'Power fluctuation', 'Safety stop triggered', 'Tool change',
        ]),
      });
    }
  }
  return logs;
}

// ---------------------------------------------------------------------------
// Generate and export
// ---------------------------------------------------------------------------
export const productionLogs = generateProductionLogs();
export const downtimeLogs = generateDowntimeLogs(productionLogs);

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Get machines for a given plant */
export function getMachinesByPlant(plantId) {
  return machines.filter((m) => m.plantId === plantId);
}

/** Get machines for a given line */
export function getMachinesByLine(lineId) {
  return machines.filter((m) => m.lineId === lineId);
}

/** Get machines for a given department */
export function getMachinesByDepartment(departmentId) {
  return machines.filter((m) => m.departmentId === departmentId);
}

/** Get lines for a given plant */
export function getLinesByPlant(plantId) {
  return lines.filter((l) => l.plantId === plantId);
}

/** Get departments for a given plant */
export function getDepartmentsByPlant(plantId) {
  return departments.filter((d) => d.plantId === plantId);
}

/** Filter production logs by criteria */
export function filterProductionLogs({ plantId, departmentId, lineId, machineId, dateFrom, dateTo, shiftId } = {}) {
  return productionLogs.filter((log) => {
    if (plantId && log.plantId !== plantId) return false;
    if (departmentId && log.departmentId !== departmentId) return false;
    if (lineId && log.lineId !== lineId) return false;
    if (machineId && log.machineId !== machineId) return false;
    if (shiftId && log.shiftId !== shiftId) return false;
    if (dateFrom && log.date < dateFrom) return false;
    if (dateTo && log.date > dateTo) return false;
    return true;
  });
}

/** Filter downtime logs by criteria */
export function filterDowntimeLogs({ plantId, lineId, machineId, dateFrom, dateTo } = {}) {
  return downtimeLogs.filter((log) => {
    if (plantId && log.plantId !== plantId) return false;
    if (lineId && log.lineId !== lineId) return false;
    if (machineId && log.machineId !== machineId) return false;
    if (dateFrom && log.date < dateFrom) return false;
    if (dateTo && log.date > dateTo) return false;
    return true;
  });
}

/** Get unique dates available in production logs */
export function getAvailableDates() {
  return [...new Set(productionLogs.map((l) => l.date))].sort();
}
