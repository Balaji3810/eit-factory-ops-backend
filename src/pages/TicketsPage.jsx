/**
 * EIT™ Tickets Page
 * ==================
 * Full-featured ticket management — list, filter, create, view detail,
 * edit, status transitions, and delete. Data backed by in-memory store.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  ClipboardList, Plus, X, Search, AlertTriangle, Clock,
  CheckCircle2, PauseCircle, Archive, Pencil, Trash2,
  ChevronRight, Filter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  getTickets, addTicket, updateTicket, deleteTicket, getTicketById,
  TICKET_TYPES, TICKET_PRIORITIES, TICKET_STATUSES, ASSIGNEES,
  getStatusLabel,
} from '../data/tickets';
import { machines, getLinesByPlant, getMachinesByLine, getMachinesByPlant } from '../data/mock';
import { DOWNTIME_CATEGORIES } from '../data/config';
import { StatusBadge, DataTable } from '../components/Common';
import { dateStr } from '../utils/format';

// ---------------------------------------------------------------------------
// Status transition map
// ---------------------------------------------------------------------------
const TRANSITIONS = {
  open: [
    { to: 'in_progress', label: 'Start Work', icon: ChevronRight },
    { to: 'on_hold', label: 'Put On Hold', icon: PauseCircle },
  ],
  in_progress: [
    { to: 'resolved', label: 'Resolve', icon: CheckCircle2 },
    { to: 'on_hold', label: 'Put On Hold', icon: PauseCircle },
  ],
  on_hold: [
    { to: 'in_progress', label: 'Resume', icon: ChevronRight },
    { to: 'open', label: 'Reopen', icon: Clock },
  ],
  resolved: [
    { to: 'closed', label: 'Close', icon: Archive },
    { to: 'in_progress', label: 'Reopen', icon: ChevronRight },
  ],
  closed: [
    { to: 'open', label: 'Reopen', icon: Clock },
  ],
};

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'on_hold', label: 'On Hold' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
];

const EMPTY_FORM = {
  title: '', description: '', type: 'Maintenance', category: 'Mechanical Failure',
  priority: 'medium', plantId: '', lineId: '', machineId: '',
  assignee: '', dueDate: '', estimatedHours: '', notes: '',
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function TicketsPage() {
  const { selectedPlantId } = useApp();

  // Data
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const allTickets = useMemo(() => getTickets(), [version]); // eslint-disable-line

  // Filters & tabs
  const [tab, setTab] = useState('all');
  const [filters, setFilters] = useState({ priority: '', type: '', assignee: '' });
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ---------- Filtered data ----------
  const filtered = useMemo(() => {
    let items = allTickets.filter((t) => t.plantId === selectedPlantId);
    if (tab !== 'all') items = items.filter((t) => t.status === tab);
    if (filters.priority) items = items.filter((t) => t.priority === filters.priority);
    if (filters.type) items = items.filter((t) => t.type === filters.type);
    if (filters.assignee) items = items.filter((t) => t.assignee === filters.assignee);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter((t) =>
        t.id.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q) ||
        (machines.find((m) => m.id === t.machineId)?.name || '').toLowerCase().includes(q),
      );
    }
    return items;
  }, [allTickets, selectedPlantId, tab, filters, searchTerm]);

  // ---------- Summary stats ----------
  const plantTickets = useMemo(() => allTickets.filter((t) => t.plantId === selectedPlantId), [allTickets, selectedPlantId]);
  const openCount = plantTickets.filter((t) => t.status === 'open').length;
  const inProgressCount = plantTickets.filter((t) => t.status === 'in_progress').length;

  const today = new Date().toISOString().split('T')[0];
  const overdueCount = plantTickets.filter((t) =>
    (t.status === 'open' || t.status === 'in_progress') && t.dueDate < today,
  ).length;

  const resolvedTickets = plantTickets.filter((t) => t.resolvedAt && t.createdAt);
  const avgResolution = resolvedTickets.length > 0
    ? resolvedTickets.reduce((sum, t) => sum + (new Date(t.resolvedAt) - new Date(t.createdAt)) / 3600000, 0) / resolvedTickets.length
    : 0;

  // ---------- Tab counts ----------
  const tabCount = (id) => {
    const pt = plantTickets;
    if (id === 'all') return pt.length;
    return pt.filter((t) => t.status === id).length;
  };

  // ---------- Cascading filters for form ----------
  const formLines = useMemo(() => getLinesByPlant(formData.plantId || selectedPlantId), [formData.plantId, selectedPlantId]);
  const formMachines = useMemo(
    () => formData.lineId ? getMachinesByLine(formData.lineId) : getMachinesByPlant(formData.plantId || selectedPlantId),
    [formData.plantId, formData.lineId, selectedPlantId],
  );

  // ---------- Handlers ----------
  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  const openCreate = () => {
    setFormData({ ...EMPTY_FORM, plantId: selectedPlantId });
    setEditMode(false);
    setShowCreate(true);
  };

  const openDetail = (ticket) => {
    setDetailId(ticket.id);
    setEditMode(false);
    setConfirmDelete(false);
  };

  const openEdit = () => {
    const t = getTicketById(detailId);
    if (!t) return;
    setFormData({
      title: t.title, description: t.description, type: t.type,
      category: t.category, priority: t.priority, plantId: t.plantId,
      lineId: t.lineId, machineId: t.machineId, assignee: t.assignee,
      dueDate: t.dueDate, estimatedHours: t.estimatedHours || '',
      notes: t.notes || '',
    });
    setEditMode(true);
  };

  const handleCreate = () => {
    if (!formData.title.trim()) return;
    addTicket({
      ...formData,
      plantId: formData.plantId || selectedPlantId,
      estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : null,
    });
    setShowCreate(false);
    refresh();
  };

  const handleSaveEdit = () => {
    if (!formData.title.trim()) return;
    updateTicket(detailId, {
      ...formData,
      estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : null,
    });
    setEditMode(false);
    refresh();
  };

  const handleTransition = (toStatus) => {
    updateTicket(detailId, { status: toStatus });
    refresh();
  };

  const handleDelete = () => {
    deleteTicket(detailId);
    setDetailId(null);
    setConfirmDelete(false);
    refresh();
  };

  const updateField = (key, val) => {
    setFormData((f) => {
      const next = { ...f, [key]: val };
      if (key === 'plantId') { next.lineId = ''; next.machineId = ''; }
      if (key === 'lineId') { next.machineId = ''; }
      return next;
    });
  };

  const detailTicket = detailId ? getTicketById(detailId) : null;
  const detailMachine = detailTicket ? machines.find((m) => m.id === detailTicket.machineId) : null;

  // ---------- Table columns ----------
  const columns = [
    { key: 'id', label: 'ID', width: '100px', render: (v) => <span className="tkt-id">{v}</span> },
    { key: 'title', label: 'Title', render: (v) => <span className="tkt-title-cell">{v}</span> },
    { key: 'priority', label: 'Priority', width: '100px', render: (v) => <StatusBadge status={v} label={v} /> },
    { key: 'status', label: 'Status', width: '110px', render: (v) => <StatusBadge status={v} label={getStatusLabel(v)} /> },
    { key: 'type', label: 'Type', width: '110px' },
    { key: 'machineName', label: 'Machine', width: '130px' },
    { key: 'assignee', label: 'Assignee', width: '120px' },
    {
      key: 'createdAt', label: 'Created', width: '110px',
      render: (v) => dateStr(new Date(v)),
    },
    {
      key: 'dueDate', label: 'Due', width: '110px',
      render: (v, row) => {
        const overdue = (row.status === 'open' || row.status === 'in_progress') && v < today;
        return <span className={overdue ? 'tkt-overdue' : ''}>{dateStr(new Date(v + 'T00:00:00'))}</span>;
      },
    },
  ];

  const tableData = filtered.map((t) => ({
    ...t,
    machineName: machines.find((m) => m.id === t.machineId)?.name || t.machineId,
  }));

  // ---------- Render ----------
  return (
    <div className="tickets-page">
      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="toolbar-left">
          <ClipboardList size={18} />
          <span className="toolbar-label">Tickets</span>
        </div>
        <div className="toolbar-right">
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={14} /> New Ticket
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="notif-summary">
        <div className="notif-summary-item">
          <span className="notif-summary-val">{openCount}</span>
          <span className="notif-summary-label">Open</span>
        </div>
        <div className="notif-summary-item notif-summary-warning">
          <span className="notif-summary-val">{inProgressCount}</span>
          <span className="notif-summary-label">In Progress</span>
        </div>
        <div className="notif-summary-item notif-summary-critical">
          <span className="notif-summary-val">{overdueCount}</span>
          <span className="notif-summary-label">Overdue</span>
        </div>
        <div className="notif-summary-item notif-summary-info">
          <span className="notif-summary-val">{avgResolution > 0 ? `${Math.round(avgResolution)}h` : '—'}</span>
          <span className="notif-summary-label">Avg Resolution</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="tkt-filters">
        <Filter size={14} />
        <select className="dash-select" value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>
          <option value="">All Priorities</option>
          {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="dash-select" value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
          <option value="">All Types</option>
          {TICKET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="dash-select" value={filters.assignee} onChange={(e) => setFilter('assignee', e.target.value)}>
          <option value="">All Assignees</option>
          {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar">
        {TABS.map(({ id, label }) => (
          <button key={id} className={`tab-item ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
            <span className="notif-tab-count">{tabCount(id)}</span>
          </button>
        ))}
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={tableData}
        onRowClick={openDetail}
        pageSize={12}
      />

      {/* =================== CREATE MODAL =================== */}
      {showCreate && (
        <div className="tkt-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="tkt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tkt-modal-header">
              <span>New Ticket</span>
              <button className="tkt-modal-close" onClick={() => setShowCreate(false)}><X size={16} /></button>
            </div>
            <div className="tkt-modal-body">
              {renderForm(formData, updateField, formLines, formMachines, selectedPlantId)}
            </div>
            <div className="tkt-modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreate} disabled={!formData.title.trim()}>Create Ticket</button>
            </div>
          </div>
        </div>
      )}

      {/* =================== DETAIL MODAL =================== */}
      {detailTicket && !editMode && (
        <div className="tkt-modal-overlay" onClick={() => setDetailId(null)}>
          <div className="tkt-modal tkt-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="tkt-modal-header">
              <span>{detailTicket.id}</span>
              <button className="tkt-modal-close" onClick={() => setDetailId(null)}><X size={16} /></button>
            </div>
            <div className="tkt-modal-body">
              {/* Title & Status */}
              <h3 className="tkt-detail-title">{detailTicket.title}</h3>
              <div className="tkt-detail-badges">
                <StatusBadge status={detailTicket.priority} label={detailTicket.priority} />
                <StatusBadge status={detailTicket.status} label={getStatusLabel(detailTicket.status)} />
                <span className="tkt-detail-type">{detailTicket.type}</span>
              </div>

              {/* Status Actions */}
              <div className="tkt-actions">
                {(TRANSITIONS[detailTicket.status] || []).map(({ to, label, icon: Icon }) => (
                  <button key={to} className="btn-secondary" onClick={() => handleTransition(to)}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>

              {/* Detail Grid */}
              <div className="tkt-detail-grid">
                <div className="tkt-detail-field">
                  <span className="tkt-detail-label">Description</span>
                  <span className="tkt-detail-value tkt-detail-full">{detailTicket.description || '—'}</span>
                </div>
                <div className="tkt-detail-field">
                  <span className="tkt-detail-label">Machine</span>
                  <span className="tkt-detail-value">{detailMachine?.name || detailTicket.machineId}</span>
                </div>
                <div className="tkt-detail-field">
                  <span className="tkt-detail-label">Category</span>
                  <span className="tkt-detail-value">{detailTicket.category}</span>
                </div>
                <div className="tkt-detail-field">
                  <span className="tkt-detail-label">Assignee</span>
                  <span className="tkt-detail-value">{detailTicket.assignee || '—'}</span>
                </div>
                <div className="tkt-detail-field">
                  <span className="tkt-detail-label">Reporter</span>
                  <span className="tkt-detail-value">{detailTicket.reporter}</span>
                </div>
                <div className="tkt-detail-field">
                  <span className="tkt-detail-label">Created</span>
                  <span className="tkt-detail-value">{dateStr(new Date(detailTicket.createdAt))}</span>
                </div>
                <div className="tkt-detail-field">
                  <span className="tkt-detail-label">Due Date</span>
                  <span className={`tkt-detail-value ${(detailTicket.status === 'open' || detailTicket.status === 'in_progress') && detailTicket.dueDate < today ? 'tkt-overdue' : ''}`}>
                    {dateStr(new Date(detailTicket.dueDate + 'T00:00:00'))}
                  </span>
                </div>
                <div className="tkt-detail-field">
                  <span className="tkt-detail-label">Est. Hours</span>
                  <span className="tkt-detail-value">{detailTicket.estimatedHours || '—'}</span>
                </div>
                <div className="tkt-detail-field">
                  <span className="tkt-detail-label">Actual Hours</span>
                  <span className="tkt-detail-value">{detailTicket.actualHours || '—'}</span>
                </div>
                {detailTicket.resolvedAt && (
                  <div className="tkt-detail-field">
                    <span className="tkt-detail-label">Resolved At</span>
                    <span className="tkt-detail-value">{dateStr(new Date(detailTicket.resolvedAt))}</span>
                  </div>
                )}
                {detailTicket.notes && (
                  <div className="tkt-detail-field tkt-detail-full-row">
                    <span className="tkt-detail-label">Notes</span>
                    <span className="tkt-detail-value">{detailTicket.notes}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="tkt-modal-footer">
              {confirmDelete ? (
                <>
                  <span className="tkt-confirm-text">Delete this ticket?</span>
                  <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
                  <button className="btn-danger" onClick={handleDelete}>Confirm Delete</button>
                </>
              ) : (
                <>
                  <button className="btn-secondary tkt-btn-danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={14} /> Delete
                  </button>
                  <div style={{ flex: 1 }} />
                  <button className="btn-secondary" onClick={openEdit}>
                    <Pencil size={14} /> Edit
                  </button>
                  <button className="btn-secondary" onClick={() => setDetailId(null)}>Close</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================== EDIT MODAL =================== */}
      {detailTicket && editMode && (
        <div className="tkt-modal-overlay" onClick={() => { setEditMode(false); }}>
          <div className="tkt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tkt-modal-header">
              <span>Edit {detailTicket.id}</span>
              <button className="tkt-modal-close" onClick={() => setEditMode(false)}><X size={16} /></button>
            </div>
            <div className="tkt-modal-body">
              {renderForm(formData, updateField, formLines, formMachines, selectedPlantId)}
            </div>
            <div className="tkt-modal-footer">
              <button className="btn-secondary" onClick={() => setEditMode(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveEdit} disabled={!formData.title.trim()}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form renderer (shared between create and edit)
// ---------------------------------------------------------------------------
function renderForm(form, update, lines, machinesToShow, defaultPlantId) {
  return (
    <div className="tkt-form">
      <div className="tkt-form-row">
        <label className="tkt-form-label">Title *</label>
        <input className="tkt-form-input" type="text" value={form.title}
          onChange={(e) => update('title', e.target.value)} placeholder="Short description of the issue" />
      </div>
      <div className="tkt-form-row">
        <label className="tkt-form-label">Description</label>
        <textarea className="tkt-form-textarea" value={form.description}
          onChange={(e) => update('description', e.target.value)} rows={3} placeholder="Detailed description..." />
      </div>
      <div className="tkt-form-grid">
        <div className="tkt-form-row">
          <label className="tkt-form-label">Type</label>
          <select className="tkt-form-select" value={form.type} onChange={(e) => update('type', e.target.value)}>
            {TICKET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="tkt-form-row">
          <label className="tkt-form-label">Category</label>
          <select className="tkt-form-select" value={form.category} onChange={(e) => update('category', e.target.value)}>
            {DOWNTIME_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="tkt-form-row">
          <label className="tkt-form-label">Priority</label>
          <select className="tkt-form-select" value={form.priority} onChange={(e) => update('priority', e.target.value)}>
            {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="tkt-form-row">
          <label className="tkt-form-label">Assignee</label>
          <select className="tkt-form-select" value={form.assignee} onChange={(e) => update('assignee', e.target.value)}>
            <option value="">Unassigned</option>
            {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <div className="tkt-form-grid">
        <div className="tkt-form-row">
          <label className="tkt-form-label">Line</label>
          <select className="tkt-form-select" value={form.lineId} onChange={(e) => update('lineId', e.target.value)}>
            <option value="">All Lines</option>
            {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="tkt-form-row">
          <label className="tkt-form-label">Machine</label>
          <select className="tkt-form-select" value={form.machineId} onChange={(e) => update('machineId', e.target.value)}>
            <option value="">Select Machine</option>
            {machinesToShow.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="tkt-form-row">
          <label className="tkt-form-label">Due Date</label>
          <input className="tkt-form-input" type="date" value={form.dueDate} onChange={(e) => update('dueDate', e.target.value)} />
        </div>
        <div className="tkt-form-row">
          <label className="tkt-form-label">Est. Hours</label>
          <input className="tkt-form-input" type="number" min="0" step="0.5" value={form.estimatedHours}
            onChange={(e) => update('estimatedHours', e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="tkt-form-row">
        <label className="tkt-form-label">Notes</label>
        <textarea className="tkt-form-textarea" value={form.notes}
          onChange={(e) => update('notes', e.target.value)} rows={2} placeholder="Additional notes..." />
      </div>
    </div>
  );
}
