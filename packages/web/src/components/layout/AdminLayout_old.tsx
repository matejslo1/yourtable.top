import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Glavno',
    items: [
      { to: '/', label: 'Nadzorna plošča', icon: <DashboardIcon />, end: true },
    ],
  },
  {
    label: 'Operativa',
    items: [
      { to: '/reservations', label: 'Rezervacije', icon: <CalendarIcon /> },
      { to: '/floor-plan', label: 'Tloris', icon: <FloorPlanIcon /> },
      { to: '/waitlist', label: 'Čakalna vrsta', icon: <ClockIcon /> },
    ],
  },
  {
    label: 'CRM',
    items: [
      { to: '/guests', label: 'Gosti', icon: <UsersIcon /> },
      { to: '/vouchers', label: 'Darilni boni', icon: <GiftIcon /> },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/settings', label: 'Nastavitve', icon: <SettingsIcon /> },
    ],
  },
];

export function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`
          ${collapsed ? 'w-[68px]' : 'w-[240px]'}
          bg-gray-950 text-white flex flex-col flex-shrink-0
          transition-all duration-200 ease-in-out
        `}
      >
        {/* Logo + collapse toggle */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
          <div className={`flex items-center gap-2.5 overflow-hidden ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'} transition-all duration-200`}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-white">Y</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">YourTable</p>
              <p className="text-[10px] text-gray-500 truncate leading-tight">{user?.tenant?.name}</p>
            </div>
          </div>
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 mx-auto">
              <span className="text-sm font-bold text-white">Y</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className={`w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0 ${collapsed ? 'hidden' : ''}`}
            title={collapsed ? 'Razširi' : 'Skrči'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-5' : ''}>
              {/* Group label */}
              <div className={`px-4 mb-1.5 ${collapsed ? 'px-2' : ''}`}>
                {collapsed ? (
                  <div className="h-px bg-white/5 mx-2" />
                ) : (
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-600">
                    {group.label}
                  </p>
                )}
              </div>

              {/* Items */}
              <div className="space-y-0.5 px-2">
                {group.items.map(item => {
                  const isActive = item.end
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      title={collapsed ? item.label : undefined}
                      className={`
                        flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 relative
                        ${collapsed ? 'px-0 py-2 justify-center' : 'px-2.5 py-2'}
                        ${isActive
                          ? 'bg-white/10 text-white'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                        }
                      `}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-emerald-400 rounded-r-full" />
                      )}

                      <span className={`flex-shrink-0 ${isActive ? 'text-emerald-400' : ''}`}>
                        {item.icon}
                      </span>

                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-white/5 p-3">
          {collapsed ? (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center"
              title="Odjava"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center text-xs font-bold text-emerald-400">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center text-xs font-bold text-emerald-400 flex-shrink-0">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate">{user?.name}</p>
                <p className="text-[10px] text-gray-500 truncate capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-white/5 transition-colors flex-shrink-0"
                title="Odjava"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16,17 21,12 16,7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

// ============================================
// SVG ICONS (16x16, consistent style)
// ============================================

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function FloorPlanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <rect x="6" y="6" width="4" height="4" rx="0.5" />
      <rect x="14" y="6" width="4" height="4" rx="0.5" />
      <rect x="6" y="14" width="4" height="4" rx="0.5" />
      <rect x="14" y="14" width="4" height="4" rx="0.5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,12 20,22 4,22 4,12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
