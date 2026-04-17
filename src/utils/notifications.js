/**
 * EIT™ Notification Generator
 * ============================
 * Derives factory alerts from existing mock data — KPI breaches,
 * unplanned downtime, chronic low performance, and maintenance events.
 */

import {
  filterProductionLogs, filterDowntimeLogs,
  machines, getAvailableDates,
} from '../data/mock';
import {
  aggregateProductionData, computeAllKPIs, getKPIStatus,
  aggregateFailureMetrics,
} from '../engine/kpi';
import { pct } from './format';

function machineName(machineId) {
  return machines.find((m) => m.id === machineId)?.name || machineId;
}

function machineLineId(machineId) {
  return machines.find((m) => m.id === machineId)?.lineId || '';
}

/**
 * Generate a deterministic list of notifications for a given plant.
 * @param {string} plantId
 * @param {object} kpiThresholds - from AppContext (same shape as KPI_THRESHOLDS)
 * @returns {Array<object>}
 */
export function generateNotifications(plantId, kpiThresholds) {
  const notifications = [];
  const dates = getAvailableDates();
  if (dates.length === 0) return notifications;

  const latestDate = dates[dates.length - 1];
  const daysBack = (n) => {
    const d = new Date(latestDate + 'T00:00:00');
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  };

  const plantMachines = machines.filter((m) => m.plantId === plantId);

  // -------------------------------------------------------------------
  // A) KPI Threshold Breaches — last 7 days, per machine per day
  // -------------------------------------------------------------------
  const kpiDateFrom = daysBack(7);
  const kpiLogs = filterProductionLogs({ plantId, dateFrom: kpiDateFrom });
  const kpiDtLogs = filterDowntimeLogs({ plantId, dateFrom: kpiDateFrom });

  // Group production logs by machineId + date
  const kpiGroups = new Map();
  for (const log of kpiLogs) {
    const key = `${log.machineId}|${log.date}`;
    if (!kpiGroups.has(key)) kpiGroups.set(key, []);
    kpiGroups.get(key).push(log);
  }

  // Group downtime logs by machineId + date for failure metrics
  const dtGroups = new Map();
  for (const log of kpiDtLogs) {
    const key = `${log.machineId}|${log.date}`;
    if (!dtGroups.has(key)) dtGroups.set(key, []);
    dtGroups.get(key).push(log);
  }

  for (const [key, logs] of kpiGroups) {
    const [mId, date] = key.split('|');
    const machine = machines.find((m) => m.id === mId);
    if (!machine) continue;

    const data = aggregateProductionData(logs);
    const failureMetrics = aggregateFailureMetrics(dtGroups.get(key) || []);
    const kpis = computeAllKPIs(data, machine.designSpeed || 12000, undefined, failureMetrics);

    const checks = [
      { metric: 'oee',          label: 'OEE',          val: kpis.oee,          thresh: kpiThresholds?.oee },
      { metric: 'availability', label: 'Availability',  val: kpis.availability, thresh: kpiThresholds?.availability },
      { metric: 'performance',  label: 'Performance',   val: kpis.performance,  thresh: kpiThresholds?.performance },
      { metric: 'quality',      label: 'Quality',       val: kpis.quality,      thresh: kpiThresholds?.quality },
    ];

    for (const { metric, label, val, thresh } of checks) {
      if (!thresh) continue;
      const status = getKPIStatus(val, thresh);
      if (status === 'good') continue;

      notifications.push({
        id: `KPI-${mId}-${metric}-${date}`,
        type: status, // 'critical' or 'warning'
        category: 'kpi_breach',
        title: `${label} ${status === 'critical' ? 'Critical' : 'Warning'}: ${machine.name}`,
        message: `${label} dropped to ${pct(val)} on ${date}, below the ${pct(thresh.warning)} threshold.`,
        machineId: mId,
        machineName: machine.name,
        plantId,
        lineId: machine.lineId,
        date,
        timestamp: new Date(date + 'T12:00:00').getTime(),
      });
    }
  }

  // -------------------------------------------------------------------
  // B) Downtime Alerts — unplanned failures ≥30 min, last 7 days
  // -------------------------------------------------------------------
  const downtimeLogs = filterDowntimeLogs({ plantId, dateFrom: kpiDateFrom });

  for (const dt of downtimeLogs) {
    if (!dt.isFailure) continue;
    if (dt.duration < 30) continue;

    const type = dt.duration >= 60 ? 'critical' : 'warning';
    notifications.push({
      id: `DT-${dt.id}`,
      type,
      category: 'downtime',
      title: `Unplanned Downtime: ${machineName(dt.machineId)}`,
      message: `${dt.reason} — ${dt.duration} min ${dt.category} on ${dt.date} (shift ${dt.shiftId}).`,
      machineId: dt.machineId,
      machineName: machineName(dt.machineId),
      plantId,
      lineId: machineLineId(dt.machineId),
      date: dt.date,
      timestamp: new Date(dt.date + 'T08:00:00').getTime(),
    });
  }

  // -------------------------------------------------------------------
  // C) Chronic Low Performance — last 14 days aggregate per machine
  // -------------------------------------------------------------------
  const perfDateFrom = daysBack(14);

  for (const machine of plantMachines) {
    const mLogs = filterProductionLogs({ plantId, machineId: machine.id, dateFrom: perfDateFrom });
    if (mLogs.length < 5) continue; // need enough data

    const data = aggregateProductionData(mLogs);
    const kpis = computeAllKPIs(data, machine.designSpeed || 12000);
    const oeeThresh = kpiThresholds?.oee;
    if (!oeeThresh) continue;

    const status = getKPIStatus(kpis.oee, oeeThresh);
    if (status === 'good') continue;

    // Find latest date in the window for this machine
    const latestMachineDate = mLogs.reduce((max, l) => l.date > max ? l.date : max, mLogs[0].date);

    notifications.push({
      id: `PERF-${machine.id}-14d`,
      type: 'warning',
      category: 'performance',
      title: `Consistently Low OEE: ${machine.name}`,
      message: `14-day average OEE is ${pct(kpis.oee)}, which is below the ${pct(oeeThresh.warning)} warning threshold.`,
      machineId: machine.id,
      machineName: machine.name,
      plantId,
      lineId: machine.lineId,
      date: latestMachineDate,
      timestamp: new Date(latestMachineDate + 'T06:00:00').getTime(),
    });
  }

  // -------------------------------------------------------------------
  // D) Maintenance Reminders — planned maintenance, last 3 days
  // -------------------------------------------------------------------
  const maintDateFrom = daysBack(3);
  const maintLogs = filterDowntimeLogs({ plantId, dateFrom: maintDateFrom });

  for (const dt of maintLogs) {
    if (dt.category !== 'Planned Maintenance') continue;

    notifications.push({
      id: `MAINT-${dt.id}`,
      type: 'info',
      category: 'maintenance',
      title: `Scheduled Maintenance: ${machineName(dt.machineId)}`,
      message: `${dt.reason} — ${dt.duration} min planned maintenance on ${dt.date}.`,
      machineId: dt.machineId,
      machineName: machineName(dt.machineId),
      plantId,
      lineId: machineLineId(dt.machineId),
      date: dt.date,
      timestamp: new Date(dt.date + 'T10:00:00').getTime(),
    });
  }

  // Sort by recency (most recent first) and cap
  notifications.sort((a, b) => b.timestamp - a.timestamp);
  return notifications.slice(0, 100);
}
