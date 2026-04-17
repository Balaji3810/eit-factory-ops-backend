/**
 * EIT™ Configuration Defaults
 * ============================
 * KPI thresholds, scoring weights, and system defaults.
 * These are the initial values — the Admin module lets users override them at runtime.
 */

/** KPI status thresholds (ratio 0–1 unless noted) */
export const KPI_THRESHOLDS = {
  oee:              { good: 0.85, warning: 0.65 },
  availability:     { good: 0.90, warning: 0.75 },
  performance:      { good: 0.90, warning: 0.75 },
  quality:          { good: 0.95, warning: 0.85 },
  laborEfficiency:  { good: 0.90, warning: 0.75 },
  productivity:     { good: 0.90, warning: 0.75 },
  downtimePercent:  { good: 0.05, warning: 0.15 },  // inverted: lower is better
  overallScore:     { good: 0.80, warning: 0.60 },
  mtbf:             { good: 480, warning: 240 },     // minutes — higher is better
  mttr:             { good: 30,  warning: 60 },       // minutes — lower is better (inverted)
};

/** Scoring weights (must sum to 1.0) */
export const SCORING_WEIGHTS = {
  oee: 0.30,
  availability: 0.15,
  performance: 0.15,
  quality: 0.15,
  throughputNorm: 0.10,
  costEfficiency: 0.10,
  laborEfficiency: 0.05,
};

/** Shift definitions */
export const SHIFTS = [
  { id: 'S1', name: 'Morning',   start: '06:00', end: '14:00', hours: 8 },
  { id: 'S2', name: 'Afternoon', start: '14:00', end: '22:00', hours: 8 },
  { id: 'S3', name: 'Night',     start: '22:00', end: '06:00', hours: 8 },
];

/** Downtime reason categories */
export const DOWNTIME_CATEGORIES = [
  'Mechanical Failure',
  'Electrical Fault',
  'Changeover',
  'Quality Hold',
  'Material Shortage',
  'Planned Maintenance',
  'Operator Break',
  'Calibration',
  'Cleaning',
  'Other',
];

/**
 * Failure categories — unplanned breakdowns that count toward MTBF/MTTR.
 * Planned stops (changeover, maintenance, breaks, calibration, cleaning) are excluded.
 */
export const FAILURE_CATEGORIES = [
  'Mechanical Failure',
  'Electrical Fault',
  'Quality Hold',
  'Material Shortage',
  'Other',
];

/** Planned stop categories — excluded from MTBF/MTTR */
export const PLANNED_STOP_CATEGORIES = [
  'Changeover',
  'Planned Maintenance',
  'Operator Break',
  'Calibration',
  'Cleaning',
];

/** Chart colour palette */
export const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];
