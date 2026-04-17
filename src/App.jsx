/**
 * EIT™ Application Router
 * ========================
 * Central routing configuration with layout wrapper.
 */

import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import KPIDetailPage from './pages/KPIDetailPage';
import MachineAnalyticsPage from './pages/MachineAnalyticsPage';
import SimulationPage from './pages/SimulationPage';
import ReportsPage from './pages/ReportsPage';
import AdminPage from './pages/AdminPage';
import OperatorDashboardPage from './pages/OperatorDashboardPage';
import NotificationsPage from './pages/NotificationsPage';
import TicketsPage from './pages/TicketsPage';

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/operator" element={<OperatorDashboardPage />} />
        <Route path="/kpi-detail" element={<KPIDetailPage />} />
        <Route path="/analytics" element={<MachineAnalyticsPage />} />
        <Route path="/simulation" element={<SimulationPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </AppLayout>
  );
}
