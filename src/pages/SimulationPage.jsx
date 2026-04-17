/**
 * EIT™ Data Entry & Simulation Module
 * =====================================
 * Editable production parameters with live KPI recalculation,
 * what-if analysis sliders, and scenario comparison.
 */

import { useMemo, useState, useCallback } from 'react';
import {
  SlidersHorizontal, Play, RotateCcw, Gauge, Clock, Zap,
  CheckCircle2, TrendingUp, DollarSign, Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { machines, getMachinesByPlant, filterProductionLogs } from '../data/mock';
import { aggregateProductionData, computeAllKPIs, getKPIStatus } from '../engine/kpi';
import { pct, num, currency, compact } from '../utils/format';
import { KPICard, Card, Select } from '../components/Common';
import { OEEGauge, ComparisonBar } from '../components/Charts';

const PARAM_DEFS = [
  { key: 'plannedProductionTime', label: 'Planned Time (min)', min: 60, max: 1440, step: 10 },
  { key: 'operatingTime',        label: 'Operating Time (min)', min: 0, max: 1440, step: 10 },
  { key: 'idealCycleTime',       label: 'Ideal Cycle Time (min/unit)', min: 0.001, max: 1, step: 0.001 },
  { key: 'totalCount',           label: 'Total Count (units)', min: 0, max: 500000, step: 100 },
  { key: 'goodCount',            label: 'Good Count (units)', min: 0, max: 500000, step: 100 },
  { key: 'downtime',             label: 'Downtime (min)', min: 0, max: 480, step: 5 },
  { key: 'totalCost',            label: 'Total Cost ($)', min: 0, max: 50000, step: 50 },
  { key: 'laborHours',           label: 'Labor Hours', min: 0, max: 100, step: 1 },
  { key: 'standardOutput',       label: 'Standard Output', min: 0, max: 500000, step: 100 },
  { key: 'actualOutput',         label: 'Actual Output', min: 0, max: 500000, step: 100 },
];

export default function SimulationPage() {
  const { selectedPlantId, kpiWeights } = useApp();
  const plantMachines = useMemo(() => getMachinesByPlant(selectedPlantId), [selectedPlantId]);
  const [machineId, setMachineId] = useState(plantMachines[0]?.id || '');

  // Baseline: aggregate real data for selected machine
  const baseline = useMemo(() => {
    const logs = filterProductionLogs({ machineId: machineId || undefined, plantId: selectedPlantId });
    const lastWeek = logs.slice(-21); // last 7 days × 3 shifts
    if (lastWeek.length === 0) return null;
    return aggregateProductionData(lastWeek);
  }, [machineId, selectedPlantId]);

  const initialParams = useMemo(() => {
    if (!baseline) {
      return {
        plannedProductionTime: 480, operatingTime: 420, idealCycleTime: 0.005,
        totalCount: 50000, goodCount: 48000, downtime: 60, totalCost: 2500,
        laborHours: 16, standardOutput: 55000, actualOutput: 50000,
      };
    }
    return {
      plannedProductionTime: Math.round(baseline.plannedTime / 21),
      operatingTime: Math.round(baseline.operatingTime / 21),
      idealCycleTime: Math.round(baseline.idealCycleTime * 10000) / 10000,
      totalCount: Math.round(baseline.totalCount / 21),
      goodCount: Math.round(baseline.goodCount / 21),
      downtime: Math.round(baseline.downtime / 21),
      totalCost: Math.round(baseline.totalCost / 21),
      laborHours: Math.round(baseline.laborHours / 21),
      standardOutput: Math.round(baseline.standardOutput / 21),
      actualOutput: Math.round(baseline.actualOutput / 21),
    };
  }, [baseline]);

  const [params, setParams] = useState(initialParams);
  const [scenarios, setScenarios] = useState([]);

  // Reset on machine change
  const handleMachineChange = useCallback((id) => {
    setMachineId(id);
  }, []);

  // Recalculate when machine/baseline changes
  useMemo(() => {
    setParams(initialParams);
  }, [initialParams]);

  const handleParam = (key, value) => {
    setParams((prev) => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  const resetParams = () => setParams(initialParams);

  // Live KPI calculation
  const liveKPIs = useMemo(() => {
    const data = {
      plannedTime: params.plannedProductionTime,
      operatingTime: params.operatingTime,
      idealCycleTime: params.idealCycleTime,
      totalCount: params.totalCount,
      goodCount: params.goodCount,
      downtime: params.downtime,
      totalCost: params.totalCost,
      laborHours: params.laborHours,
      standardOutput: params.standardOutput,
      actualOutput: params.actualOutput,
    };
    const selectedMachine = machines.find((m) => m.id === machineId);
    return computeAllKPIs(data, selectedMachine?.designSpeed || 12000, kpiWeights);
  }, [params, machineId, kpiWeights]);

  // Baseline KPIs
  const baselineKPIs = useMemo(() => {
    const data = {
      plannedTime: initialParams.plannedProductionTime,
      operatingTime: initialParams.operatingTime,
      idealCycleTime: initialParams.idealCycleTime,
      totalCount: initialParams.totalCount,
      goodCount: initialParams.goodCount,
      downtime: initialParams.downtime,
      totalCost: initialParams.totalCost,
      laborHours: initialParams.laborHours,
      standardOutput: initialParams.standardOutput,
      actualOutput: initialParams.actualOutput,
    };
    const selectedMachine = machines.find((m) => m.id === machineId);
    return computeAllKPIs(data, selectedMachine?.designSpeed || 12000, kpiWeights);
  }, [initialParams, machineId, kpiWeights]);

  // Save scenario
  const saveScenario = () => {
    setScenarios((prev) => [
      ...prev,
      {
        id: Date.now(),
        label: `Scenario ${prev.length + 1}`,
        params: { ...params },
        kpis: { ...liveKPIs },
      },
    ]);
  };

  // Comparison chart data
  const comparisonData = useMemo(() => {
    const items = [
      { label: 'Baseline', OEE: baselineKPIs.oee, Availability: baselineKPIs.availability, Performance: baselineKPIs.performance, Quality: baselineKPIs.quality },
      { label: 'Current', OEE: liveKPIs.oee, Availability: liveKPIs.availability, Performance: liveKPIs.performance, Quality: liveKPIs.quality },
      ...scenarios.map((s) => ({
        label: s.label,
        OEE: s.kpis.oee,
        Availability: s.kpis.availability,
        Performance: s.kpis.performance,
        Quality: s.kpis.quality,
      })),
    ];
    return items;
  }, [baselineKPIs, liveKPIs, scenarios]);

  const selectedMachine = machines.find((m) => m.id === machineId);

  return (
    <div className="simulation-page">
      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="toolbar-left">
          <SlidersHorizontal size={18} />
          <span className="toolbar-label">What-If Analysis & Simulation</span>
        </div>
        <div className="toolbar-right">
          <Select
            value={machineId}
            onChange={handleMachineChange}
            allLabel=""
            options={plantMachines.map((m) => ({ value: m.id, label: m.name }))}
          />
        </div>
      </div>

      <div className="sim-layout">
        {/* Left: Parameter Controls */}
        <div className="sim-controls">
          <Card title="Production Parameters" subtitle={selectedMachine?.name || 'Select a machine'}
            action={
              <button className="btn-secondary" onClick={resetParams}>
                <RotateCcw size={14} /> Reset
              </button>
            }
          >
            <div className="param-list">
              {PARAM_DEFS.map((def) => (
                <div key={def.key} className="param-row">
                  <label className="param-label">{def.label}</label>
                  <div className="param-input-group">
                    <input
                      type="range"
                      min={def.min}
                      max={def.max}
                      step={def.step}
                      value={params[def.key]}
                      onChange={(e) => handleParam(def.key, e.target.value)}
                      className="param-slider"
                    />
                    <input
                      type="number"
                      value={params[def.key]}
                      onChange={(e) => handleParam(def.key, e.target.value)}
                      className="param-number"
                      step={def.step}
                    />
                  </div>
                  {initialParams[def.key] !== params[def.key] && (
                    <div className="param-delta">
                      Baseline: {num(initialParams[def.key], def.step < 1 ? 3 : 0)}
                      {' → '}
                      Δ {params[def.key] > initialParams[def.key] ? '+' : ''}
                      {num(params[def.key] - initialParams[def.key], def.step < 1 ? 3 : 0)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="param-actions">
              <button className="btn-primary" onClick={saveScenario}>
                <Play size={14} /> Save Scenario
              </button>
            </div>
          </Card>
        </div>

        {/* Right: Live Results */}
        <div className="sim-results">
          {/* Live KPIs */}
          <div className="kpi-grid kpi-grid-4">
            <KPICard title="OEE" value={liveKPIs.oee} icon={Gauge}
              trend={((liveKPIs.oee - baselineKPIs.oee) / (baselineKPIs.oee || 1)) * 100}
              subtitle="vs baseline"
            />
            <KPICard title="Availability" value={liveKPIs.availability} icon={Clock}
              trend={((liveKPIs.availability - baselineKPIs.availability) / (baselineKPIs.availability || 1)) * 100}
            />
            <KPICard title="Performance" value={liveKPIs.performance} icon={Zap}
              trend={((liveKPIs.performance - baselineKPIs.performance) / (baselineKPIs.performance || 1)) * 100}
            />
            <KPICard title="Quality" value={liveKPIs.quality} icon={CheckCircle2}
              trend={((liveKPIs.quality - baselineKPIs.quality) / (baselineKPIs.quality || 1)) * 100}
            />
          </div>

          <div className="dashboard-grid-2">
            <Card title="OEE Gauge" subtitle="Simulated">
              <div className="gauge-container">
                <OEEGauge value={liveKPIs.oee} size={200} label="Simulated OEE" />
              </div>
            </Card>

            <Card title="Additional KPIs">
              <div className="sim-kpi-grid">
                <div className="sim-kpi-item">
                  <span className="sim-kpi-label">Throughput</span>
                  <span className="sim-kpi-val">{compact(liveKPIs.throughput)}/hr</span>
                </div>
                <div className="sim-kpi-item">
                  <span className="sim-kpi-label">Cost/Unit</span>
                  <span className="sim-kpi-val">{currency(liveKPIs.costPerUnit, 3)}</span>
                </div>
                <div className="sim-kpi-item">
                  <span className="sim-kpi-label">Labor Efficiency</span>
                  <span className="sim-kpi-val">{pct(liveKPIs.laborEfficiency)}</span>
                </div>
                <div className="sim-kpi-item">
                  <span className="sim-kpi-label">Downtime %</span>
                  <span className="sim-kpi-val">{pct(liveKPIs.downtimePercent)}</span>
                </div>
                <div className="sim-kpi-item">
                  <span className="sim-kpi-label">Productivity</span>
                  <span className="sim-kpi-val">{pct(liveKPIs.productivity)}</span>
                </div>
                <div className="sim-kpi-item">
                  <span className="sim-kpi-label">Overall Score</span>
                  <span className="sim-kpi-val">{pct(liveKPIs.overallScore)}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Scenario Comparison */}
          <Card title="Scenario Comparison" subtitle={`${comparisonData.length} scenarios`}>
            <ComparisonBar
              data={comparisonData}
              bars={[
                { key: 'OEE', name: 'OEE', color: '#3b82f6' },
                { key: 'Availability', name: 'Availability', color: '#10b981' },
                { key: 'Performance', name: 'Performance', color: '#f59e0b' },
                { key: 'Quality', name: 'Quality', color: '#8b5cf6' },
              ]}
              valueFormat="percent"
              height={250}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
