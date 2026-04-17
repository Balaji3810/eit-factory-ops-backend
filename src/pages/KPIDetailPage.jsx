/**
 * EIT™ KPI Detail Page
 * =====================
 * Shows every KPI with its name and formula.
 */

import {
  Gauge, Clock, Zap, CheckCircle2, TrendingUp, DollarSign, Users,
  Activity, Target, ArrowDown, BarChart3, Timer, Wrench,
} from 'lucide-react';

const KPI_META = [
  { key: 'oee', name: 'OEE', fullName: 'Overall Equipment Effectiveness', formula: 'Availability × Performance × Quality', icon: Gauge },
  { key: 'availability', name: 'Availability', fullName: 'Availability Rate', formula: 'Operating Time / Planned Production Time', icon: Clock },
  { key: 'performance', name: 'Performance', fullName: 'Performance Efficiency', formula: '(Ideal Cycle Time × Total Count) / Operating Time', icon: Zap },
  { key: 'quality', name: 'Quality', fullName: 'Quality Rate', formula: 'Good Count / Total Count', icon: CheckCircle2 },
  { key: 'downtimePercent', name: 'Downtime %', fullName: 'Downtime Percentage', formula: 'Downtime / Planned Production Time', icon: ArrowDown },
  { key: 'throughput', name: 'Throughput', fullName: 'Production Throughput', formula: 'Total Units / Operating Hours', icon: Activity },
  { key: 'costPerUnit', name: 'Cost / Unit', fullName: 'Cost Per Unit', formula: 'Total Cost / Total Units', icon: DollarSign },
  { key: 'laborEfficiency', name: 'Labor Efficiency', fullName: 'Labor Efficiency', formula: 'Actual Output / Standard Output', icon: Users },
  { key: 'productivity', name: 'Productivity', fullName: 'Productivity Rate', formula: 'Output / Input', icon: TrendingUp },
  { key: 'mtbf', name: 'MTBF', fullName: 'Mean Time Between Failures', formula: 'Total Operating Time / Number of Failures', icon: Timer },
  { key: 'mttr', name: 'MTTR', fullName: 'Mean Time To Repair', formula: 'Total Repair Time / Number of Failures', icon: Wrench },
  { key: 'overallScore', name: 'Overall Score', fullName: 'Weighted Composite Score', formula: 'Σ (KPI_i × Weight_i) / Σ Weight_i', icon: Target },
];

export default function KPIDetailPage() {
  return (
    <div className="kpi-detail-page">
      <div className="page-toolbar">
        <div className="toolbar-left">
          <BarChart3 size={18} />
          <span className="toolbar-label">KPI Formulas</span>
        </div>
      </div>

      <div className="kpi-detail-grid">
        {KPI_META.map((meta) => {
          const Icon = meta.icon;
          return (
            <div key={meta.key} className="kpi-detail-card kpi-formula-only">
              <div className="kpi-detail-card-top">
                <div className="kpi-detail-icon">
                  <Icon size={20} />
                </div>
                <div className="kpi-detail-title-group">
                  <div className="kpi-detail-name">{meta.name}</div>
                  <div className="kpi-detail-fullname">{meta.fullName}</div>
                </div>
              </div>
              <div className="kpi-detail-formula">
                <span className="formula-label">Formula</span>
                <code>{meta.formula}</code>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
