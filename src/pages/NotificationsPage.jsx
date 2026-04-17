/**
 * EIT™ Notifications Page
 * ========================
 * Surfaces factory alerts derived from production & downtime data —
 * KPI breaches, unplanned downtime, chronic low performance, and maintenance.
 */

import { useMemo, useState } from 'react';
import {
  Bell, BellOff, AlertTriangle, Info, Search,
  CheckCircle2, Mail, MailOpen,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge, EmptyState } from '../components/Common';
import { generateNotifications } from '../utils/notifications';

const TABS = [
  { id: 'all',      label: 'All',      icon: Bell },
  { id: 'critical', label: 'Critical', icon: AlertTriangle },
  { id: 'warning',  label: 'Warning',  icon: AlertTriangle },
  { id: 'info',     label: 'Info',     icon: Info },
];

const CATEGORY_LABELS = {
  kpi_breach: 'KPI Breach',
  downtime: 'Downtime',
  performance: 'Performance',
  maintenance: 'Maintenance',
};

export default function NotificationsPage() {
  const { selectedPlantId, kpiThresholds } = useApp();

  const [tab, setTab] = useState('all');
  const [readIds, setReadIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // ------ Derived data ------
  const allNotifications = useMemo(
    () => generateNotifications(selectedPlantId, kpiThresholds),
    [selectedPlantId, kpiThresholds],
  );

  const filteredNotifications = useMemo(() => {
    let items = allNotifications;
    if (tab !== 'all') items = items.filter((n) => n.type === tab);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        n.machineName.toLowerCase().includes(q),
      );
    }
    return items;
  }, [allNotifications, tab, searchTerm]);

  const criticalCount = allNotifications.filter((n) => n.type === 'critical').length;
  const warningCount = allNotifications.filter((n) => n.type === 'warning').length;
  const infoCount = allNotifications.filter((n) => n.type === 'info').length;
  const unreadCount = allNotifications.filter((n) => !readIds.has(n.id)).length;

  const tabCount = (id) =>
    id === 'all' ? allNotifications.length
      : id === 'critical' ? criticalCount
      : id === 'warning' ? warningCount
      : infoCount;

  // ------ Handlers ------
  const toggleRead = (id) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const markAllRead = () => {
    setReadIds(new Set(allNotifications.map((n) => n.id)));
  };

  // ------ Render ------
  return (
    <div className="notifications-page">
      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="toolbar-left">
          <Bell size={18} />
          <span className="toolbar-label">Notifications</span>
          {unreadCount > 0 && (
            <span className="notif-unread-badge">{unreadCount}</span>
          )}
        </div>
        <div className="toolbar-right">
          <div className="table-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-secondary" onClick={markAllRead}>
            <CheckCircle2 size={14} /> Mark all read
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="notif-summary">
        <div className="notif-summary-item">
          <span className="notif-summary-val">{allNotifications.length}</span>
          <span className="notif-summary-label">Total</span>
        </div>
        <div className="notif-summary-item notif-summary-critical">
          <span className="notif-summary-val">{criticalCount}</span>
          <span className="notif-summary-label">Critical</span>
        </div>
        <div className="notif-summary-item notif-summary-warning">
          <span className="notif-summary-val">{warningCount}</span>
          <span className="notif-summary-label">Warning</span>
        </div>
        <div className="notif-summary-item notif-summary-info">
          <span className="notif-summary-val">{infoCount}</span>
          <span className="notif-summary-label">Info</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`tab-item ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={15} />
            {label}
            <span className="notif-tab-count">{tabCount(id)}</span>
          </button>
        ))}
      </div>

      {/* Notification List */}
      {filteredNotifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="No notifications"
          description="All clear for the selected filters."
        />
      ) : (
        <div className="notif-list">
          {filteredNotifications.map((n) => (
            <div
              key={n.id}
              className={`notif-item notif-${n.type} ${readIds.has(n.id) ? 'notif-read' : ''}`}
              onClick={() => toggleRead(n.id)}
            >
              <div className="notif-icon">
                {n.type === 'info' ? <Info size={18} /> : <AlertTriangle size={18} />}
              </div>
              <div className="notif-content">
                <div className="notif-header">
                  <span className="notif-title">{n.title}</span>
                  <StatusBadge status={n.type} label={n.type} />
                </div>
                <div className="notif-message">{n.message}</div>
                <div className="notif-meta">
                  <span>{n.machineName}</span>
                  <span className="notif-meta-sep">|</span>
                  <span>{CATEGORY_LABELS[n.category] || n.category}</span>
                  <span className="notif-meta-sep">|</span>
                  <span>{n.date}</span>
                </div>
              </div>
              <div className="notif-actions">
                <button
                  className="icon-btn"
                  onClick={(e) => { e.stopPropagation(); toggleRead(n.id); }}
                  title={readIds.has(n.id) ? 'Mark unread' : 'Mark read'}
                >
                  {readIds.has(n.id) ? <MailOpen size={14} /> : <Mail size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
