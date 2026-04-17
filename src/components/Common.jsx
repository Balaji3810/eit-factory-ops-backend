/**
 * EIT™ Shared UI Components
 * ==========================
 * KPICard, StatusBadge, DataTable, EmptyState, LoadingSkeleton, and more.
 */

import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, Minus, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { pct, num, currency, compact, duration } from '../utils/format';
import { getKPIStatus, getKPIStatusInverted, getStatusColor } from '../engine/kpi';

// ---------------------------------------------------------------------------
// KPI Summary Card — plain fallback
// ---------------------------------------------------------------------------
export function KPICard({ title, value, format = 'percent', subtitle, trend, thresholds, icon: Icon, invertTrend }) {
  const formatted = format === 'percent' ? pct(value)
    : format === 'number' ? num(value)
    : format === 'currency' ? currency(value)
    : format === 'compact' ? compact(value)
    : format === 'duration' ? duration(value)
    : String(value);

  const status = thresholds
    ? (invertTrend ? getKPIStatusInverted(value, thresholds) : getKPIStatus(value, thresholds))
    : null;
  const statusColor = status ? getStatusColor(status) : null;

  const trendClass = trend !== undefined
    ? (invertTrend
        ? (trend > 0 ? 'down' : trend < 0 ? 'up' : '')
        : (trend > 0 ? 'up' : trend < 0 ? 'down' : ''))
    : '';

  return (
    <div className="kpi-card">
      <div className="kpi-card-header">
        {Icon && <Icon size={16} className="kpi-card-icon" />}
        <span className="kpi-card-title">{title}</span>
      </div>
      <div className="kpi-card-value" style={statusColor ? { color: statusColor } : undefined}>
        {formatted}
      </div>
      <div className="kpi-card-footer">
        {trend !== undefined && (
          <span className={`kpi-trend ${trendClass}`}>
            {trend > 0 ? <ArrowUp size={12} /> : trend < 0 ? <ArrowDown size={12} /> : <Minus size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {subtitle && <span className="kpi-card-subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radial Ring KPI Card — circular progress for percentage KPIs, accent bar for others
// ---------------------------------------------------------------------------
function getRingColor(value, thresholds, inverted) {
  if (!thresholds) return '#3b82f6';
  const status = inverted ? getKPIStatusInverted(value, thresholds) : getKPIStatus(value, thresholds);
  if (status === 'good') return '#10b981';
  if (status === 'warning') return '#f59e0b';
  return '#ef4444';
}

export function RadialKPICard({ title, value, format = 'percent', subtitle, trend, thresholds, icon: Icon, invertTrend }) {
  const formatted = format === 'percent' ? pct(value)
    : format === 'number' ? num(value)
    : format === 'currency' ? currency(value)
    : format === 'compact' ? compact(value)
    : format === 'duration' ? duration(value)
    : String(value);

  const isRing = format === 'percent';
  const ringValue = isRing ? Math.min(Math.max(value, 0), 1) : 0;
  const color = getRingColor(value, thresholds, invertTrend);

  const trendClass = trend !== undefined
    ? (invertTrend
        ? (trend > 0 ? 'down' : trend < 0 ? 'up' : '')
        : (trend > 0 ? 'up' : trend < 0 ? 'down' : ''))
    : '';

  // SVG ring params
  const size = 72;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ringValue);

  return (
    <div className="radial-kpi-card">
      {isRing ? (
        <div className="radial-kpi-ring">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke="var(--border-primary)" strokeWidth={stroke}
            />
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={color} strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ filter: `drop-shadow(0 0 4px ${color}50)`, transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <span className="radial-kpi-ring-val" style={{ color }}>{formatted}</span>
        </div>
      ) : (
        <div className="radial-kpi-icon-wrap" style={{ background: `${color}18`, color }}>
          {Icon && <Icon size={24} />}
        </div>
      )}
      <div className="radial-kpi-info">
        <div className="radial-kpi-title">{title}</div>
        {!isRing && <div className="radial-kpi-value" style={{ color }}>{formatted}</div>}
        <div className="radial-kpi-footer">
          {trend !== undefined && (
            <span className={`kpi-trend ${trendClass}`}>
              {trend > 0 ? <ArrowUp size={11} /> : trend < 0 ? <ArrowDown size={11} /> : <Minus size={11} />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {subtitle && <span className="radial-kpi-sub">{subtitle}</span>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------
export function StatusBadge({ status, label }) {
  const text = label || status;
  return (
    <span className={`status-badge status-${status}`}>
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sortable Data Table
// ---------------------------------------------------------------------------
export function DataTable({ columns, data, onRowClick, pageSize = 10 }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.key];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
      }),
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="data-table-wrapper">
      <div className="data-table-toolbar">
        <div className="table-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <div className="table-info">
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={col.sortable !== false ? 'sortable' : ''}
                  style={col.width ? { width: col.width } : undefined}
                >
                  <span>{col.label}</span>
                  {sortKey === col.key && (
                    sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table-empty">
                  No data available
                </td>
              </tr>
            ) : (
              paged.map((row, i) => (
                <tr
                  key={row.id || i}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={onRowClick ? 'clickable' : ''}
                >
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="data-table-pagination">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
          <span>Page {page + 1} of {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card wrapper (generic panel)
// ---------------------------------------------------------------------------
export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {(title || action) && (
        <div className="card-header">
          <div>
            <div className="card-title">{title}</div>
            {subtitle && <div className="card-subtitle">{subtitle}</div>}
          </div>
          {action && <div className="card-action">{action}</div>}
        </div>
      )}
      <div className="card-body">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------
export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={48} strokeWidth={1} />}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------
export function Skeleton({ width = '100%', height = 20, count = 1 }) {
  return (
    <div className="skeleton-group">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ width, height }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Select dropdown
// ---------------------------------------------------------------------------
export function Select({ label, value, onChange, options, allLabel = 'All' }) {
  return (
    <div className="eit-select">
      {label && <label>{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date range picker (simplified)
// ---------------------------------------------------------------------------
export function DateRange({ from, to, onChange }) {
  return (
    <div className="date-range">
      <input
        type="date"
        value={from}
        onChange={(e) => onChange({ from: e.target.value, to })}
      />
      <span className="date-range-sep">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onChange({ from, to: e.target.value })}
      />
    </div>
  );
}
