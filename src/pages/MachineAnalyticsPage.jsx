/**
 * EIT™ Machine Analytics Page
 * ============================
 * Deep-dive into individual machine or department performance with
 * filters (plant, department, machine, date range, shift),
 * historical KPI trends, and shift-level drill-down.
 */

import { useMemo, useState } from 'react';
import { Filter, BarChart3, Clock, Zap, CheckCircle2, Gauge } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  machines, getDepartmentsByPlant, getMachinesByPlant,
  filterProductionLogs, getAvailableDates,
} from '../data/mock';
import { SHIFTS } from '../data/config';
import { aggregateProductionData, computeAllKPIs, getKPIStatus } from '../engine/kpi';
import { pct, num, compact, shortDate, currency } from '../utils/format';
import { KPICard, Card, Select, DateRange, DataTable } from '../components/Common';
import { TrendChart, ComparisonBar, OEEGauge } from '../components/Charts';

export default function MachineAnalyticsPage() {
  const { selectedPlantId, kpiThresholds } = useApp();
  const dates = useMemo(() => getAvailableDates(), []);

  // Filters
  const [departmentId, setDepartmentId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [dateRange, setDateRange] = useState({
    from: dates[Math.max(0, dates.length - 30)],
    to: dates[dates.length - 1],
  });

  const plantDepts = useMemo(() => getDepartmentsByPlant(selectedPlantId), [selectedPlantId]);
  const plantMachines = useMemo(() => {
    let list = getMachinesByPlant(selectedPlantId);
    if (departmentId) list = list.filter((m) => m.departmentId === departmentId);
    return list;
  }, [selectedPlantId, departmentId]);

  // Reset machine when department changes
  const handleDeptChange = (val) => {
    setDepartmentId(val);
    setMachineId('');
  };

  // Filtered logs
  const logs = useMemo(
    () => filterProductionLogs({
      plantId: selectedPlantId,
      departmentId: departmentId || undefined,
      machineId: machineId || undefined,
      shiftId: shiftId || undefined,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
    }),
    [selectedPlantId, departmentId, machineId, shiftId, dateRange],
  );

  // KPIs for current filter
  const kpis = useMemo(() => {
    const agg = aggregateProductionData(logs);
    const designSpeed = machineId
      ? machines.find((m) => m.id === machineId)?.designSpeed || 12000
      : 12000;
    return computeAllKPIs(agg, designSpeed);
  }, [logs, machineId]);

  // Daily trend
  const dailyTrends = useMemo(() => {
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
          availability: k.availability,
          performance: k.performance,
          quality: k.quality,
          throughput: k.throughput,
        };
      });
  }, [logs]);

  // Shift breakdown
  const shiftBreakdown = useMemo(() => {
    return SHIFTS.map((s) => {
      const sLogs = logs.filter((l) => l.shiftId === s.id);
      const agg = aggregateProductionData(sLogs);
      const k = computeAllKPIs(agg);
      return {
        label: s.name,
        OEE: k.oee,
        Availability: k.availability,
        Performance: k.performance,
        Quality: k.quality,
        output: agg.totalCount,
      };
    });
  }, [logs]);

  // Machine detail table
  const machineTable = useMemo(() => {
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
        totalOutput: agg.totalCount,
        downtime: agg.downtime,
      };
    });
  }, [plantMachines, logs, plantDepts]);

  const tableColumns = [
    { key: 'name', label: 'Machine' },
    { key: 'type', label: 'Type' },
    { key: 'department', label: 'Dept' },
    { key: 'oee', label: 'OEE', render: (v) => <span className={`status-text-${getKPIStatus(v)}`}>{pct(v)}</span> },
    { key: 'availability', label: 'Avail', render: (v) => pct(v) },
    { key: 'performance', label: 'Perf', render: (v) => pct(v) },
    { key: 'quality', label: 'Quality', render: (v) => pct(v) },
    { key: 'throughput', label: 'Throughput', render: (v) => compact(v) + '/hr' },
    { key: 'totalOutput', label: 'Output', render: (v) => compact(v) },
    { key: 'downtime', label: 'Downtime', render: (v) => `${num(Math.round(v))}m` },
  ];

  const currentMachine = machineId ? machines.find((m) => m.id === machineId) : null;

  return (
    <div className="analytics-page">
      {/* Filter Bar */}
      <Card className="filter-bar">
        <div className="filter-row">
          <Filter size={16} />
          <Select
            label="Department"
            value={departmentId}
            onChange={handleDeptChange}
            options={plantDepts.map((d) => ({ value: d.id, label: d.name }))}
          />
          <Select
            label="Machine"
            value={machineId}
            onChange={setMachineId}
            options={plantMachines.map((m) => ({ value: m.id, label: m.name }))}
          />
          <Select
            label="Shift"
            value={shiftId}
            onChange={setShiftId}
            options={SHIFTS.map((s) => ({ value: s.id, label: s.name }))}
          />
          <DateRange from={dateRange.from} to={dateRange.to} onChange={setDateRange} />
        </div>
      </Card>

      {/* KPI Summary */}
      <div className="kpi-grid kpi-grid-5">
        <KPICard title="OEE" value={kpis.oee} icon={Gauge} thresholds={kpiThresholds.oee} />
        <KPICard title="Availability" value={kpis.availability} icon={Clock} thresholds={kpiThresholds.availability} />
        <KPICard title="Performance" value={kpis.performance} icon={Zap} thresholds={kpiThresholds.performance} />
        <KPICard title="Quality" value={kpis.quality} icon={CheckCircle2} thresholds={kpiThresholds.quality} />
        <KPICard title="Throughput" value={kpis.throughput} format="compact" icon={BarChart3} subtitle="Units/hr" />
      </div>

      {/* Charts Row */}
      <div className="dashboard-grid-2">
        <Card title="Historical KPI Trends" subtitle={currentMachine?.name || 'Filtered selection'}>
          <TrendChart
            data={dailyTrends}
            lines={[
              { key: 'oee', name: 'OEE', color: '#3b82f6' },
              { key: 'availability', name: 'Availability', color: '#10b981' },
              { key: 'performance', name: 'Performance', color: '#f59e0b' },
              { key: 'quality', name: 'Quality', color: '#8b5cf6' },
            ]}
          />
        </Card>

        <Card title="Shift Drill-Down" subtitle="OEE by shift">
          <ComparisonBar
            data={shiftBreakdown}
            bars={[
              { key: 'OEE', name: 'OEE', color: '#3b82f6' },
              { key: 'Availability', name: 'Availability', color: '#10b981' },
              { key: 'Performance', name: 'Performance', color: '#f59e0b' },
            ]}
            valueFormat="percent"
            height={280}
          />
        </Card>
      </div>

      {/* Machine Table */}
      <Card title="Machine Performance Detail" subtitle={`${machineTable.length} machines`}>
        <DataTable
          columns={tableColumns}
          data={machineTable}
          pageSize={12}
          onRowClick={(row) => setMachineId(row.id)}
        />
      </Card>
    </div>
  );
}
