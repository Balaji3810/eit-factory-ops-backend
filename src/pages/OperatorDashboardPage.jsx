/**
 * EIT™ Operator Dashboard
 * ========================
 * Real-time style operator view with hourly production charts,
 * reject tracking, good production vs target, and machine timeline.
 */

import { useMemo, useState, useRef, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell, LabelList,
} from 'recharts';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  plants, machines, lines, filterProductionLogs, filterDowntimeLogs,
  getLinesByPlant, getMachinesByLine, getAvailableDates,
} from '../data/mock';
import { SHIFTS } from '../data/config';
import { num, compact } from '../utils/format';

// Seeded RNG for deterministic hourly breakdown
function createRNG(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Split a total into N chunks with variation
function splitIntoHours(total, hours, seed) {
  const rng = createRNG(seed);
  const weights = Array.from({ length: hours }, () => 0.7 + rng() * 0.6);
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => Math.round((w / sum) * total));
}

// Generate timeline events for a shift
function generateTimeline(shiftStart, hours, downtime, seed) {
  const rng = createRNG(seed + 99);
  const segments = [];
  let currentMin = 0;
  const totalMin = hours * 60;

  // Place 1-3 downtime events within the shift
  const dtEvents = [];
  let dtRemaining = downtime;
  const eventCount = dtRemaining > 30 ? Math.min(3, Math.ceil(dtRemaining / 20)) : (dtRemaining > 5 ? 1 : 0);

  for (let i = 0; i < eventCount && dtRemaining > 2; i++) {
    const dur = i === eventCount - 1 ? dtRemaining : Math.round(2 + rng() * (dtRemaining * 0.5));
    const startOffset = Math.round(rng() * (totalMin - dur - 10));
    dtEvents.push({
      start: startOffset,
      duration: Math.min(dur, dtRemaining),
      type: rng() > 0.7 ? 'Break' : rng() > 0.5 ? 'Fault' : 'Changeover',
    });
    dtRemaining -= dur;
  }

  // Sort by start time
  dtEvents.sort((a, b) => a.start - b.start);

  // Build timeline from events
  for (const evt of dtEvents) {
    if (evt.start > currentMin) {
      segments.push({ start: currentMin, duration: evt.start - currentMin, type: 'Running' });
    }
    segments.push(evt);
    currentMin = evt.start + evt.duration;
  }
  if (currentMin < totalMin) {
    segments.push({ start: currentMin, duration: totalMin - currentMin, type: 'Running' });
  }

  // Convert to absolute times
  return segments.map((s) => ({
    ...s,
    startHour: shiftStart + s.start / 60,
    endHour: shiftStart + (s.start + s.duration) / 60,
  }));
}

// Format hour (float) to "M/D/YYYY h:mm:ss AM/PM"
function formatSegmentTime(hourFloat, dateStr) {
  const h = Math.floor(hourFloat) % 24;
  const m = Math.round((hourFloat - Math.floor(hourFloat)) * 60);
  const s = Math.round(((hourFloat * 60 - Math.floor(hourFloat * 60)) % 1) * 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month}/${day}/${year} ${h12}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${ampm}`;
}

// Format duration in minutes to readable string
function formatDuration(minutes) {
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h} h ${rm} m ${s} s`;
  }
  return `${m} m ${s} s`;
}

// Generate mock speed data for a segment
function generateSegmentSpeeds(segment, designSpeed, seed) {
  const rng = createRNG(seed + 200);
  if (segment.type === 'Running') {
    const min = Math.round(designSpeed * (0.85 + rng() * 0.1));
    const max = Math.round(designSpeed * (0.98 + rng() * 0.03));
    const avg = Math.round((min + max) / 2 + (rng() - 0.5) * designSpeed * 0.02);
    return {
      design: num(designSpeed) + ' UPH',
      minimum: num(Math.max(0, min)) + ' UPH',
      maximum: num(max) + ' UPH',
      average: num(avg) + ' UPH',
    };
  }
  // Non-running segments have 0 speed
  return {
    design: num(designSpeed) + ' UPH',
    minimum: '0.00 UPH',
    maximum: '0.00 UPH',
    average: '0.00 UPH',
  };
}

