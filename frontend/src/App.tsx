import { useEffect } from 'react';
import { useTripStore } from './store/tripStore';
import { Dashboard } from './components/Dashboard/Dashboard';
import { ActiveTrip } from './components/ActiveTrip/ActiveTrip';
import { TripHistory } from './components/TripHistory/TripHistory';
import { TripDetail } from './components/TripDetail/TripDetail';
import { Settings } from './components/Settings/Settings';
import { Spritmonitor } from './components/Spritmonitor/Spritmonitor';
import { ClassifyModal } from './components/ui/ClassifyModal';

type View = 'dashboard' | 'active' | 'history' | 'detail' | 'settings' | 'fuel';

const NAV_ITEMS: { view: View; icon: string; label: string }[] = [
  { view: 'dashboard', icon: '🏠', label: 'Dashboard' },
  { view: 'active', icon: '🚗', label: 'Fahrt' },
  { view: 'history', icon: '📋', label: 'Fahrten' },
  { view: 'fuel', icon: '⛽', label: 'Sprit' },
  { view: 'settings', icon: '⚙️', label: 'Einstellungen' },
];

export default function App() {
  const { view, setView, loadSettings, loadStats, isTracking, classifyModalTrip } = useTripStore();

  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  function renderView() {
    switch (view) {
      case 'dashboard': return <Dashboard />;
      case 'active': return <ActiveTrip />;
      case 'history': return <TripHistory />;
      case 'detail': return <TripDetail />;
      case 'settings': return <Settings />;
      case 'fuel': return <Spritmonitor />;
      default: return <Dashboard />;
    }
  }

  return (
    <div className="app-layout">
      {/* Desktop Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🚗</div>
          <span className="sidebar-logo-text">MyAuto</span>
        </div>
        {NAV_ITEMS.map(item => (
          <div
            key={item.view}
            className={`nav-item ${view === item.view || (item.view === 'active' && view === 'active') ? 'active' : ''}`}
            onClick={() => setView(item.view)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.view === 'active' && isTracking && (
              <span style={{
                marginLeft: 'auto',
                width: 8, height: 8,
                borderRadius: '50%',
                background: 'var(--green)',
                animation: 'pulse 2s ease-in-out infinite',
                display: 'inline-block',
              }} />
            )}
          </div>
        ))}
      </nav>

      {/* Main content */}
      <main className="main-content">
        {renderView()}
      </main>

      {/* Mobile Tab Bar */}
      <nav className="tab-bar">
        {NAV_ITEMS.map(item => (
          <div
            key={item.view}
            className={`tab-item ${view === item.view ? 'active' : ''}`}
            onClick={() => setView(item.view)}
          >
            <div className="tab-icon" style={{ position: 'relative' }}>
              {item.icon}
              {item.view === 'active' && isTracking && (
                <span style={{
                  position: 'absolute', top: -2, right: -4,
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: 'var(--green)',
                  animation: 'pulse 2s ease-in-out infinite',
                  display: 'block',
                }} />
              )}
            </div>
            <span className="tab-label">{item.label}</span>
          </div>
        ))}
      </nav>

      {/* Classify modal */}
      {classifyModalTrip && <ClassifyModal />}
    </div>
  );
}
