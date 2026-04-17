/**
 * EIT™ KPI Calculation Engine
 * ===========================
 * Central module for all manufacturing KPI computations.
 * All functions are pure, handle edge cases (division by zero),
 * and return numeric values (not formatted strings).
 *
 * Formulas follow industry-standard OEE and lean manufacturing definitions.
 */

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Safe division — returns fallback when denominator is zero or non-finite.
 */
export function safeDivide(numerator, denominator, fallback = 0) {
  if (!denominator || !isFinite(denominator) || denominator === 0) return fallback;
  const result = numerator / denominator;
  return isFinite(result) ? result : fallback;
}

// ---------------------------------------------------------------------------
// Core KPI Functions
// ---------------------------------------------------------------------------

/**
 * 1. OEE (Overall Equipment Effectiveness)
 *    OEE = Availability × Performance × Quality
 */
export function calcOEE(availability, performance, quality) {
  return availability * performance * quality;
}

/**
 * 2. Availability = Operating Time / Planned Production Time
 *    Capped at 1.0 (100%)
 * @param {number} operatingTime - minutes of actual operation
 * @param {number} plannedTime - minutes of planned production
 */
export function calcAvailability(operatingTime, plannedTime) {
  return Math.min(safeDivide(operatingTime, plannedTime), 1);
}

/**
 * 3. Performance = (Ideal Cycle Time × Total Count) / Operating Time
 *    Capped at 1.0 (100%)
 * @param {number} idealCycleTime - ideal time per unit (minutes)
 * @param {number} totalCount - total units produced
 * @param {number} operatingTime - actual operating time (minutes)
 */
export function calcPerformance(idealCycleTime, totalCount, operatingTime) {
  return Math.min(safeDivide(idealCycleTime * totalCount, operatingTime), 1);
}

/**
 * 4. Quality = Good Count / Total Count
 *    Capped at 1.0 (100%)
 */
export function calcQuality(goodCount, totalCount) {
  return Math.min(safeDivide(goodCount, totalCount), 1);
}

/**
 * 5. Downtime % = Downtime / Planned Production Time
 */
export function calcDowntimePercent(downtime, plannedTime) {
  return safeDivide(downtime, plannedTime);
}

/**
 * 6. Throughput = Total Units / Time (returns units per hour)
 * @param {number} totalUnits
 * @param {number} timeHours - elapsed time in hours
 */
export function calcThroughput(totalUnits, timeHours) {
  return safeDivide(totalUnits, timeHours);
}

/**
 * 7. Cost Per Unit = Total Cost / Total Units
 */
export function calcCostPerUnit(totalCost, totalUnits) {
  return safeDivide(totalCost, totalUnits);
}

/**
 * 8. Labor Efficiency = Actual Output / Standard Output
 */
export function calcLaborEfficiency(actualOutput, standardOutput) {
  return safeDivide(actualOutput, standardOutput);
}

/**
 * 9. Productivity Rate = Output / Input
 */
export function calcProductivity(output, input) {
  return safeDivide(output, input);
}

/**
 * 10. MTBF (Mean Time Between Failures)
 *     MTBF = Total Operating Time / Number of Unplanned Failures
 *     Returns minutes. Higher is better.
 * @param {number} operatingTime - total operating time in minutes
 * @param {number} failureCount - number of unplanned failure events
 */
export function calcMTBF(operatingTime, failureCount) {
  return safeDivide(operatingTime, failureCount);
}

/**
 * 11. MTTR (Mean Time To Repair)
 *     MTTR = Total Repair Time / Number of Unplanned Failures
 *     Returns minutes. Lower is better.
 * @param {number} totalRepairTime - cumulative repair duration in minutes
 * @param {number} failureCount - number of unplanned failure events
 */
export function calcMTTR(totalRepairTime, failureCount) {
  return safeDivide(totalRepairTime, failureCount);
}

/**
 * 12. Overall Efficiency Score — weighted composite (configurable weights)
 *     Each metric value should be a ratio (0–1). The function normalises
 *     the total weight so partial metric sets still return a meaningful score.
 */
export const DEFAULT_WEIGHTS = {
  oee: 0.30,
  availability: 0.15,
  performance: 0.15,
  quality: 0.15,
  throughputNorm: 0.10,
  costEfficiency: 0.10,
  laborEfficiency: 0.05,
};

export function calcOverallScore(metrics, weights = DEFAULT_WEIGHTS) {
  let score = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const val = metrics[key];
    if (val !== undefined && isFinite(val)) {
      score += val * weight;
      totalWeight += weight;
    }
  }
  return totalWeight > 0 ? score / totalWeight : 0;
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

/**
 * Aggregate failure metrics from downtime logs.
 * Only counts records where isFailure === true (unplanned breakdowns).
 * @param {Array} downtimeLogs - filtered downtime log records
 * @returns {{ failureCount: number, totalRepairTime: number }}
 */
