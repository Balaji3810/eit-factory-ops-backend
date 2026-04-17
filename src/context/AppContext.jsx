/**
 * EIT™ Application Context
 * =========================
 * Global state: selected plant, theme, KPI weights/thresholds.
 * Provides a single context for cross-cutting state so deeply nested
 * components can read/write without prop drilling.
 */

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { plants } from '../data/mock';
import { SCORING_WEIGHTS, KPI_THRESHOLDS } from '../data/config';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Theme
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('eit-theme');
    return stored || 'dark';
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('eit-theme', next);
      return next;
    });
  }, []);

  // Selected plant
  const [selectedPlantId, setSelectedPlantId] = useState(plants[0].id);
  const selectedPlant = useMemo(
    () => plants.find((p) => p.id === selectedPlantId) || plants[0],
    [selectedPlantId],
  );

  // KPI configuration (overridable at runtime via Admin page)
  const [kpiWeights, setKpiWeights] = useState(SCORING_WEIGHTS);
  const [kpiThresholds, setKpiThresholds] = useState(KPI_THRESHOLDS);

  // Sidebar collapsed
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarCollapsed((p) => !p), []);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      selectedPlantId,
      setSelectedPlantId,
      selectedPlant,
      kpiWeights,
      setKpiWeights,
      kpiThresholds,
      setKpiThresholds,
      sidebarCollapsed,
      toggleSidebar,
    }),
    [
      theme, toggleTheme, selectedPlantId, selectedPlant,
      kpiWeights, kpiThresholds, sidebarCollapsed, toggleSidebar,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      <div data-theme={theme}>
        {children}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}
