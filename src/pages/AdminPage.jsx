/**
 * EIT™ Admin Configuration
 * =========================
 * KPI weight configuration, threshold settings, machine setup,
 * shift configuration, and role-based mock access display.
 */

import { useState, useMemo } from 'react';
import {
  Settings, Scale, AlertTriangle, Cpu, Clock, Users,
  Save, RotateCcw, Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { plants, machines, getDepartmentsByPlant, getMachinesByPlant } from '../data/mock';
import { SHIFTS, SCORING_WEIGHTS, KPI_THRESHOLDS } from '../data/config';
import { DEFAULT_WEIGHTS } from '../engine/kpi';
import { pct, num } from '../utils/format';
import { Card, DataTable } from '../components/Common';

const WEIGHT_LABELS = {
  oee: 'OEE',
  availability: 'Availability',
  performance: 'Performance',
  quality: 'Quality',
  throughputNorm: 'Throughput',
  costEfficiency: 'Cost Efficiency',
  laborEfficiency: 'Labor Efficiency',
};

const THRESHOLD_LABELS = {
  oee: 'OEE',
  availability: 'Availability',
  performance: 'Performance',
  quality: 'Quality',
  laborEfficiency: 'Labor Efficiency',
  productivity: 'Productivity',
  downtimePercent: 'Downtime %',
  overallScore: 'Overall Score',
};

const ROLES = [
  { id: 'admin', name: 'Administrator', description: 'Full system access, configuration, user management', users: 2 },
  { id: 'manager', name: 'Plant Manager', description: 'View all data, reports, simulation. Cannot change config.', users: 4 },
  { id: 'engineer', name: 'Process Engineer', description: 'View analytics, simulation, and reports. No admin access.', users: 8 },
  { id: 'operator', name: 'Operator', description: 'View dashboard for assigned plant only.', users: 15 },
  { id: 'viewer', name: 'Viewer', description: 'Read-only access to dashboard and reports.', users: 12 },
];

export default function AdminPage() {
  const { kpiWeights, setKpiWeights, kpiThresholds, setKpiThresholds, selectedPlantId } = useApp();
  const [tab, setTab] = useState('weights');
  const [saved, setSaved] = useState(false);

  // Weight editor
  const [editWeights, setEditWeights] = useState({ ...kpiWeights });
  const totalWeight = Object.values(editWeights).reduce((a, b) => a + b, 0);

  const handleWeightChange = (key, value) => {
    setEditWeights((prev) => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  const saveWeights = () => {
    setKpiWeights({ ...editWeights });
    flashSaved();
  };

  const resetWeights = () => {
    setEditWeights({ ...SCORING_WEIGHTS });
  };

  // Threshold editor
  const [editThresholds, setEditThresholds] = useState(
    JSON.parse(JSON.stringify(kpiThresholds)),
  );

  const handleThresholdChange = (key, tier, value) => {
    setEditThresholds((prev) => ({
      ...prev,
      [key]: { ...prev[key], [tier]: parseFloat(value) || 0 },
    }));
  };

  const saveThresholds = () => {
    setKpiThresholds(JSON.parse(JSON.stringify(editThresholds)));
    flashSaved();
  };

  const resetThresholds = () => {
    setEditThresholds(JSON.parse(JSON.stringify(KPI_THRESHOLDS)));
  };

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Machine inventory
  const plantMachines = useMemo(() => getMachinesByPlant(selectedPlantId), [selectedPlantId]);
  const plantDepts = useMemo(() => getDepartmentsByPlant(selectedPlantId), [selectedPlantId]);

  const machineColumns = [
    { key: 'id', label: 'ID', width: '100px' },
    { key: 'name', label: 'Machine Name' },
    { key: 'type', label: 'Type' },
    { key: 'dept', label: 'Department' },
    { key: 'designSpeed', label: 'Design Speed', render: (v) => `${num(v)}/hr` },
  ];

  const machineTableData = plantMachines.map((m) => ({
    ...m,
    dept: plantDepts.find((d) => d.id === m.departmentId)?.name || '—',
  }));

  const tabs = [
    { id: 'weights', label: 'KPI Weights', icon: Scale },
    { id: 'thresholds', label: 'Thresholds', icon: AlertTriangle },
    { id: 'machines', label: 'Machine Setup', icon: Cpu },
    { id: 'shifts', label: 'Shift Config', icon: Clock },
    { id: 'roles', label: 'Roles & Access', icon: Users },
  ];

  return (
    <div className="admin-page">
      {/* Save notification */}
      {saved && (
        <div className="save-toast">
          <Check size={16} /> Configuration saved successfully
        </div>
      )}

      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="toolbar-left">
          <Settings size={18} />
          <span className="toolbar-label">System Configuration</span>
        </div>
      </div>

      {/* Tabs */}
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
      {tab === 'weights' && (
        <Card
          title="Overall Efficiency Score Weights"
          subtitle={`Total weight: ${(totalWeight * 100).toFixed(0)}% ${Math.abs(totalWeight - 1) > 0.001 ? '(should sum to 100%)' : ''}`}
          action={
            <div className="card-actions">
              <button className="btn-secondary" onClick={resetWeights}><RotateCcw size={14} /> Reset</button>
              <button className="btn-primary" onClick={saveWeights} disabled={Math.abs(totalWeight - 1) > 0.01}>
                <Save size={14} /> Save
              </button>
            </div>
          }
        >
          <div className="config-grid">
            {Object.entries(WEIGHT_LABELS).map(([key, label]) => (
              <div key={key} className="config-row">
                <label className="config-label">{label}</label>
                <div className="config-input-group">
                  <input
                    type="range"
                    min={0}
                    max={0.5}
                    step={0.01}
                    value={editWeights[key] || 0}
                    onChange={(e) => handleWeightChange(key, e.target.value)}
                    className="config-slider"
                  />
                  <span className="config-value">{((editWeights[key] || 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="config-bar">
                  <div
                    className="config-bar-fill"
                    style={{ width: `${(editWeights[key] || 0) * 200}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'thresholds' && (
        <Card
          title="KPI Status Thresholds"
          subtitle="Define Good (green) and Warning (yellow) boundaries. Below warning = Critical (red)."
          action={
            <div className="card-actions">
              <button className="btn-secondary" onClick={resetThresholds}><RotateCcw size={14} /> Reset</button>
              <button className="btn-primary" onClick={saveThresholds}><Save size={14} /> Save</button>
            </div>
          }
        >
          <div className="threshold-grid">
            <div className="threshold-header">
              <span>KPI</span>
              <span>Good (&ge;)</span>
              <span>Warning (&ge;)</span>
              <span>Preview</span>
            </div>
            {Object.entries(THRESHOLD_LABELS).map(([key, label]) => {
              const t = editThresholds[key] || { good: 0.85, warning: 0.70 };
              return (
                <div key={key} className="threshold-row">
                  <span className="threshold-label">{label}</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={t.good}
                    onChange={(e) => handleThresholdChange(key, 'good', e.target.value)}
                    className="threshold-input"
                  />
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={t.warning}
                    onChange={(e) => handleThresholdChange(key, 'warning', e.target.value)}
                    className="threshold-input"
                  />
                  <div className="threshold-preview">
                    <span className="status-text-good">&ge;{pct(t.good, 0)}</span>
                    <span className="status-text-warning">&ge;{pct(t.warning, 0)}</span>
                    <span className="status-text-critical">&lt;{pct(t.warning, 0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {tab === 'machines' && (
        <Card
          title="Machine Inventory"
          subtitle={`${plants.find((p) => p.id === selectedPlantId)?.name} — ${plantMachines.length} machines`}
        >
          <DataTable columns={machineColumns} data={machineTableData} pageSize={15} />
        </Card>
      )}

      {tab === 'shifts' && (
        <Card title="Shift Configuration" subtitle="Standard shift schedule">
          <div className="shift-grid">
            {SHIFTS.map((s) => (
              <div key={s.id} className="shift-card">
                <div className="shift-header">
                  <Clock size={18} />
                  <span className="shift-name">{s.name} Shift</span>
                  <span className="shift-id">{s.id}</span>
                </div>
                <div className="shift-detail">
                  <div className="shift-row">
                    <span>Start Time</span>
                    <span>{s.start}</span>
                  </div>
                  <div className="shift-row">
                    <span>End Time</span>
                    <span>{s.end}</span>
                  </div>
                  <div className="shift-row">
                    <span>Duration</span>
                    <span>{s.hours} hours</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'roles' && (
        <Card title="Role-Based Access Control" subtitle="Mock user roles and permissions">
          <div className="roles-list">
            {ROLES.map((role) => (
              <div key={role.id} className="role-card">
                <div className="role-header">
                  <Users size={18} />
                  <span className="role-name">{role.name}</span>
                  <span className="role-badge">{role.users} users</span>
                </div>
                <div className="role-desc">{role.description}</div>
                <div className="role-perms">
                  <div className="perm-grid">
                    {[
                      { name: 'Dashboard', allowed: true },
                      { name: 'Analytics', allowed: role.id !== 'viewer' },
                      { name: 'Simulation', allowed: ['admin', 'manager', 'engineer'].includes(role.id) },
                      { name: 'Reports', allowed: role.id !== 'operator' },
                      { name: 'Admin', allowed: role.id === 'admin' },
                    ].map((perm) => (
                      <div key={perm.name} className={`perm-item ${perm.allowed ? 'allowed' : 'denied'}`}>
                        {perm.allowed ? <Check size={12} /> : <span>×</span>}
                        {perm.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
