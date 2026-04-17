/**
 * EIT™ Layout Components
 * =======================
 * Sidebar navigation, top header with plant selector, and main layout wrapper.
 */

import { NavLink, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import {
  LayoutDashboard, BarChart3, SlidersHorizontal, FileText,
  Settings, Sun, Moon, Menu, Factory, ChevronDown, Target, Monitor, Bell, ClipboardList,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { plants } from '../data/mock';
import { generateNotifications } from '../utils/notifications';
import { getOpenTicketCount } from '../data/tickets';

const NAV_ITEMS = [
  { to: '/',           label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/operator',   label: 'Line Audit',  icon: Monitor },
  { to: '/kpi-detail', label: 'KPI Detail',  icon: Target },
  { to: '/analytics',  label: 'Analytics',   icon: BarChart3 },
  { to: '/simulation', label: 'Simulation',  icon: SlidersHorizontal },
  { to: '/reports',        label: 'Reports',       icon: FileText },
  { to: '/tickets',       label: 'Tickets',       icon: ClipboardList },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin',         label: 'Admin',         icon: Settings },
];

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
export function Sidebar() {
  const { sidebarCollapsed, selectedPlantId, kpiThresholds } = useApp();
  const location = useLocation();

  const notifBadgeCount = useMemo(() => {
    const notifs = generateNotifications(selectedPlantId, kpiThresholds);
    return notifs.filter((n) => n.type === 'critical' || n.type === 'warning').length;
  }, [selectedPlantId, kpiThresholds]);

  const ticketBadgeCount = getOpenTicketCount(selectedPlantId);

  return (
    <aside className={`eit-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Factory size={20} />
        </div>
        {!sidebarCollapsed && (
          <div className="logo-text">
            <span className="logo-brand">EIT</span>
            <span className="logo-tm">™</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
            title={label}
          >
            <div className="nav-icon-wrapper">
              <Icon size={18} />
              {to === '/notifications' && notifBadgeCount > 0 && (
                <span className="nav-badge">{notifBadgeCount > 99 ? '99+' : notifBadgeCount}</span>
              )}
              {to === '/tickets' && ticketBadgeCount > 0 && (
                <span className="nav-badge">{ticketBadgeCount > 99 ? '99+' : ticketBadgeCount}</span>
              )}
            </div>
            {!sidebarCollapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {!sidebarCollapsed && (
          <div className="sidebar-version">v2.0.0</div>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
export function Header() {
  const {
    theme, toggleTheme, selectedPlantId, setSelectedPlantId,
    sidebarCollapsed, toggleSidebar,
  } = useApp();
  const location = useLocation();

  const pageTitle = NAV_ITEMS.find((n) =>
    n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to),
  )?.label || 'EIT';

  return (
    <header className="eit-header">
      <div className="header-left">
        <button className="icon-btn" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <Menu size={18} />
        </button>
        <h1 className="header-title">{pageTitle}</h1>
      </div>

      <div className="header-right">
        {/* Plant selector */}
        <div className="plant-selector">
          <Factory size={14} />
          <select
            value={selectedPlantId}
            onChange={(e) => setSelectedPlantId(e.target.value)}
          >
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </div>

        {/* Theme toggle */}
        <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* User avatar */}
        <div className="header-avatar">OP</div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// AppLayout — wraps all pages
// ---------------------------------------------------------------------------
export default function AppLayout({ children }) {
  const { sidebarCollapsed } = useApp();

  return (
    <div className={`eit-app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar />
      <div className="eit-main">
        <Header />
        <main className="eit-content">
          {children}
        </main>
      </div>
    </div>
  );
}
