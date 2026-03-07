import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth';

// ============================================
// NAVIGATION STRUCTURE
// ============================================

interface SubItem {
  label: string;
  to?: string;
  soon?: boolean;
  pro?: boolean;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
  sub?: SubItem[];
  soon?: boolean;
  pro?: boolean;
}

interface NavGroup {
  label: string;
  color: string;
  items: NavItem[];
  pro?: boolean;
}

const NAV: NavGroup[] = [
  {
    label: 'Dashboard',
    color: 'bg-emerald-400',
    items: [
      {
        to: '/', label: 'Nadzorna plošča', icon: <IcDashboard />, end: true,
        sub: [
          { label: 'Pregled dneva', to: '/' },
          { label: 'KPI', to: '/' },
          { label: 'Današnje rezervacije', to: '/reservations' },
          { label: 'Aktivna čakalna', to: '/waitlist' },
        ],
      },
    ],
  },
  {
    label: 'Operativa',
    color: 'bg-blue-400',
    items: [
      {
        to: '/reservations', label: 'Rezervacije', icon: <IcCalendar />,
        sub: [
          { label: 'Seznam', to: '/reservations' },
          { label: 'Koledar', soon: true },
          { label: 'Statusi', to: '/reservations' },
          { label: 'Bulk akcije', soon: true },
        ],
      },
      {
        to: '/floor-plan', label: 'Tloris', icon: <IcFloorPlan />,
        sub: [
          { label: 'Live view', to: '/floor-plan' },
          { label: 'Urejanje miz', to: '/floor-plan' },
          { label: 'Združevanje miz', to: '/floor-plan' },
          { label: 'Conflict highlight', soon: true },
        ],
      },
      {
        to: '/waitlist', label: 'Čakalna vrsta', icon: <IcClock />,
        sub: [
          { label: 'Aktivna', to: '/waitlist' },
          { label: 'Zgodovina', soon: true },
          { label: 'Samodejno obveščanje', soon: true },
        ],
      },
    ],
  },
  {
    label: 'CRM',
    color: 'bg-violet-400',
    items: [
      {
        to: '/guests', label: 'Gosti', icon: <IcUsers />,
        sub: [
          { label: 'Seznam', to: '/guests' },
          { label: 'Profili', to: '/guests' },
          { label: 'Oznake', to: '/guests' },
          { label: 'Zgodovina obiskov', to: '/guests' },
          { label: 'VIP segment', soon: true },
        ],
      },
      {
        to: '/vouchers', label: 'Darilni boni', icon: <IcGift />,
        sub: [
          { label: 'Aktivni', to: '/vouchers' },
          { label: 'Unovčeni', to: '/vouchers' },
          { label: 'Ustvari nov', to: '/vouchers' },
          { label: 'Statistika', to: '/vouchers' },
        ],
      },
    ],
  },
  {
    label: 'Finance',
    color: 'bg-amber-400',
    items: [
      {
        to: '/payments', label: 'Plačila', icon: <IcCreditCard />,
        sub: [
          { label: 'Depoziti', to: '/payments' },
          { label: 'No-show stroški', to: '/payments' },
          { label: 'Transakcije', to: '/payments' },
          { label: 'Refund', soon: true },
        ],
      },
      {
        to: '/reports', label: 'Poročila', icon: <IcChart />, soon: true,
        sub: [
          { label: 'Zasedenost', soon: true },
          { label: 'Prihodki', soon: true },
          { label: 'Analitika gostov', soon: true },
          { label: 'Peak hours', soon: true },
        ],
      },
    ],
  },
  {
    label: 'Marketing',
    color: 'bg-pink-400',
    pro: true,
    items: [
      {
        to: '/campaigns', label: 'Kampanje', icon: <IcMail />, pro: true,
        sub: [
          { label: 'Email gostom', pro: true },
          { label: 'SMS obvestila', pro: true },
          { label: 'Ponovni obisk', pro: true },
        ],
      },
    ],
  },
  {
    label: 'Admin',
    color: 'bg-gray-400',
    items: [
      {
        to: '/settings', label: 'Nastavitve', icon: <IcSettings />,
        sub: [
          { label: 'Restavracija', to: '/settings' },
          { label: 'Delovni čas', to: '/settings' },
          { label: 'Mize', to: '/floor-plan' },
          { label: 'Integracije', soon: true },
          { label: 'Uporabniki', to: '/users' },
          { label: 'Vloge & pravice', soon: true },
        ],
      },
    ],
  },
];

// ============================================
// LAYOUT
// ============================================

