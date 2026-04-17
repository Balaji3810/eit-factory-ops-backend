/**
 * EIT™ Reports & Insights
 * ========================
 * KPI comparison table, trend analysis, efficiency variance,
 * cost optimization insights, and CSV export.
 */

import { useMemo, useState } from 'react';
import {
  FileText, Download, TrendingUp, TrendingDown, AlertTriangle,
  Lightbulb, BarChart3,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  plants, machines, getMachinesByPlant, getDepartmentsByPlant,
  filterProductionLogs, filterDowntimeLogs, getAvailableDates,
} from '../data/mock';
import { aggregateProductionData, computeAllKPIs, getKPIStatus } from '../engine/kpi';
import { pct, num, compact, currency, shortDate } from '../utils/format';
import { Card, DataTable, Select, DateRange } from '../components/Common';
import { TrendChart, ComparisonBar } from '../components/Charts';
import { toCSV, downloadCSV } from '../utils/csv';

export default function ReportsPage() {
  const { selectedPlantId, kpiThresholds } = useApp();
  const dates = useMemo(() => getAvailableDates(), []);
  const [tab, setTab] = useState('comparison');
  const [dateRange, setDateRange] = useState({
    from: dates[Math.max(0, dates.length - 30)],
    to: dates[dates.length - 1],
  });

  const plantMachines = useMemo(() => getMachinesByPlant(selectedPlantId), [selectedPlantId]);
  const plantDepts = useMemo(() => getDepartmentsByPlant(selectedPlantId), [selectedPlantId]);

  const logs = useMemo(
    () => filterProductionLogs({ plantId: selectedPlantId, dateFrom: dateRange.from, dateTo: dateRange.to }),
    [selectedPlantId, dateRange],
  );

  // Full machine comparison data
  const machineReport = useMemo(() => {
    return plantMachines.map((m) => {
      const mLogs = logs.filter((l) => l.machineId === m.id);
      const agg = aggregateProductionData(mLogs);
      const k = computeAllKPIs(agg, m.designSpeed);
      return {
        id: m.id,
        name: m.name,
        type: m.type,
        department: plantDepts.find((d) => d.id === m.departmentId)?.name || '—',
        oee: k.oee,
        availability: k.availability,
        performance: k.performance,
        quality: k.quality,
        throughput: k.throughput,
        costPerUnit: k.costPerUnit,
        laborEfficiency: k.laborEfficiency,
        overallScore: k.overallScore,
        totalOutput: agg.totalCount,
        goodOutput: agg.goodCount,
        totalDowntime: agg.downtime,
        totalCost: agg.totalCost,
      };
    });
  }, [plantMachines, logs, plantDepts]);

  // Variance analysis (current week vs previous week)
  const varianceData = useMemo(() => {
    return plantMachines.map((m) => {
      const currLogs = logs.filter((l) => l.machineId === m.id).slice(-21);
      const prevLogs = logs.filter((l) => l.machineId === m.id).slice(-42, -21);
      const currAgg = aggregateProductionData(currLogs);
      const prevAgg = aggregateProductionData(prevLogs);
      const currK = computeAllKPIs(currAgg, m.designSpeed);
      const prevK = computeAllKPIs(prevAgg, m.designSpeed);
      return {
        id: m.id,
        name: m.name,
        currentOEE: currK.oee,
        previousOEE: prevK.oee,
        variance: currK.oee - prevK.oee,
        currentOutput: currAgg.totalCount,
        previousOutput: prevAgg.totalCount,
        outputChange: currAgg.totalCount - prevAgg.totalCount,
      };
    });
  }, [plantMachines, logs]);

  // Trend analysis (daily OEE for whole plant)
  const trendData = useMemo(() => {
    const grouped = {};
    for (const log of logs) {
      if (!grouped[log.date]) grouped[log.date] = [];
      grouped[log.date].push(log);
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayLogs]) => {
        const agg = aggregateProductionData(dayLogs);
        const k = computeAllKPIs(agg);
        return {
          label: shortDate(new Date(date + 'T00:00:00')),
          oee: k.oee,
          throughput: k.throughput,
          costPerUnit: k.costPerUnit,
        };
      });
  }, [logs]);

  // Cost optimization insights
  const costInsights = useMemo(() => {
    const sorted = [...machineReport].sort((a, b) => b.costPerUnit - a.costPerUnit);
    const insights = [];

    // Highest cost machines
    const highCost = sorted.slice(0, 3);
    for (const m of highCost) {
      if (m.costPerUnit > 0.1) {
        insights.push({
          type: 'warning',
          machine: m.name,
          message: `High cost per unit (${currency(m.costPerUnit, 3)}). Consider reducing downtime (${num(m.totalDowntime)}min total) or improving throughput.`,
        });
      }
    }

    // Low quality machines
    const lowQual = machineReport.filter((m) => m.quality < 0.95);
    for (const m of lowQual) {
      const scrapCost = (m.totalOutput - m.goodOutput) * m.costPerUnit;
      insights.push({
        type: 'critical',
        machine: m.name,
        message: `Quality at ${pct(m.quality)} — estimated scrap cost: ${currency(scrapCost)}. Investigate quality issues to reduce waste.`,
      });
    }

    // Positive trends
    const improving = varianceData.filter((v) => v.variance > 0.05);
    for (const v of improving.slice(0, 2)) {
      insights.push({
        type: 'success',
        machine: v.name,
        message: `OEE improved by ${pct(v.variance)} vs previous period. Continue current practices.`,
      });
    }

    // Declining trends
    const declining = varianceData.filter((v) => v.variance < -0.05);
    for (const v of declining.slice(0, 2)) {
      insights.push({
        type: 'warning',
        machine: v.name,
        message: `OEE declined by ${pct(Math.abs(v.variance))} vs previous period. Review recent downtime events and maintenance schedule.`,
      });
    }

    return insights.length > 0 ? insights : [
      { type: 'success', machine: 'Plant', message: 'All machines operating within acceptable parameters.' },
    ];
  }, [machineReport, varianceData]);

  // Downtime by category for reporting
  const downtimeReport = useMemo(() => {
    const dtLogs = filterDowntimeLogs({ plantId: selectedPlantId, dateFrom: dateRange.from, dateTo: dateRange.to });
    const cats = {};
    for (const dt of dtLogs) {
      if (!cats[dt.category]) cats[dt.category] = { count: 0, totalMinutes: 0 };
      cats[dt.category].count++;
      cats[dt.category].totalMinutes += dt.duration;
    }
    return Object.entries(cats)
      .map(([category, data]) => ({
        id: category,
        category,
        count: data.count,
        totalMinutes: data.totalMinutes,
        avgDuration: data.totalMinutes / data.count,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [selectedPlantId, dateRange]);

  // Export handlers
  const exportKPIs = () => {
    const csv = toCSV(
      machineReport.map((m) => ({
        ...m,
        oee: pct(m.oee),
        availability: pct(m.availability),
        performance: pct(m.performance),
        quality: pct(m.quality),
        laborEfficiency: pct(m.laborEfficiency),
        overallScore: pct(m.overallScore),
        costPerUnit: currency(m.costPerUnit, 3),
        totalCost: currency(m.totalCost),
      })),
      ['name', 'type', 'department', 'oee', 'availability', 'performance', 'quality', 'throughput', 'costPerUnit', 'totalOutput', 'totalCost'],
      { name: 'Machine', type: 'Type', department: 'Department', oee: 'OEE', availability: 'Availability', performance: 'Performance', quality: 'Quality', throughput: 'Throughput (u/hr)', costPerUnit: 'Cost/Unit', totalOutput: 'Total Output', totalCost: 'Total Cost' },
    );
    downloadCSV(csv, `eit-kpi-report-${dateRange.from}-to-${dateRange.to}.csv`);
  };

  const exportDowntime = () => {
    const csv = toCSV(
      downtimeReport,
      ['category', 'count', 'totalMinutes', 'avgDuration'],
      { category: 'Category', count: 'Events', totalMinutes: 'Total Minutes', avgDuration: 'Avg Duration (min)' },
    );
    downloadCSV(csv, `eit-downtime-report-${dateRange.from}-to-${dateRange.to}.csv`);
  };

  const comparisonColumns = [
    { key: 'name', label: 'Machine' },
    { key: 'type', label: 'Type' },
    { key: 'department', label: 'Dept' },
    { key: 'oee', label: 'OEE', render: (v) => <span className={`status-text-${getKPIStatus(v)}`}>{pct(v)}</span> },
    { key: 'availability', label: 'Avail', render: (v) => pct(v) },
    { key: 'performance', label: 'Perf', render: (v) => pct(v) },
    { key: 'quality', label: 'Quality', render: (v) => pct(v) },
    { key: 'throughput', label: 'Throughput', render: (v) => compact(v) },
    { key: 'costPerUnit', label: 'Cost/Unit', render: (v) => currency(v, 3) },
    { key: 'overallScore', label: 'Score', render: (v) => <span className={`status-text-${getKPIStatus(v)}`}>{pct(v)}</span> },
  ];

  const varianceColumns = [
    { key: 'name', label: 'Machine' },
    { key: 'currentOEE', label: 'Current OEE', render: (v) => pct(v) },
    { key: 'previousOEE', label: 'Previous OEE', render: (v) => pct(v) },
    {
      key: 'variance', label: 'Variance',
      render: (v) => (
        <span className={v > 0 ? 'status-text-good' : v < -0.02 ? 'status-text-critical' : 'status-text-warning'}>
          {v > 0 ? '+' : ''}{pct(v)}
          {v > 0 ? <TrendingUp size={12} style={{ marginLeft: 4 }} /> : v < 0 ? <TrendingDown size={12} style={{ marginLeft: 4 }} /> : null}
        </span>
      ),
    },
    { key: 'currentOutput', label: 'Current Output', render: (v) => compact(v) },
    { key: 'outputChange', label: 'Output Change', render: (v) => (
      <span className={v > 0 ? 'status-text-good' : 'status-text-critical'}>
        {v > 0 ? '+' : ''}{compact(v)}
      </span>
    )},
  ];

  const downtimeColumns = [
    { key: 'category', label: 'Category' },
    { key: 'count', label: 'Events', render: (v) => num(v) },
    { key: 'totalMinutes', label: 'Total (min)', render: (v) => num(Math.round(v)) },
    { key: 'avgDuration', label: 'Avg (min)', render: (v) => num(v, 1) },
  ];

  const tabs = [
    { id: 'comparison', label: 'KPI Comparison', icon: BarChart3 },
    { id: 'variance', label: 'Variance Analysis', icon: TrendingUp },
    { id: 'trends', label: 'Trend Analysis', icon: TrendingUp },
    { id: 'costs', label: 'Cost Insights', icon: Lightbulb },
  ];

  return (
    <div className="reports-page">
      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="toolbar-left">
          <FileText size={18} />
          <span className="toolbar-label">Reports & Insights</span>
        </div>
        <div className="toolbar-right">
          <DateRange from={dateRange.from} to={dateRange.to} onChange={setDateRange} />
          <button className="btn-secondary" onClick={exportKPIs}>
            <Download size={14} /> Export KPIs
          </button>
          <button className="btn-secondary" onClick={exportDowntime}>
            <Download size={14} /> Export Downtime
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="tab-bar">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`tab-item ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'comparison' && (
        <Card title="KPI Comparison Table" subtitle={`${machineReport.length} machines · ${dateRange.from} to ${dateRange.to}`}>
          <DataTable columns={comparisonColumns} data={machineReport} pageSize={15} />
        </Card>
      )}

      {tab === 'variance' && (
        <div>
          <Card title="Efficiency Variance Report" subtitle="Current vs previous period">
            <DataTable columns={varianceColumns} data={varianceData} pageSize={15} />
          </Card>
          <div style={{ marginTop: 16 }}>
            <Card title="Downtime Summary by Category">
              <DataTable columns={downtimeColumns} data={downtimeReport} pageSize={12} />
            </Card>
          </div>
        </div>
      )}

      {tab === 'trends' && (
        <div className="dashboard-grid-2">
          <Card title="OEE Trend" subtitle="Daily plant average">
            <TrendChart
              data={trendData}
              lines={[{ key: 'oee', name: 'OEE', color: '#3b82f6' }]}
            />
          </Card>
          <Card title="Throughput Trend" subtitle="Daily plant average">
            <TrendChart
              data={trendData}
              lines={[{ key: 'throughput', name: 'Throughput', color: '#10b981' }]}
              valueFormat="number"
            />
          </Card>
        </div>
      )}

      {tab === 'costs' && (
        <div>
          <Card title="Cost Optimization Insights" subtitle="AI-driven recommendations">
            <div className="insights-list">
              {costInsights.map((insight, i) => (
                <div key={i} className={`insight-item insight-${insight.type}`}>
                  <div className="insight-icon">
                    {insight.type === 'warning' && <AlertTriangle size={18} />}
                    {insight.type === 'critical' && <AlertTriangle size={18} />}
                    {insight.type === 'success' && <TrendingUp size={18} />}
                  </div>
                  <div className="insight-content">
                    <div className="insight-machine">{insight.machine}</div>
                    <div className="insight-message">{insight.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <div style={{ marginTop: 16 }}>
            <Card title="Cost Per Unit by Machine">
              <ComparisonBar
                data={[...machineReport].sort((a, b) => b.costPerUnit - a.costPerUnit).slice(0, 10).map((m) => ({
                  label: m.name,
                  'Cost/Unit': m.costPerUnit,
                }))}
                bars={[{ key: 'Cost/Unit', name: 'Cost/Unit ($)', color: '#ef4444' }]}
                layout="horizontal"
                height={300}
                valueFormat="number"
              />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
