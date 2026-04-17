/**
 * EIT™ Ticket Data Layer
 * =======================
 * Mock ticket data for factory work orders, maintenance requests,
 * quality issues, and safety incidents. Provides CRUD operations
 * on an in-memory array.
 */

import { machines, downtimeLogs } from './mock';
import { DOWNTIME_CATEGORIES } from './config';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const TICKET_TYPES = ['Maintenance', 'Quality', 'Safety', 'Operational'];
export const TICKET_PRIORITIES = ['critical', 'high', 'medium', 'low'];
export const TICKET_STATUSES = ['open', 'in_progress', 'on_hold', 'resolved', 'closed'];

export const ASSIGNEES = [
  'John Smith', 'Maria Garcia', 'James Wilson', 'Sarah Chen',
  'Robert Taylor', 'Emily Johnson', 'David Kim', 'Lisa Anderson',
];

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  resolved: 'Resolved',
  closed: 'Closed',
};

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

// ---------------------------------------------------------------------------
// Seeded RNG (independent from mock.js)
// ---------------------------------------------------------------------------
function createRNG(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const rand = createRNG(7777);
const randBetween = (min, max) => min + rand() * (max - min);
const randInt = (min, max) => Math.floor(randBetween(min, max + 1));
const pick = (arr) => arr[randInt(0, arr.length - 1)];

// ---------------------------------------------------------------------------
// Title templates by type
// ---------------------------------------------------------------------------
const TITLES = {
  Maintenance: [
    'Belt replacement required', 'Bearing overheating detected', 'Lubrication schedule overdue',
    'Motor vibration abnormal', 'Hydraulic leak on cylinder', 'Filter replacement needed',
    'Gearbox noise investigation', 'Conveyor alignment adjustment', 'Pneumatic valve sticking',
    'Electrical panel inspection', 'PLC firmware update needed', 'Sensor calibration drift',
  ],
  Quality: [
    'Dimensional variance detected', 'Surface finish out of spec', 'Material contamination suspected',
    'Batch rejection rate elevated', 'Color deviation in output', 'Packaging seal integrity issue',
    'Weight inconsistency flagged', 'Labeling misalignment', 'Temperature drift in process',
  ],
  Safety: [
    'Guard interlock bypass detected', 'Emergency stop malfunction', 'Slip hazard near station',
    'PPE compliance check required', 'Noise level exceeds threshold', 'Chemical spill containment',
    'Fire suppression inspection due', 'Ergonomic assessment needed',
  ],
  Operational: [
    'Changeover time optimization', 'Shift handover procedure update', 'Material supply delay',
    'Production scheduling conflict', 'Inventory discrepancy found', 'Energy consumption spike',
    'Waste reduction initiative', 'Training documentation update',
  ],
};

const DESCRIPTIONS = [
  'Issue identified during routine inspection. Requires immediate attention to prevent further degradation.',
  'Reported by operator during shift changeover. Equipment showing signs of wear beyond acceptable limits.',
  'Automated monitoring system triggered alert. Performance metrics indicate potential failure risk.',
  'Follow-up from previous maintenance cycle. Original repair may not have addressed root cause.',
  'Quality control check revealed deviation from standard operating parameters.',
  'Preventive action required based on manufacturer recommended maintenance schedule.',
  'Recurring issue that needs thorough investigation and permanent corrective action.',
  'Observed during production run. Temporary workaround in place but permanent fix needed.',
];

// ---------------------------------------------------------------------------
// Generate mock tickets
// ---------------------------------------------------------------------------
let nextId = 1;

function generateTickets() {
  const tickets = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Generate from downtime logs (failure events → tickets)
  const failureLogs = downtimeLogs.filter((d) => d.isFailure && d.duration >= 20);
  const selectedLogs = failureLogs.filter(() => rand() < 0.12).slice(0, 35);

  for (const dt of selectedLogs) {
    const machine = machines.find((m) => m.id === dt.machineId);
    if (!machine) continue;

    const type = dt.category === 'Quality Hold' ? 'Quality'
      : dt.category === 'Material Shortage' ? 'Operational'
      : 'Maintenance';

    const daysAgo = Math.round((today - new Date(dt.date + 'T00:00:00')) / 86400000);
    const createdDate = new Date(dt.date + 'T00:00:00');
    createdDate.setHours(randInt(6, 20), randInt(0, 59));

    const status = daysAgo > 10 ? pick(['resolved', 'closed'])
      : daysAgo > 5 ? pick(['in_progress', 'resolved', 'on_hold', 'closed'])
      : daysAgo > 2 ? pick(['open', 'in_progress', 'on_hold'])
      : pick(['open', 'open', 'in_progress']);

    const priority = dt.duration >= 90 ? 'critical'
      : dt.duration >= 50 ? 'high'
      : dt.duration >= 25 ? 'medium'
      : 'low';

    const dueDate = new Date(createdDate);
    dueDate.setDate(dueDate.getDate() + (priority === 'critical' ? 1 : priority === 'high' ? 3 : priority === 'medium' ? 7 : 14));

    const resolvedAt = (status === 'resolved' || status === 'closed')
      ? (() => { const r = new Date(createdDate); r.setHours(r.getHours() + randInt(2, 72)); return r.toISOString(); })()
      : null;

    const updatedDate = resolvedAt ? new Date(resolvedAt)
      : new Date(createdDate.getTime() + randInt(1, 48) * 3600000);

    const estHours = priority === 'critical' ? randBetween(4, 12)
      : priority === 'high' ? randBetween(2, 8)
      : randBetween(1, 4);

    tickets.push({
      id: `TKT-${String(nextId++).padStart(4, '0')}`,
      title: `${dt.reason} — ${machine.name}`,
      description: pick(DESCRIPTIONS),
      type,
      category: dt.category,
      priority,
      status,
      plantId: machine.plantId,
      lineId: machine.lineId,
      machineId: machine.id,
      assignee: pick(ASSIGNEES),
      reporter: 'System',
      createdAt: createdDate.toISOString(),
      updatedAt: updatedDate.toISOString(),
      dueDate: dueDate.toISOString().split('T')[0],
      resolvedAt,
      estimatedHours: Math.round(estHours * 10) / 10,
      actualHours: resolvedAt ? Math.round(randBetween(estHours * 0.5, estHours * 1.5) * 10) / 10 : null,
      notes: '',
    });
  }

  // Generate additional manual tickets
  const manualCount = 25;
  for (let i = 0; i < manualCount; i++) {
    const type = pick(TICKET_TYPES);
    const machine = pick(machines);
    const daysAgo = randInt(0, 25);
    const createdDate = new Date(today);
    createdDate.setDate(createdDate.getDate() - daysAgo);
    createdDate.setHours(randInt(6, 20), randInt(0, 59));

    const priority = pick(TICKET_PRIORITIES);
    const status = daysAgo > 12 ? pick(['resolved', 'closed'])
      : daysAgo > 6 ? pick(['in_progress', 'resolved', 'on_hold', 'closed'])
      : daysAgo > 2 ? pick(['open', 'in_progress', 'on_hold'])
      : pick(['open', 'open', 'in_progress']);

    const dueDate = new Date(createdDate);
    dueDate.setDate(dueDate.getDate() + (priority === 'critical' ? 1 : priority === 'high' ? 3 : priority === 'medium' ? 7 : 14));

    const resolvedAt = (status === 'resolved' || status === 'closed')
      ? (() => { const r = new Date(createdDate); r.setHours(r.getHours() + randInt(2, 72)); return r.toISOString(); })()
      : null;

    const updatedDate = resolvedAt ? new Date(resolvedAt)
      : new Date(createdDate.getTime() + randInt(1, 48) * 3600000);

    const estHours = randBetween(1, 8);

    tickets.push({
      id: `TKT-${String(nextId++).padStart(4, '0')}`,
      title: pick(TITLES[type]),
      description: pick(DESCRIPTIONS),
      type,
      category: pick(DOWNTIME_CATEGORIES),
      priority,
      status,
      plantId: machine.plantId,
      lineId: machine.lineId,
      machineId: machine.id,
      assignee: pick(ASSIGNEES),
      reporter: 'Operator',
      createdAt: createdDate.toISOString(),
      updatedAt: updatedDate.toISOString(),
      dueDate: dueDate.toISOString().split('T')[0],
      resolvedAt,
      estimatedHours: Math.round(estHours * 10) / 10,
      actualHours: resolvedAt ? Math.round(randBetween(estHours * 0.5, estHours * 1.5) * 10) / 10 : null,
      notes: '',
    });
  }

  // Sort by createdAt descending
  tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return tickets;
}

// ---------------------------------------------------------------------------
// In-memory ticket store + CRUD
// ---------------------------------------------------------------------------
let ticketStore = generateTickets();

export function getTickets() {
  return ticketStore;
}

export function getTicketById(id) {
  return ticketStore.find((t) => t.id === id) || null;
}

export function addTicket(data) {
  const ticket = {
    ...data,
    id: `TKT-${String(nextId++).padStart(4, '0')}`,
    reporter: 'Operator',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    actualHours: null,
    notes: data.notes || '',
    status: 'open',
  };
  ticketStore = [ticket, ...ticketStore];
  return ticket;
}

export function updateTicket(id, changes) {
  ticketStore = ticketStore.map((t) => {
    if (t.id !== id) return t;
    const updated = { ...t, ...changes, updatedAt: new Date().toISOString() };
    if (changes.status === 'resolved' && !t.resolvedAt) {
      updated.resolvedAt = new Date().toISOString();
    }
    return updated;
  });
  return ticketStore.find((t) => t.id === id);
}

export function deleteTicket(id) {
  ticketStore = ticketStore.filter((t) => t.id !== id);
}

export function getOpenTicketCount(plantId) {
  return ticketStore.filter((t) =>
    (!plantId || t.plantId === plantId) &&
    (t.status === 'open' || t.status === 'in_progress'),
  ).length;
}