// Reason code map for segment types
const REASON_CODES = {
  Running: { code: '0', label: 'Running' },
  Break: { code: '1', label: 'Operator Break' },
  Fault: { code: '2', label: 'Fault / Breakdown' },
  Changeover: { code: '3', label: 'Changeover' },
};

// Custom bar label
function BarLabel({ x, y, width, value, suffix }) {
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      fill="var(--text-secondary)"
      textAnchor="middle"
      fontSize={11}
      fontWeight={600}
    >
      {compact(value)} {suffix || ''}
    </text>
  );
}

// Custom tooltip
function ChartTooltip({ active, payload, label, suffix }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="chart-tooltip-item">
          <span className="chart-tooltip-dot" style={{ background: entry.color }} />
          <span>{entry.name}: {num(entry.value)} {suffix || ''}</span>
        </div>
      ))}
    </div>
  );
}

export default function OperatorDashboardPage() {
  const { selectedPlantId } = useApp();
  const dates = useMemo(() => getAvailableDates(), []);
  const latestDate = dates[dates.length - 1];

  // Selections
  const plantLines = useMemo(() => getLinesByPlant(selectedPlantId), [selectedPlantId]);
  const [selectedLineId, setSelectedLineId] = useState('');
  const activeLineId = selectedLineId || plantLines[0]?.id || '';

  const lineMachines = useMemo(() => getMachinesByLine(activeLineId), [activeLineId]);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const activeMachineId = selectedMachineId || lineMachines[0]?.id || '';
  const activeMachine = machines.find((m) => m.id === activeMachineId);

  const [selectedShift, setSelectedShift] = useState('S1');
  const activeShift = SHIFTS.find((s) => s.id === selectedShift);

  // Timeline detail popup state
  const [selectedSegmentIdx, setSelectedSegmentIdx] = useState(null);
  const popupRef = useRef(null);

  // Get production log for the selected machine + date + shift
  const prodLog = useMemo(() => {
    const logs = filterProductionLogs({
      machineId: activeMachineId,
      dateFrom: latestDate,
      dateTo: latestDate,
      shiftId: selectedShift,
    });
    return logs[0] || null;
  }, [activeMachineId, latestDate, selectedShift]);

  // Get downtime data
  const dtLogs = useMemo(() => {
    return filterDowntimeLogs({
      machineId: activeMachineId,
      dateFrom: latestDate,
      dateTo: latestDate,
    });
  }, [activeMachineId, latestDate]);

  // Shift time parameters
  const shiftStartHour = parseInt(activeShift.start.split(':')[0], 10);
  const shiftHours = activeShift.hours;
  const target = activeMachine ? activeMachine.designSpeed * shiftHours : 750000;

  // Generate hourly data
  const hourlyData = useMemo(() => {
    if (!prodLog) return [];
    const seed = prodLog.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const processedPerHour = splitIntoHours(prodLog.totalCount, shiftHours, seed);
    const rejectsPerHour = splitIntoHours(prodLog.totalCount - prodLog.goodCount, shiftHours, seed + 7);

    return processedPerHour.map((processed, i) => {
      const hour = (shiftStartHour + i) % 24;
      const label = `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
      return {
        label,
        hour,
        processed,
        rejects: rejectsPerHour[i],
        good: processed - rejectsPerHour[i],
      };
    });
  }, [prodLog, shiftStartHour, shiftHours]);

  // Cumulative good production for line chart
  const goodProductionData = useMemo(() => {
    if (!hourlyData.length) return [];
    let cumGood = 0;
    const targetPerHour = target / shiftHours;
    return hourlyData.map((h, i) => {
      cumGood += h.good;
      const targetCum = targetPerHour * (i + 1);
      // Estimate: project from current rate
      const rate = cumGood / (i + 1);
      const estimate = rate * shiftHours;
      return {
        label: h.label,
        goodProduction: cumGood,
        target: Math.round(targetCum),
        estimate: i === hourlyData.length - 1 ? Math.round(estimate) : undefined,
      };
    });
  }, [hourlyData, target, shiftHours]);

  // Estimate line — extends from current to end of shift
  const estimateData = useMemo(() => {
    if (!goodProductionData.length) return [];
    const lastIdx = goodProductionData.length - 1;
    const currentGood = goodProductionData[lastIdx].goodProduction;
    const rate = currentGood / goodProductionData.length;
    return goodProductionData.map((d, i) => ({
      ...d,
      estimate: Math.round(rate * (i + 1)),
    }));
  }, [goodProductionData]);

  // Timeline segments
  const timeline = useMemo(() => {
    if (!prodLog) return [];
    const seed = prodLog.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return generateTimeline(shiftStartHour, shiftHours, prodLog.downtime, seed);
  }, [prodLog, shiftStartHour, shiftHours]);

  // Totals
  const totalProcessed = hourlyData.reduce((s, h) => s + h.processed, 0);
  const totalRejects = hourlyData.reduce((s, h) => s + h.rejects, 0);
  const totalGood = hourlyData.reduce((s, h) => s + h.good, 0);

  // Close popup when clicking outside
  useEffect(() => {
    if (selectedSegmentIdx === null) return;
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setSelectedSegmentIdx(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selectedSegmentIdx]);

  // Selected segment detail data
  const selectedSegment = selectedSegmentIdx !== null ? timeline[selectedSegmentIdx] : null;
  const segmentSpeeds = useMemo(() => {
    if (!selectedSegment || !activeMachine) return null;
    const seed = (selectedSegmentIdx + 1) * 31 + activeMachine.designSpeed;
    return generateSegmentSpeeds(selectedSegment, activeMachine.designSpeed, seed);
  }, [selectedSegment, selectedSegmentIdx, activeMachine]);

  const plantName = plants.find((p) => p.id === selectedPlantId)?.name || '';
  const lineName = lines.find((l) => l.id === activeLineId)?.name || '';
  const machineName = activeMachine?.name || '';

  // Hour tick labels for timeline
  const timelineTicks = Array.from({ length: shiftHours + 1 }, (_, i) => {
    const h = (shiftStartHour + i) % 24;
    return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`;
  });

  const timelineColors = {
    Running: '#10b981',
    Break: '#f59e0b',
    Fault: '#ef4444',
    Changeover: '#3b82f6',
  };

  return (
    <div className="operator-dashboard">
      {/* Breadcrumb & Selectors */}
      <div className="op-header">
        <div className="op-breadcrumb">
          <span>{plantName}</span>
          <ChevronRight size={14} />
          <select
            value={activeLineId}
            onChange={(e) => { setSelectedLineId(e.target.value); setSelectedMachineId(''); }}
            className="op-select"
          >
            {plantLines.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <ChevronRight size={14} />
          <select
            value={activeMachineId}
            onChange={(e) => setSelectedMachineId(e.target.value)}
            className="op-select"
          >
            {lineMachines.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="op-controls">
          <select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
            className="op-select"
          >
            {SHIFTS.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.start} - {s.end})</option>
            ))}
          </select>
          <div className="op-date-badge">
            {latestDate} : {activeShift.start} - {activeShift.end}
          </div>
        </div>
      </div>

      {/* Charts — all stacked vertically with same time axis */}
      <div className="op-charts-stack">
        {/* Processed Bar Chart */}
        <div className="card op-chart-card">
          <div className="card-header">
            <div>
              <div className="card-title">Processed : {num(totalProcessed)} Units</div>
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyData} margin={{ top: 25, right: 20, bottom: 5, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} interval={0} />
                <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={compact} width={50} />
                <Tooltip content={<ChartTooltip suffix="u" />} />
                <Bar dataKey="processed" name="Processed" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList
                    dataKey="processed"
                    position="top"
                    formatter={(v) => compact(v) + ' u'}
                    style={{ fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 600 }}
                  />
                  {hourlyData.map((_, i) => (
                    <Cell key={i} fill={`hsl(210, 80%, ${35 + (i % 3) * 8}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rejects Bar Chart */}
        <div className="card op-chart-card">
          <div className="card-header">
            <div>
              <div className="card-title">Total Rejects : {num(totalRejects)} Units</div>
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyData} margin={{ top: 25, right: 20, bottom: 5, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} interval={0} />
                <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={compact} width={50} />
                <Tooltip content={<ChartTooltip suffix="u" />} />
                <Legend />
                <Bar dataKey="rejects" name="Total Rejects" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList
                    dataKey="rejects"
                    position="top"
                    formatter={(v) => num(v) + ' u'}
                    style={{ fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Good Production Line Chart */}
        <div className="card op-chart-card">
          <div className="card-header">
            <div>
              <div className="card-title">
                Good Production : {num(totalGood)} Units &nbsp; Target : {num(target)} Units
              </div>
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={estimateData} margin={{ top: 15, right: 20, bottom: 5, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} interval={0} />
                <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={compact} width={50} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="goodProduction"
                  name="Good Production"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#3b82f6' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  name="Target"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="estimate"
                  name="Estimate"
                  stroke="var(--text-tertiary)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="card op-timeline-card">
        <div className="card-header">
          <div><div className="card-title">Timeline</div></div>
          <div className="op-timeline-legend">
            {Object.entries(timelineColors).map(([label, color]) => (
              <span key={label} className="op-legend-item">
                <span className="op-legend-dot" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="card-body">
          <div className="op-timeline">
            <div className="op-timeline-bar">
              {timeline.map((seg, i) => {
                const widthPct = (seg.duration / (shiftHours * 60)) * 100;
                return (
                  <div
                    key={i}
                    className={`op-timeline-segment ${selectedSegmentIdx === i ? 'op-timeline-segment--active' : ''}`}
                    style={{
                      width: `${widthPct}%`,
                      background: timelineColors[seg.type] || '#64748b',
                      cursor: 'pointer',
                    }}
                    title={`${seg.type} — ${seg.duration} min`}
                    onClick={() => setSelectedSegmentIdx(selectedSegmentIdx === i ? null : i)}
                  >
                    {widthPct > 6 && (
                      <span className="op-timeline-label">{seg.type}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="op-timeline-ticks">
              {timelineTicks.map((t, i) => (
                <span key={i} className="op-timeline-tick">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Detail Modal — fixed center of viewport */}
      {selectedSegment && (
        <div className="op-detail-overlay" onClick={() => setSelectedSegmentIdx(null)}>
          <div className="op-detail-popup" ref={popupRef} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="op-detail-header">
              <span className="op-detail-title">
                Select reason ({lineName} &gt; {machineName})
              </span>
              <button
                className="op-detail-close"
                onClick={() => setSelectedSegmentIdx(null)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Mini timeline at top */}
            <div className="op-detail-mini-timeline">
              <div className="op-detail-date">
                {latestDate} {activeShift.start}
              </div>
              <div className="op-detail-date" style={{ textAlign: 'right' }}>
                {latestDate} {activeShift.end}
              </div>
            </div>
            <div className="op-timeline-bar op-detail-bar">
              {timeline.map((seg, i) => {
                const widthPct = (seg.duration / (shiftHours * 60)) * 100;
                return (
                  <div
                    key={i}
                    className={`op-timeline-segment ${selectedSegmentIdx === i ? 'op-timeline-segment--active' : ''}`}
                    style={{
                      width: `${widthPct}%`,
                      background: timelineColors[seg.type] || '#64748b',
                      cursor: 'pointer',
                      opacity: selectedSegmentIdx === i ? 1 : 0.4,
                    }}
                    onClick={() => setSelectedSegmentIdx(i)}
                  />
                );
              })}
            </div>

            {/* Three-column detail */}
            <div className="op-detail-columns">
              {/* Reason Detail */}
              <div className="op-detail-section">
                <div className="op-detail-nav-row">
                  <button
                    className="op-detail-nav-btn"
                    disabled={selectedSegmentIdx <= 0}
                    onClick={() => setSelectedSegmentIdx((prev) => Math.max(0, prev - 1))}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <h4 className="op-detail-section-title">Reason detail</h4>
                  <button
                    className="op-detail-nav-btn"
                    disabled={selectedSegmentIdx >= timeline.length - 1}
                    onClick={() => setSelectedSegmentIdx((prev) => Math.min(timeline.length - 1, prev + 1))}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="op-detail-reason">
                  <span
                    className="op-detail-status-dot"
                    style={{ background: timelineColors[selectedSegment.type] }}
                  />
                  <span>{selectedSegment.type}</span>
                </div>
                <div className="op-detail-code">
                  {REASON_CODES[selectedSegment.type]?.code} : {REASON_CODES[selectedSegment.type]?.label}
                </div>

                <div className="op-detail-times">
                  <div className="op-detail-time-row">
                    <span className="op-detail-time-icon">&#x23F5;</span>
                    <span className="op-detail-time-label">From</span>
                    <span className="op-detail-time-value">
                      {formatSegmentTime(selectedSegment.startHour, latestDate)}
                    </span>
                  </div>
                  <div className="op-detail-time-row">
                    <span className="op-detail-time-value" style={{ marginLeft: 'auto' }}>
                      {formatSegmentTime(selectedSegment.endHour, latestDate)}
                    </span>
                    <span className="op-detail-time-label">To</span>
                    <span className="op-detail-time-icon">&#x23F9;</span>
                  </div>
                </div>
                <div className="op-detail-duration">
                  <strong>Duration</strong> {formatDuration(selectedSegment.duration)}
                </div>
              </div>

              {/* Speeds */}
              <div className="op-detail-section op-detail-section--bordered">
                <h4 className="op-detail-section-title">Speeds</h4>
                {segmentSpeeds && (
                  <div className="op-detail-speeds">
                    <div className="op-detail-speed-row">
                      <span className="op-detail-speed-label">Design</span>
                      <span className="op-detail-speed-value">{segmentSpeeds.design}</span>
                    </div>
                    <div className="op-detail-speed-row">
                      <span className="op-detail-speed-label">Minimum</span>
                      <span className="op-detail-speed-value">{segmentSpeeds.minimum}</span>
                    </div>
                    <div className="op-detail-speed-row">
                      <span className="op-detail-speed-label">Maximum</span>
                      <span className="op-detail-speed-value">{segmentSpeeds.maximum}</span>
                    </div>
                    <div className="op-detail-speed-row">
                      <span className="op-detail-speed-label">Average</span>
                      <span className="op-detail-speed-value">{segmentSpeeds.average}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Comment */}
              <div className="op-detail-section op-detail-section--bordered">
                <h4 className="op-detail-section-title">Comment</h4>
                <div className="op-detail-comment">
                  <div className="op-detail-comment-row">
                    <span className="op-detail-comment-label">User</span>
                    <span className="op-detail-comment-value">—</span>
                  </div>
                  <div className="op-detail-comment-row">
                    <span className="op-detail-comment-label">Predefined comment</span>
                    <span className="op-detail-comment-value">—</span>
                  </div>
                  <div className="op-detail-comment-row">
                    <span className="op-detail-comment-label">User comment</span>
                    <span className="op-detail-comment-value">—</span>
                  </div>
                </div>
                <div className="op-detail-line-impact">
                  - Line impact
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="summary-bar">
        <div className="summary-item">
          <span className="summary-label">Processed</span>
          <span className="summary-value">{num(totalProcessed)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Good</span>
          <span className="summary-value" style={{ color: 'var(--accent-green)' }}>{num(totalGood)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Rejects</span>
          <span className="summary-value" style={{ color: 'var(--accent-red)' }}>{num(totalRejects)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Target</span>
          <span className="summary-value">{num(target)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Machine</span>
          <span className="summary-value">{machineName}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Downtime</span>
          <span className="summary-value">{prodLog ? `${prodLog.downtime} min` : '—'}</span>
        </div>
      </div>
    </div>
  );
}