export function aggregateFailureMetrics(downtimeLogs) {
  if (!downtimeLogs || downtimeLogs.length === 0) {
    return { failureCount: 0, totalRepairTime: 0 };
  }
  const failures = downtimeLogs.filter((d) => d.isFailure);
  return {
    failureCount: failures.length,
    totalRepairTime: failures.reduce((sum, d) => sum + (d.duration || 0), 0),
  };
}

/**
 * Aggregate an array of production-log records into summed totals.
 * The weighted average idealCycleTime is computed so OEE stays accurate.
 */
export function aggregateProductionData(logs) {
  if (!logs || logs.length === 0) {
    return {
      plannedTime: 0, operatingTime: 0, totalCount: 0, goodCount: 0,
      downtime: 0, totalCost: 0, laborHours: 0,
      standardOutput: 0, actualOutput: 0, idealCycleTime: 0,
    };
  }

  const totals = logs.reduce(
    (acc, log) => ({
      plannedTime: acc.plannedTime + (log.plannedProductionTime || 0),
      operatingTime: acc.operatingTime + (log.operatingTime || 0),
      totalCount: acc.totalCount + (log.totalCount || 0),
      goodCount: acc.goodCount + (log.goodCount || 0),
      downtime: acc.downtime + (log.downtime || 0),
      totalCost: acc.totalCost + (log.totalCost || 0),
      laborHours: acc.laborHours + (log.laborHours || 0),
      standardOutput: acc.standardOutput + (log.standardOutput || 0),
      actualOutput: acc.actualOutput + (log.actualOutput || 0),
    }),
    {
      plannedTime: 0, operatingTime: 0, totalCount: 0, goodCount: 0,
      downtime: 0, totalCost: 0, laborHours: 0, standardOutput: 0, actualOutput: 0,
    },
  );

  // Weighted average ideal cycle time
  const weightedCycleTime = logs.reduce(
    (sum, log) => sum + (log.idealCycleTime || 0) * (log.totalCount || 0),
    0,
  );
  totals.idealCycleTime = safeDivide(weightedCycleTime, totals.totalCount);

  return totals;
}

/**
 * Compute every KPI from aggregated data.
 * Returns an object with all 12 KPIs + sub-components.
 *
 * @param {object} data - output of aggregateProductionData()
 * @param {number} [designCapacity=12000] - units/hr design capacity (for throughput normalisation)
 * @param {object} [weights] - custom scoring weights
 * @param {object} [failureMetrics] - optional { failureCount, totalRepairTime } from aggregateFailureMetrics()
 */
export function computeAllKPIs(data, designCapacity = 12000, weights = DEFAULT_WEIGHTS, failureMetrics) {
  const availability = calcAvailability(data.operatingTime, data.plannedTime);
  const performance = calcPerformance(data.idealCycleTime, data.totalCount, data.operatingTime);
  const quality = calcQuality(data.goodCount, data.totalCount);
  const oee = calcOEE(availability, performance, quality);
  const downtimePercent = calcDowntimePercent(data.downtime, data.plannedTime);
  const throughput = calcThroughput(data.totalCount, data.operatingTime / 60); // per hour
  const costPerUnit = calcCostPerUnit(data.totalCost, data.totalCount);
  const laborEfficiency = calcLaborEfficiency(data.actualOutput, data.standardOutput);
  const productivity = calcProductivity(data.actualOutput, data.standardOutput);

  // MTBF & MTTR — only if failure metrics provided
  const mtbf = failureMetrics ? calcMTBF(data.operatingTime, failureMetrics.failureCount) : 0;
  const mttr = failureMetrics ? calcMTTR(failureMetrics.totalRepairTime, failureMetrics.failureCount) : 0;

  // Normalised metrics for composite scoring
  const throughputNorm = Math.min(safeDivide(throughput, designCapacity), 1);
  const costEfficiency = Math.max(0, Math.min(1, 1 - costPerUnit / 0.5)); // $0.50 baseline

  const overallScore = calcOverallScore(
    { oee, availability, performance, quality, throughputNorm, costEfficiency, laborEfficiency },
    weights,
  );

  return {
    availability,
    performance,
    quality,
    oee,
    downtimePercent,
    throughput,
    costPerUnit,
    laborEfficiency,
    productivity,
    overallScore,
    mtbf,
    mttr,
  };
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

/**
 * Map a KPI value (0–1 ratio) to a status tier.
 */
export function getKPIStatus(value, thresholds = { good: 0.85, warning: 0.70 }) {
  if (value >= thresholds.good) return 'good';
  if (value >= thresholds.warning) return 'warning';
  return 'critical';
}

/**
 * Status for inverted KPIs where lower is better (e.g. MTTR, Downtime%).
 */
export function getKPIStatusInverted(value, thresholds = { good: 30, warning: 60 }) {
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.warning) return 'warning';
  return 'critical';
}

/**
 * Return a CSS-friendly colour string for a status tier.
 */
export function getStatusColor(status) {
  switch (status) {
    case 'good': return 'var(--accent-green)';
    case 'warning': return 'var(--accent-yellow)';
    case 'critical': return 'var(--accent-red)';
    default: return 'var(--text-secondary)';
  }
}