export function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleExpand = (key: string) => {
    setExpandedItem(prev => prev === key ? null : key);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside
        className={`
          ${collapsed ? 'w-[62px]' : 'w-[252px]'}
          bg-[#0c0f14] text-white flex flex-col flex-shrink-0
          transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]
          border-r border-white/[0.04]
        `}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3.5 h-[56px] border-b border-white/[0.04] flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
            <span className="text-[13px] font-extrabold text-white tracking-tight">Y</span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white leading-tight tracking-tight">YourTable</p>
                <p className="text-[10px] text-gray-500 leading-tight truncate">{user?.tenant?.name}</p>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="w-6 h-6 rounded flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 19l-7-7 7-7M18 19l-7-7 7-7"/></svg>
              </button>
            </>
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-auto mt-2 w-7 h-5 rounded flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 5l7 7-7 7M4 5l7 7-7 7"/></svg>
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'none' }}>
          {NAV.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-3.5' : ''}>
              {/* Group label */}
              {collapsed ? (
                <div className="mx-3 mb-2 mt-1">
                  <div className={`h-[2px] rounded-full ${group.color} opacity-25`} />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-4 mb-1">
                  <div className={`w-1 h-1 rounded-full ${group.color}`} />
                  <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-gray-600">
                    {group.label}
                  </span>
                  {group.pro && (
                    <span className="text-[7px] font-extrabold px-1.5 py-[1px] rounded-full bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-400/80 border border-amber-500/15 uppercase tracking-widest ml-auto">
                      Pro+
                    </span>
                  )}
                </div>
              )}

              {/* Items */}
              <div className="space-y-px px-2">
                {group.items.map(item => {
                  const isActive = item.end
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to);
                  const itemKey = `${group.label}:${item.label}`;
                  const isExpanded = expandedItem === itemKey;
                  const hasSub = item.sub && item.sub.length > 0;
                  const isDisabled = item.soon || item.pro;

                  return (
                    <div key={itemKey}>
                      <div
                        className={`
                          flex items-center gap-2 rounded-md text-[13px] font-medium transition-all duration-100 relative cursor-pointer select-none
                          ${collapsed ? 'px-0 py-[7px] justify-center' : 'px-2 py-[7px]'}
                          ${isDisabled
                            ? 'text-gray-600/60 cursor-default'
                            : isActive
                              ? 'bg-white/[0.07] text-white'
                              : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
                          }
                        `}
                        onClick={() => {
                          if (isDisabled) return;
                          if (!collapsed && hasSub) toggleExpand(itemKey);
                          navigate(item.to);
                        }}
                        title={collapsed ? item.label : undefined}
                      >
                        {isActive && !isDisabled && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3.5 bg-emerald-400 rounded-r-full" />
                        )}

                        <span className={`flex-shrink-0 ${isActive && !isDisabled ? 'text-emerald-400' : ''}`}>
                          {item.icon}
                        </span>

                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.soon && <Badge type="soon" />}
                            {item.pro && !item.soon && <Badge type="pro" />}
                            {hasSub && !isDisabled && (
                              <svg
                                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                className={`flex-shrink-0 text-gray-600 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                              >
                                <path d="M9 18l6-6-6-6" />
                              </svg>
                            )}
                          </>
                        )}
                      </div>

                      {/* Sub-items */}
                      {!collapsed && hasSub && isExpanded && !isDisabled && (
                        <div className="ml-[21px] pl-2.5 border-l border-white/[0.06] mt-px mb-1.5 space-y-px">
                          {item.sub!.map(sub => {
                            const subDisabled = sub.soon || sub.pro;
                            return (
                              <div
                                key={sub.label}
                                onClick={() => { if (!subDisabled && sub.to) navigate(sub.to); }}
                                className={`
                                  flex items-center gap-1.5 px-2 py-[5px] rounded text-[12px] transition-colors
                                  ${subDisabled
                                    ? 'text-gray-600/50 cursor-default'
                                    : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.03] cursor-pointer'
                                  }
                                `}
                              >
                                <span className="truncate">{sub.label}</span>
                                {sub.soon && <Badge type="soon" small />}
                                {sub.pro && <Badge type="pro" small />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-white/[0.04] p-2.5 flex-shrink-0">
          {collapsed ? (
            <button onClick={handleLogout} className="w-full flex justify-center" title={`${user?.name} — Odjava`}>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-[11px] font-bold text-emerald-400">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-2.5 px-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-[11px] font-bold text-emerald-400 flex-shrink-0">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-gray-200 truncate leading-tight">{user?.name}</p>
                <p className="text-[10px] text-gray-500 truncate leading-tight capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-6 h-6 rounded flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-white/5 transition-colors flex-shrink-0"
                title="Odjava"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

// ============================================
// BADGE COMPONENT
// ============================================

function Badge({ type, small }: { type: 'soon' | 'pro'; small?: boolean }) {
  const base = small ? 'text-[6px] px-1 py-px' : 'text-[7px] px-1.5 py-[1px]';
  if (type === 'soon') {
    return <span className={`${base} font-bold rounded bg-white/[0.05] text-gray-600 uppercase tracking-wider ml-auto flex-shrink-0`}>Soon</span>;
  }
  return <span className={`${base} font-bold rounded bg-amber-500/10 text-amber-500/70 uppercase tracking-wider ml-auto flex-shrink-0`}>Pro</span>;
}

// ============================================
// ICONS
// ============================================

function IcDashboard() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>;
}
function IcCalendar() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><rect x="7" y="14" width="3" height="3" rx="0.5"/></svg>;
}
function IcFloorPlan() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="8" cy="8" r="2"/><circle cx="16" cy="8" r="2"/><rect x="6" y="14" width="4" height="4" rx="1"/><rect x="14" y="14" width="4" height="4" rx="1"/></svg>;
}
function IcClock() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>;
}
function IcUsers() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
}
function IcGift() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,12 20,22 4,22 4,12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>;
}
function IcCreditCard() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="5" y1="15" x2="8" y2="15"/></svg>;
}
function IcChart() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
}
function IcMail() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,4 12,13 2,4"/></svg>;
}
function IcSettings() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>;
}
