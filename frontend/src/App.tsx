import { useEffect, useRef, useState } from 'react';
import { useTripStore } from './store/tripStore';
import { Dashboard } from './components/Dashboard/Dashboard';
import { ActiveTrip } from './components/ActiveTrip/ActiveTrip';
import { TripHistory } from './components/TripHistory/TripHistory';
import { TripDetail } from './components/TripDetail/TripDetail';
import { Settings } from './components/Settings/Settings';
import { Spritmonitor } from './components/Spritmonitor/Spritmonitor';
import { Fahrzeuge } from './components/Fahrzeuge/Fahrzeuge';
import { Statistiken } from './components/Statistiken/Statistiken';
import { ClassifyModal } from './components/ui/ClassifyModal';
import { LoginScreen } from './components/Auth/LoginScreen';
import { Karte } from './components/Karte/Karte';
import { ToastContainer } from './components/ui/Toast';
import { api, getToken, onUnauthorized } from './api/client';
import { usePullToRefresh } from './hooks/usePullToRefresh';

type View = 'dashboard' | 'active' | 'history' | 'detail' | 'settings' | 'fuel' | 'fahrzeuge' | 'statistiken' | 'karte';

// Desktop sidebar: all views
const NAV_ITEMS: { view: View; icon: string; label: string }[] = [
  { view: 'dashboard',   icon: '🏠', label: 'Dashboard'    },
  { view: 'history',     icon: '📋', label: 'Fahrten'      },
  { view: 'karte',       icon: '🗺️', label: 'Karte'        },
  { view: 'statistiken', icon: '📊', label: 'Statistiken'  },
  { view: 'fuel',        icon: '⛽', label: 'Sprit'         },
  { view: 'fahrzeuge',   icon: '🚘', label: 'Fahrzeuge'     },
  { view: 'settings',    icon: '⚙️', label: 'Einstellungen' },
];

// Mobile tab bar: max 5 items (Sprit + Karte moved into Fahrzeuge / sidebar)
const MOBILE_NAV: { view: View; icon: string; label: string }[] = [
  { view: 'dashboard',   icon: '🏠', label: 'Dashboard'    },
  { view: 'history',     icon: '📋', label: 'Fahrten'      },
  { view: 'fahrzeuge',   icon: '🚘', label: 'Fahrzeuge'     },
  { view: 'statistiken', icon: '📊', label: 'Statistiken'  },
  { view: 'settings',    icon: '⚙️', label: 'Einstellungen' },
];

export default function App() {
  const { view, setView, loadSettings, loadStats, isTracking, classifyModalTrip } = useTripStore();
  const mainRef = useRef<HTMLElement>(null);

  async function handleRefresh() {
    await Promise.all([loadStats(), loadSettings()]);
  }
  const { pullY, refreshing } = usePullToRefresh(mainRef, handleRefresh);

  function navigate(v: View) {
    if ('startViewTransition' in document) {
      (document as Document & { startViewTransition: (cb: () => void) => void })
        .startViewTransition(() => setView(v));
    } else {
      setView(v);
    }
  }
  // auth: null = checking, false = need login, true = logged in
  const [authState, setAuthState] = useState<{ ready: boolean; pinSet: boolean; loggedIn: boolean }>({
    ready: false, pinSet: false, loggedIn: false,
  });

  useEffect(() => {
    onUnauthorized(() => setAuthState(s => ({ ...s, loggedIn: false })));
    api.getAuthStatus().then(({ pinSet }) => {
      const loggedIn = !pinSet || !!getToken();
      setAuthState({ ready: true, pinSet, loggedIn });
      if (!pinSet || loggedIn) {
        loadSettings();
        loadStats();
      }
    }).catch(() => {
      setAuthState({ ready: true, pinSet: false, loggedIn: true });
      loadSettings();
      loadStats();
    });
  }, []);

  function handleLogin() {
    setAuthState(s => ({ ...s, loggedIn: true }));
    loadSettings();
    loadStats();
  }

  function renderView() {
    switch (view) {
      case 'dashboard': return <Dashboard />;
      case 'active': return <ActiveTrip />;
      case 'history': return <TripHistory />;
      case 'detail': return <TripDetail />;
      case 'settings': return <Settings />;
      case 'fuel': return <Spritmonitor />;
      case 'fahrzeuge': return <Fahrzeuge />;
      case 'statistiken': return <Statistiken />;
      case 'karte': return <Karte />;
      default: return <Dashboard />;
    }
  }

  if (!authState.ready) return null;
  if (!authState.loggedIn) return <LoginScreen pinSet={authState.pinSet} onLogin={handleLogin} />;

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
            className={`nav-item ${view === item.view || (item.view === 'history' && view === 'active') ? 'active' : ''}`}
            onClick={() => navigate(item.view)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.view === 'history' && isTracking && (
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
      <main ref={mainRef} className="main-content" style={{ viewTransitionName: 'main-view' }}>
        {/* Pull-to-refresh indicator */}
        <div
          className={`ptr-indicator${refreshing ? ' ptr-refreshing' : ''}`}
          style={{ '--ptr-y': `${pullY}px` } as React.CSSProperties}
          aria-hidden
        >
          <div className="ptr-spinner" />
        </div>
        <div style={{
          transform: pullY > 0 ? `translateY(${pullY}px)` : undefined,
          transition: pullY === 0 ? 'transform 0.3s ease' : undefined,
        }}>
          {renderView()}
        </div>
      </main>

      {/* Mobile Tab Bar */}
      <nav className="tab-bar">
        {MOBILE_NAV.map(item => (
          <div
            key={item.view}
            className={`tab-item ${view === item.view ? 'active' : ''}`}
            onClick={() => navigate(item.view)}
          >
            <div className="tab-icon" style={{ position: 'relative' }}>
              {item.icon}
              {item.view === 'history' && isTracking && (
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

      {/* Global toast notifications */}
      <ToastContainer />
    </div>
  );
}
