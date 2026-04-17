/**
 * EIT™ Chart Components
 * ======================
 * Wrappers around Recharts for consistent styling, plus a custom OEE Gauge.
 */

import { Fragment } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS } from '../data/config';
import { pct, num, compact } from '../utils/format';

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------
function CustomTooltip({ active, payload, label, valueFormat }) {
  if (!active || !payload?.length) return null;
  const fmt = valueFormat === 'percent' ? pct
    : valueFormat === 'compact' ? compact
    : num;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="chart-tooltip-item">
          <span className="chart-tooltip-dot" style={{ background: entry.color }} />
          <span>{entry.name}: {fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OEE Gauge Chart (custom SVG semi-circle gauge)
// ---------------------------------------------------------------------------
export function OEEGauge({ value = 0, size = 200, label = 'OEE' }) {
  const percentage = Math.round(value * 100);
  const clampedValue = Math.min(1, Math.max(0, value));

  // 270° arc gauge using circle + stroke-dasharray (no arc path math needed)
  const strokeWidth = Math.round(size * 0.07);
  const radius = (size - strokeWidth) / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;       // 270° track
  const valueLength = arcLength * clampedValue;  // filled portion

  const color = getGaugeColor(clampedValue);
  const half = size / 2;

  return (
    <div className="oee-gauge" style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track — 270° arc, gap at bottom */}
        <circle
          cx={half} cy={half} r={radius}
          fill="none" stroke="var(--border-primary)" strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          transform={`rotate(135 ${half} ${half})`}
        />
        {/* Value arc */}
        {clampedValue > 0.005 && (
          <circle
            cx={half} cy={half} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${valueLength} ${circumference}`}
            transform={`rotate(135 ${half} ${half})`}
            style={{ filter: `drop-shadow(0 0 8px ${color}60)`, transition: 'stroke-dasharray 0.8s ease' }}
          />
        )}
      </svg>
      <div className="oee-gauge-label">
        <div className="oee-gauge-value" style={{ color }}>{percentage}%</div>
        <div className="oee-gauge-title">{label}</div>
      </div>
    </div>
  );
}

function getGaugeColor(value) {
  if (value >= 0.85) return '#10b981';
  if (value >= 0.65) return '#f59e0b';
  return '#ef4444';
}

// ---------------------------------------------------------------------------
// Trend Line Chart
// ---------------------------------------------------------------------------
export function TrendChart({ data, lines = [], height = 300, valueFormat = 'percent' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
        <XAxis dataKey="label" tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} />
        <YAxis
          tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
          tickFormatter={valueFormat === 'percent' ? (v) => pct(v, 0) : undefined}
        />
        <Tooltip content={<CustomTooltip valueFormat={valueFormat} />} />
        <Legend />
        {lines.map((line, i) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name || line.key}
            stroke={line.color || CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Comparison Bar Chart
// ---------------------------------------------------------------------------
export function ComparisonBar({ data, bars = [], height = 300, valueFormat = 'number', layout = 'vertical' }) {
  if (layout === 'horizontal') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
          <XAxis type="number" tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} />
          <YAxis
            dataKey="label"
            type="category"
            tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
            width={80}
          />
          <Tooltip content={<CustomTooltip valueFormat={valueFormat} />} />
          {bars.map((bar, i) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.name || bar.key}
              fill={bar.color || CHART_COLORS[i % CHART_COLORS.length]}
              radius={[0, 4, 4, 0]}
              barSize={16}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
        <XAxis dataKey="label" tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} />
        <YAxis
          tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
          tickFormatter={valueFormat === 'percent' ? (v) => pct(v, 0) : valueFormat === 'compact' ? compact : undefined}
        />
        <Tooltip content={<CustomTooltip valueFormat={valueFormat} />} />
        <Legend />
        {bars.map((bar, i) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.name || bar.key}
            fill={bar.color || CHART_COLORS[i % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Donut / Pie Chart
// ---------------------------------------------------------------------------
export function DonutChart({ data, height = 250, innerRadius = 55, outerRadius = 80 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={3}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Area Sparkline (for mini trends)
// ---------------------------------------------------------------------------
export function Sparkline({ data, dataKey = 'value', color = '#3b82f6', height = 60 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${color.replace('#', '')})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Heatmap (grid-based)
// ---------------------------------------------------------------------------
export function Heatmap({ data, xLabels, yLabels, valueFormat = 'percent' }) {
  const fmt = valueFormat === 'percent' ? (v) => pct(v, 0) : num;
  const maxVal = Math.max(...data.flat().filter(isFinite), 0.01);

  return (
    <div className="heatmap">
      <div className="heatmap-grid" style={{ gridTemplateColumns: `80px repeat(${xLabels.length}, 1fr)` }}>
        {/* Header row */}
        <div className="heatmap-corner" />
        {xLabels.map((x) => (
          <div key={x} className="heatmap-x-label">{x}</div>
        ))}

        {/* Data rows */}
        {yLabels.map((y, yi) => (
          <Fragment key={`row-${yi}`}>
            <div className="heatmap-y-label">{y}</div>
            {xLabels.map((x, xi) => {
              const val = data[yi]?.[xi] ?? 0;
              const intensity = val / maxVal;
              const bg = getHeatColor(intensity);
              return (
                <div
                  key={`${yi}-${xi}`}
                  className="heatmap-cell"
                  style={{ background: bg }}
                  title={`${y} / ${x}: ${fmt(val)}`}
                >
                  {fmt(val)}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function getHeatColor(intensity) {
  if (intensity >= 0.85) return 'rgba(16, 185, 129, 0.6)';
  if (intensity >= 0.65) return 'rgba(245, 158, 11, 0.4)';
  if (intensity >= 0.4) return 'rgba(245, 158, 11, 0.2)';
  return 'rgba(239, 68, 68, 0.25)';
}
