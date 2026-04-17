const API_BASE_URL = (import.meta.env.VITE_DASHBOARD_API_BASE_URL || '').replace(/\/$/, '');

// Demo mapping until plant/line/machine GUIDs are provided from the real master data service.
const TENANT_ID_BY_PLANT = {
  DEN: '11111111-1111-1111-1111-111111111111',
  ATL: '11111111-1111-1111-1111-111111111111',
  CHI: '11111111-1111-1111-1111-111111111111',
  HOU: '11111111-1111-1111-1111-111111111111',
};

function toRatio(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.abs(value) > 1 ? value / 100 : value;
}

function toTrendPercent(value) {
  if (!Number.isFinite(value) || value === 0) return undefined;
  return Math.abs(value) > 1 ? value : value * 100;
}

function shortMachineLabel(machineId) {
  if (!machineId) return 'Unknown asset';
  return `Asset ${machineId.slice(-4)}`;
}

export function getTenantIdForPlant(plantId) {
  return TENANT_ID_BY_PLANT[plantId] || TENANT_ID_BY_PLANT.DEN;
}

export async function fetchDashboardSnapshot({ plantId, days = 30, signal }) {
  const tenantId = getTenantIdForPlant(plantId);
  const params = new URLSearchParams({ tenantId, days: String(days) });
  const response = await fetch(`${API_BASE_URL}/api/dashboard?${params.toString()}`, { signal });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Dashboard API request failed');
  }

  const payload = await response.json();

  const summary = payload.summary || {};
  const cards = payload.summary_cards || {};

  const transformedTrends = (payload.trends || []).map((item, index) => ({
    label: item.date || `Point ${index + 1}`,
    date: item.date,
    oee: toRatio(item.oee),
    availability: toRatio(item.availability),
    performance: toRatio(item.performance),
    quality: toRatio(item.quality),
  }));

  const top5 = (payload.top_5_machines || []).map((item) => ({
    id: item.machine_id,
    name: shortMachineLabel(item.machine_id),
    type: 'Live asset',
    oee: toRatio(item.oee_pct),
    totalOutput: cards.total_output || 0,
  }));

  const bottom5 = (payload.bottom_5_machines || []).map((item) => ({
    id: item.machine_id,
    name: shortMachineLabel(item.machine_id),
    type: 'Live asset',
    oee: toRatio(item.oee_pct),
    totalOutput: cards.total_output || 0,
  }));

  const uniqueMachines = [...top5, ...bottom5]
    .filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index)
    .sort((a, b) => b.oee - a.oee);

  const heatmapRows = payload.efficiency_heatmap || [];
  const machineLabels = [...new Set(heatmapRows.map((row) => shortMachineLabel(row.machine_id)))];
  const shiftLabels = [...new Set(heatmapRows.map((row) => row.shift_id?.slice(-4) || 'Shift'))];
  const heatmapMatrix = machineLabels.map((machineLabel) =>
    shiftLabels.map((shiftLabel) => {
      const match = heatmapRows.find(
        (row) => shortMachineLabel(row.machine_id) === machineLabel && (row.shift_id?.slice(-4) || 'Shift') === shiftLabel,
      );
      return match ? toRatio(match.oee_pct) : 0;
    }),
  );

  const throughput = Number.isFinite(summary.throughput) ? summary.throughput : 0;
  const totalOutput = Number.isFinite(cards.total_output) ? cards.total_output : 0;
  const totalCost = Number.isFinite(cards.total_cost) ? cards.total_cost : 0;

  return {
    source: 'live',
    raw: payload,
    meta: {
      refreshedAt: new Date().toISOString(),
      debugMessage: payload.debug?.message,
      totalRows: payload.debug?.total_rows,
      dailyRows: payload.debug?.daily_rows,
    },
    plantKPIs: {
      oee: toRatio(summary.oee),
      availability: toRatio(summary.availability),
      performance: toRatio(summary.performance),
      quality: toRatio(summary.quality),
      throughput,
      costPerUnit: totalOutput > 0 ? totalCost / totalOutput : 0,
      laborEfficiency: toRatio(summary.utilization),
      mtbf: Number.isFinite(summary.mtbf_minutes) ? summary.mtbf_minutes : 0,
      mttr: Number.isFinite(summary.mttr_minutes) ? summary.mttr_minutes : 0,
      overallScore: toRatio(summary.oee),
    },
    prevKPIs: {
      oee: toTrendPercent(summary.oee_delta),
      availability: toTrendPercent(summary.availability_delta),
      performance: toTrendPercent(summary.performance_delta),
      quality: toTrendPercent(summary.quality_delta),
    },
    dailyTrends: transformedTrends,
    machineComparison: uniqueMachines,
    top5,
    bottom5,
    downtimeBreakdown: (payload.downtime_breakdown || []).map((item) => ({
      name: item.category,
      value: Number.isFinite(item.minutes) ? item.minutes : 0,
    })),
    heatmapData: {
      data: heatmapMatrix,
      xLabels: shiftLabels,
      yLabels: machineLabels,
    },
    totalAgg: {
      totalCount: totalOutput,
      goodCount: Number.isFinite(cards.good_units) ? cards.good_units : 0,
      downtime: (Number.isFinite(cards.total_downtime_hours) ? cards.total_downtime_hours : 0) * 60,
      totalCost,
    },
    machineCount: Number.isFinite(cards.total_machines) ? cards.total_machines : uniqueMachines.length,
    insights: {
      rejectionRate: toRatio(summary.rejection_rate_pct),
      utilization: toRatio(summary.utilization),
    },
  };
}
