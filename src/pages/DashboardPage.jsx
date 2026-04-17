/**
 * EIT™ Executive Dashboard
 * =========================
 * Integrated live dashboard experience:
 * - Uses the existing EIT shell / design system
 * - Pulls live JSON from the PostgreSQL-backed .NET API when available
 * - Falls back to the original simulated KPI engine when the API is unavailable
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Zap, DollarSign,
  Users, Clock, CheckCircle2, Target, Timer, Wrench,
  Filter, ArrowUp, ArrowDown, Minus, Download,
  Radio, RefreshCw, DatabaseZap, AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  plants, machines, filterProductionLogs, filterDowntimeLogs,
  getAvailableDates, getMachinesByPlant,
  getLinesByPlant, getMachinesByLine,
} from '../data/mock';
import { SHIFTS } from '../data/config';
import {
  aggregateProductionData, aggregateFailureMetrics, computeAllKPIs, getKPIStatus,
} from '../engine/kpi';
import { pct, num, compact, currency, shortDate, duration } from '../utils/format';
import { toCSV, downloadCSV } from '../utils/csv';
import { RadialKPICard, Card, EmptyState, Skeleton } from '../components/Common';
import { OEEGauge, TrendChart, ComparisonBar, DonutChart, Heatmap } from '../components/Charts';
import { fetchDashboardSnapshot, getTenantIdForPlant } from '../services/dashboardApi';

function getHeroColor(val, thresh) {
  if (!thresh) return '#3b82f6';
  if (val >= thresh.good) return '#10b981';
  if (val >= thresh.warning) return '#f59e0b';
  return '#ef4444';
}

function trendDelta(current, previous) {
  if (!previous || previous === 0) return undefined;
  return ((current - previous) / previous) * 100;
}

function buildFallbackState({ logs, downtimeData, selectedPlantId, selectedLineId, selectedAssetId, period, dates, plantLines }) {
  const plantAgg = aggregateProductionData(logs);
  const failureMetrics = aggregateFailureMetrics(downtimeData);
  const plantKPIs = computeAllKPIs(plantAgg, undefined, undefined, failureMetrics);

  const days = parseInt(period, 10);
  const prevFrom = dates[Math.max(0, dates.length - days * 2)];
  const prevTo = dates[Math.max(0, dates.length - days - 1)];
  const prevFilter = { plantId: selectedPlantId, dateFrom: prevFrom, dateTo: prevTo };
  if (selectedAssetId) prevFilter.machineId = selectedAssetId;
  else if (selectedLineId) prevFilter.lineId = selectedLineId;

  const prevLogs = filterProductionLogs(prevFilter);
  const prevDowntime = filterDowntimeLogs(prevFilter);
  const prevKPIs = prevLogs.length
    ? computeAllKPIs(aggregateProductionData(prevLogs), undefined, undefined, aggregateFailureMetrics(prevDowntime))
    : null;

  const grouped = {};
  for (const log of logs) {
    if (!grouped[log.date]) grouped[log.date] = [];
    grouped[log.date].push(log);
  }

  const dailyTrends = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayLogs]) => {
      const agg = aggregateProductionData(dayLogs);
      const kpis = computeAllKPIs(agg);
      return {
        label: shortDate(new Date(`${date}T00:00:00`)),
        date,
        oee: kpis.oee,
        availability: kpis.availability,
        performance: kpis.performance,
        quality: kpis.quality,
      };
    });

  const scopeMachines = selectedAssetId
    ? machines.filter((m) => m.id === selectedAssetId)
    : selectedLineId
      ? getMachinesByLine(selectedLineId)
      : getMachinesByPlant(selectedPlantId);

  const machineComparison = scopeMachines
    .map((machine) => {
      const machineLogs = logs.filter((log) => log.machineId === machine.id);
      const agg = aggregateProductionData(machineLogs);
      const kpis = computeAllKPIs(agg, machine.designSpeed);
      return { ...machine, ...kpis, totalOutput: agg.totalCount };
    })
    .sort((a, b) => b.oee - a.oee);

  const top5 = machineComparison.slice(0, 5);
  const bottom5 = [...machineComparison].sort((a, b) => a.oee - b.oee).slice(0, 5);

  const downtimeBreakdown = Object.entries(
    downtimeData.reduce((acc, row) => {
      acc[row.category] = (acc[row.category] || 0) + row.duration;
      return acc;
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const heatMachines = scopeMachines.slice(0, 8);
  const heatmapData = {
    data: heatMachines.map((machine) =>
      SHIFTS.map((shift) => {
        const shiftLogs = logs.filter((log) => log.machineId === machine.id && log.shiftId === shift.id);
        if (!shiftLogs.length) return 0;
        return computeAllKPIs(aggregateProductionData(shiftLogs)).oee;
      }),
    ),
    xLabels: SHIFTS.map((shift) => shift.name),
    yLabels: heatMachines.map((machine) => machine.name),
  };

  return {
    source: 'simulated',
    meta: {
      refreshedAt: null,
      debugMessage: 'Simulated data engine',
      totalRows: logs.length,
      dailyRows: dailyTrends.length,
    },
    plantKPIs,
    prevKPIs,
    dailyTrends,
    machineComparison,
    top5,
    bottom5,
    downtimeBreakdown,
    heatmapData,
    totalAgg: plantAgg,
    machineCount: getMachinesByPlant(selectedPlantId).length,
    insights: {
      rejectionRate: plantAgg.totalCount > 0 ? 1 - (plantAgg.goodCount / plantAgg.totalCount) : 0,
      utilization: plantKPIs.availability,
    },
    scopeLabel: selectedAssetId
      ? machines.find((m) => m.id === selectedAssetId)?.name
      : selectedLineId
        ? plantLines.find((line) => line.id === selectedLineId)?.name
        : plants.find((plant) => plant.id === selectedPlantId)?.name,
  };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { selectedPlantId, kpiThresholds } = useApp();
  const dates = useMemo(() => getAvailableDates(), []);
  const [period, setPeriod] = useState('30');
  const [selectedLineId, setSelectedLineId] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [liveState, setLiveState] = useState({ loading: true, error: '', snapshot: null, refreshKey: 0 });

  const plantLines = useMemo(() => getLinesByPlant(selectedPlantId), [selectedPlantId]);
  const lineAssets = useMemo(
    () => (selectedLineId ? getMachinesByLine(selectedLineId) : getMachinesByPlant(selectedPlantId)),
    [selectedPlantId, selectedLineId],
  );

  useEffect(() => {
    setSelectedLineId('');
    setSelectedAssetId('');
  }, [selectedPlantId]);

  const dateRange = useMemo(() => {
    const days = parseInt(period, 10);
    const from = dates[Math.max(0, dates.length - days)];
    const to = dates[dates.length - 1];
    return { from, to };
  }, [period, dates]);

  const logFilter = useMemo(() => {
    const filter = { plantId: selectedPlantId, dateFrom: dateRange.from, dateTo: dateRange.to };
    if (selectedAssetId) filter.machineId = selectedAssetId;
    else if (selectedLineId) filter.lineId = selectedLineId;
    return filter;
  }, [selectedPlantId, selectedLineId, selectedAssetId, dateRange]);

  const logs = useMemo(() => filterProductionLogs(logFilter), [logFilter]);
  const downtimeData = useMemo(() => filterDowntimeLogs(logFilter), [logFilter]);

  const fallbackSnapshot = useMemo(
    () => buildFallbackState({ logs, downtimeData, selectedPlantId, selectedLineId, selectedAssetId, period, dates, plantLines }),
    [logs, downtimeData, selectedPlantId, selectedLineId, selectedAssetId, period, dates, plantLines],
  );

  useEffect(() => {
    const controller = new AbortController();
    const days = parseInt(period, 10);

    setLiveState((prev) => ({ ...prev, loading: true, error: '' }));

    fetchDashboardSnapshot({ plantId: selectedPlantId, days, signal: controller.signal })
      .then((snapshot) => {
        setLiveState({ loading: false, error: '', snapshot, refreshKey: 0 });
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setLiveState((prev) => ({
          ...prev,
          loading: false,
          error: error.message || 'Unable to load live dashboard data.',
          snapshot: null,
        }));
      });

    return () => controller.abort();
  }, [selectedPlantId, period, liveState.refreshKey]);

  const effectiveSnapshot = liveState.snapshot || fallbackSnapshot;
  const usingLiveData = Boolean(liveState.snapshot);

  const { plantKPIs, prevKPIs, dailyTrends, machineComparison, top5, bottom5, downtimeBreakdown, heatmapData, totalAgg, machineCount, insights } = effectiveSnapshot;

  const scopeLabel = usingLiveData
    ? `${plants.find((plant) => plant.id === selectedPlantId)?.name || 'Plant'} • Live View`
    : fallbackSnapshot.scopeLabel;

  const heroMetrics = [
    { key: 'availability', label: 'Availability', icon: Clock, val: plantKPIs.availability, thresh: kpiThresholds.availability },
    { key: 'performance', label: 'Performance', icon: Zap, val: plantKPIs.performance, thresh: kpiThresholds.performance },
    { key: 'quality', label: 'Quality', icon: CheckCircle2, val: plantKPIs.quality, thresh: kpiThresholds.quality },
  ];

  const trendValue = (key) => {
    if (usingLiveData) return prevKPIs?.[key];
    return trendDelta(plantKPIs[key], prevKPIs?.[key]);
  };

  const exportReport = () => {
    const sections = [];
    sections.push('KPI SUMMARY');
    sections.push(toCSV(
      [{
        oee: pct(plantKPIs.oee),
        availability: pct(plantKPIs.availability),
        performance: pct(plantKPIs.performance),
        quality: pct(plantKPIs.quality),
        throughput: num(Math.round(plantKPIs.throughput)),
        costPerUnit: currency(plantKPIs.costPerUnit, 3),
        laborEfficiency: pct(plantKPIs.laborEfficiency),
        mtbf: duration(plantKPIs.mtbf),
        mttr: duration(plantKPIs.mttr),
        overallScore: pct(plantKPIs.overallScore),
      }],
      ['oee', 'availability', 'performance', 'quality', 'throughput', 'costPerUnit', 'laborEfficiency', 'mtbf', 'mttr', 'overallScore'],
      { oee: 'OEE', availability: 'Availability', performance: 'Performance', quality: 'Quality', throughput: 'Throughput (units/hr)', costPerUnit: 'Cost/Unit', laborEfficiency: 'Labor Efficiency', mtbf: 'MTBF', mttr: 'MTTR', overallScore: 'Overall Score' },
    ));

    sections.push('');
    sections.push('MACHINE COMPARISON');
    sections.push(toCSV(
      machineComparison.map((machine) => ({
        name: machine.name,
        type: machine.type,
        oee: pct(machine.oee),
        totalOutput: num(machine.totalOutput || 0),
      })),
      ['name', 'type', 'oee', 'totalOutput'],
      { name: 'Machine', type: 'Type', oee: 'OEE', totalOutput: 'Total Output' },
    ));

    sections.push('');
    sections.push('DAILY TRENDS');
    sections.push(toCSV(
      dailyTrends.map((day) => ({
        date: day.date || day.label,
        oee: pct(day.oee),
        availability: pct(day.availability),
        performance: pct(day.performance),
        quality: pct(day.quality),
      })),
      ['date', 'oee', 'availability', 'performance', 'quality'],
      { date: 'Date', oee: 'OEE', availability: 'Availability', performance: 'Performance', quality: 'Quality' },
    ));

    sections.push('');
    sections.push('DOWNTIME BREAKDOWN');
    sections.push(toCSV(
      downtimeBreakdown.map((row) => ({ category: row.name, duration: `${row.value} min` })),
      ['category', 'duration'],
      { category: 'Category', duration: 'Duration' },
    ));

    downloadCSV(sections.join('\n'), `eit-dashboard-${selectedPlantId}-${period}d.csv`);
  };

  const refreshLiveData = () => {
    setLiveState((prev) => ({ ...prev, refreshKey: prev.refreshKey + 1 }));
  };

  const liveFiltersLocked = usingLiveData;
  const tenantId = getTenantIdForPlant(selectedPlantId);

  return (
    <div className="dashboard-page">
      <div className="dash-toolbar">
        <div className="dash-toolbar-left">
          <div className="dash-title-row">
            <h1 className="dash-title">{scopeLabel}</h1>
            <span className={`live-status-pill ${usingLiveData ? 'live' : 'fallback'}`}>
              {usingLiveData ? <Radio size={12} /> : <DatabaseZap size={12} />}
              {usingLiveData ? 'Live PostgreSQL feed' : 'Simulated fallback'}
            </span>
          </div>
          <span className="dash-subtitle">
            {usingLiveData
              ? `Tenant ${tenantId.slice(0, 8)}… • refreshed from the API`
              : 'Executive overview powered by the in-app simulator'}
          </span>
        </div>
        <div className="dash-toolbar-right">
          <div className="dash-filters">
            <Filter size={14} className="dash-filter-icon" />
            <select className="dash-select" value={selectedLineId} onChange={(e) => setSelectedLineId(e.target.value)} disabled={liveFiltersLocked}>
              <option value="">All Lines</option>
              {plantLines.map((line) => <option key={line.id} value={line.id}>{line.name}</option>)}
            </select>
            <select className="dash-select" value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)} disabled={liveFiltersLocked}>
              <option value="">All Assets</option>
              {lineAssets.map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}
            </select>
          </div>
          <div className="period-tabs">
            {[{ v: '7', l: '7D' }, { v: '14', l: '14D' }, { v: '30', l: '30D' }].map(({ v, l }) => (
              <button key={v} className={`period-tab ${period === v ? 'active' : ''}`} onClick={() => setPeriod(v)}>
                {l}
              </button>
            ))}
          </div>
          <button className="btn-secondary" onClick={refreshLiveData} disabled={liveState.loading}>
            <RefreshCw size={14} className={liveState.loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn-secondary" onClick={exportReport}>
            <Download size={14} /> Download
          </button>
        </div>
      </div>

      {usingLiveData && (
        <div className="integration-banner integration-banner-live">
          <Radio size={16} />
          <span>
            This view is now backed by the uploaded .NET API and PostgreSQL function. The app shell, navigation, cards, and charts remain native to the EIT design system.
          </span>
        </div>
      )}

      {!usingLiveData && liveState.error && (
        <div className="integration-banner integration-banner-warning">
          <AlertTriangle size={16} />
          <span>
            Live API unavailable: {liveState.error}. Showing the original simulated dashboard so the experience stays usable.
          </span>
        </div>
      )}

      {liveState.loading && !liveState.snapshot ? (
        <div className="dash-loading-grid">
          <Card title="Connecting to live dashboard">
            <Skeleton height={18} count={4} />
          </Card>
          <Card title="Loading trend series">
            <Skeleton height={220} />
          </Card>
        </div>
      ) : (
        <>
          <div className="dash-hero" onClick={() => navigate('/kpi-detail')}>
            <div className="dash-hero-gauge">
              <OEEGauge value={plantKPIs.oee} size={200} />
            </div>
            <div className="dash-hero-divider" />
            <div className="dash-hero-metrics">
              {heroMetrics.map((metric) => {
                const color = getHeroColor(metric.val, metric.thresh);
                const pctVal = Math.min(Math.max(metric.val, 0), 1);
                const size = 56;
                const stroke = 4;
                const radius = (size - stroke) / 2;
                const circumference = 2 * Math.PI * radius;
                const offset = circumference * (1 - pctVal);
                const trend = trendValue(metric.key);
                const dir = trend !== undefined ? (trend > 0 ? 'up' : trend < 0 ? 'down' : '') : '';
                return (
                  <div key={metric.key} className="dash-hero-metric">
                    <div className="hero-ring">
                      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-primary)" strokeWidth={stroke} />
                        <circle
                          cx={size / 2}
                          cy={size / 2}
                          r={radius}
                          fill="none"
                          stroke={color}
                          strokeWidth={stroke}
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={offset}
                          transform={`rotate(-90 ${size / 2} ${size / 2})`}
                          style={{ filter: `drop-shadow(0 0 4px ${color}40)`, transition: 'stroke-dashoffset 0.6s ease' }}
                        />
                      </svg>
                      <span className="hero-ring-val" style={{ color }}>{pct(metric.val)}</span>
                    </div>
                    <span className="hero-metric-title">{metric.label}</span>
                    {trend !== undefined && (
                      <span className={`kpi-trend ${dir}`}>
                        {trend > 0 ? <ArrowUp size={10} /> : trend < 0 ? <ArrowDown size={10} /> : <Minus size={10} />}
                        {Math.abs(trend).toFixed(1)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="dash-kpi-grid">
            <RadialKPICard title="Throughput" value={plantKPIs.throughput} format="compact" icon={TrendingUp} subtitle="Units/hour" />
            <RadialKPICard title="Cost/Unit" value={plantKPIs.costPerUnit} format="currency" icon={DollarSign} subtitle="Per unit cost" />
            <RadialKPICard title="Utilization" value={insights.utilization} icon={Users} thresholds={kpiThresholds.laborEfficiency} trend={trendValue('availability')} subtitle="Runtime utilization" />
            <RadialKPICard title="MTBF" value={plantKPIs.mtbf} format="duration" icon={Timer} thresholds={kpiThresholds.mtbf} subtitle="Time between failures" />
            <RadialKPICard title="MTTR" value={plantKPIs.mttr} format="duration" icon={Wrench} thresholds={kpiThresholds.mttr} subtitle="Time to repair" invertTrend />
            <RadialKPICard title="Rejection Rate" value={insights.rejectionRate} icon={Target} thresholds={kpiThresholds.quality} subtitle="Rejected vs total output" invertTrend />
          </div>

          <div className="dash-charts">
            <Card title="KPI Trends" subtitle={usingLiveData ? 'API trend series returned by PostgreSQL' : 'Daily averages from the simulator'}>
              {dailyTrends.length ? (
                <TrendChart
                  data={dailyTrends}
                  lines={[
                    { key: 'oee', name: 'OEE', color: '#3b82f6' },
                    { key: 'availability', name: 'Availability', color: '#10b981' },
                    { key: 'performance', name: 'Performance', color: '#f59e0b' },
                    { key: 'quality', name: 'Quality', color: '#8b5cf6' },
                  ]}
                  height={280}
                />
              ) : (
                <EmptyState title="No trend points available" description="The dashboard API returned an empty trend series for the selected range." />
              )}
            </Card>
            <Card title="Downtime Breakdown" subtitle={usingLiveData ? 'Minutes by downtime category' : 'By category'}>
              {downtimeBreakdown.length ? (
                <DonutChart data={downtimeBreakdown.slice(0, 8)} height={280} />
              ) : (
                <EmptyState title="No downtime recorded" description="No downtime categories were returned for the selected period." />
              )}
            </Card>
          </div>

          <div className="dash-comparison">
            <Card title="Machine OEE Comparison" subtitle={usingLiveData ? 'Top and bottom live assets combined' : 'All machines in scope'}>
              {machineComparison.length ? (
                <ComparisonBar
                  data={machineComparison.slice(0, 8).map((machine) => ({ label: machine.name, OEE: machine.oee }))}
                  bars={[{ key: 'OEE', name: 'OEE', color: '#3b82f6' }]}
                  layout="horizontal"
                  height={280}
                  valueFormat="percent"
                />
              ) : (
                <EmptyState title="No machine comparison available" description="Machine-level values will appear here once the API returns asset-level data." />
              )}
            </Card>
          </div>

          <div className="dash-insights">
            <Card title="Top 5 Machines" subtitle="Highest OEE">
              <div className="rank-list">
                {top5.map((machine, index) => (
                  <div key={machine.id} className="rank-item">
                    <span className="rank-number rank-good">{index + 1}</span>
                    <div className="rank-info">
                      <div className="rank-name">{machine.name}</div>
                      <div className="rank-sub">{machine.type}</div>
                    </div>
                    <span className={`rank-value status-text-${getKPIStatus(machine.oee)}`}>{pct(machine.oee)}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Bottom 5 Machines" subtitle="Lowest OEE">
              <div className="rank-list">
                {bottom5.map((machine, index) => (
                  <div key={machine.id} className="rank-item">
                    <span className="rank-number rank-bad">{index + 1}</span>
                    <div className="rank-info">
                      <div className="rank-name">{machine.name}</div>
                      <div className="rank-sub">{machine.type}</div>
                    </div>
                    <span className={`rank-value status-text-${getKPIStatus(machine.oee)}`}>{pct(machine.oee)}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Efficiency Heatmap" subtitle={usingLiveData ? 'Live asset x shift OEE' : 'Machine x Shift OEE'}>
              {heatmapData.data.length ? (
                <Heatmap data={heatmapData.data} xLabels={heatmapData.xLabels} yLabels={heatmapData.yLabels} />
              ) : (
                <EmptyState title="No heatmap available" description="No shift-level efficiency breakdown was returned." />
              )}
            </Card>
          </div>

          <div className="dash-summary">
            <div className="dash-summary-item">
              <span className="dash-summary-val">{compact(totalAgg.totalCount)}</span>
              <span className="dash-summary-label">Total Output</span>
            </div>
            <div className="dash-summary-item">
              <span className="dash-summary-val">{compact(totalAgg.goodCount)}</span>
              <span className="dash-summary-label">Good Units</span>
            </div>
            <div className="dash-summary-item">
              <span className="dash-summary-val">{num(Math.round(totalAgg.downtime / 60))}h</span>
              <span className="dash-summary-label">Total Downtime</span>
            </div>
            <div className="dash-summary-item">
              <span className="dash-summary-val">{currency(totalAgg.totalCost, 0)}</span>
              <span className="dash-summary-label">Total Cost</span>
            </div>
            <div className="dash-summary-item">
              <span className="dash-summary-val">{machineCount}</span>
              <span className="dash-summary-label">Machines</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
