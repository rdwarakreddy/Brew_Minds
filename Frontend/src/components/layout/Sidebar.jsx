/**
 * Sidebar.jsx
 * ---------------------------------------------------------------------
 * The dark-black left panel described in the brief:
 *   TOP    - company name + notification bell
 *   MIDDLE - every section's navigation link, each with an icon
 *   BOTTOM - dark/light toggle, collapse toggle, user name + logout
 *
 * Collapsing (via SidebarContext) hides labels and shrinks the panel to
 * an icon rail, giving more room to the working area on the right --
 * the toggle button itself lives down here at the bottom, next to
 * logout, exactly as specified.
 */

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Target,
  Users,
  Briefcase,
  Wallet,
  CalendarDays,
  History,
  CheckSquare,
  FileText,
  Receipt,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSidebar } from '../../context/SidebarContext';
import NotificationBell from './NotificationBell';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: Target },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/projects', label: 'Projects', icon: Briefcase },
  { to: '/payments', label: 'Payments', icon: Wallet },
  { to: '/meetings', label: 'Meetings', icon: CalendarDays, end: true },
  { to: '/meetings/history', label: 'Meeting History', icon: History },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/invoices', label: 'Invoices', icon: Receipt },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isOpen, toggleSidebar, isMobileOpen, toggleMobileSidebar, closeMobileSidebar } = useSidebar();

  // On a phone/tablet (< lg) the sidebar is an off-canvas drawer: fully
  // hidden until `isMobileOpen`, then shown at full width with labels --
  // the icon-only "collapsed" state only makes sense once there's a
  // permanent gutter of screen to spare, i.e. at `lg` and up.
  const showLabels = isOpen || isMobileOpen;

  return (
    <>
      {/* ---- Mobile backdrop: tap outside the drawer to close it ------- */}
      {isMobileOpen && (
        <div
          onClick={closeMobileSidebar}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px] lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-panel transition-transform duration-200 lg:transition-[width] lg:duration-200 lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${showLabels ? 'w-64' : 'w-64 lg:w-[76px]'}`}
      >
        {/* ---- Top: company name + bell -------------------------------- */}
        <div className="flex h-16 items-center justify-between border-b border-panel-line px-4">
          {showLabels ? (
            <>
              <span className="truncate font-display text-base font-medium text-ink-invert">
                Brew Minds
              </span>
              <div className="flex items-center gap-1">
                <NotificationBell />
                <button
                  onClick={closeMobileSidebar}
                  className="rounded-full p-2 text-ink-invert/70 hover:bg-panel-raised hover:text-ink-invert lg:hidden"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="mx-auto">
              <NotificationBell />
            </div>
          )}
        </div>

        {/* ---- Middle: navigation ---------------------------------------- */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeMobileSidebar}
              title={!showLabels ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-ink-invert text-panel shadow-premium'
                    : 'text-ink-invert/60 hover:bg-panel-raised hover:text-ink-invert'
                } ${showLabels ? '' : 'justify-center'}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} strokeWidth={2} className={`shrink-0 ${isActive ? 'text-brass' : ''}`} />
                  {showLabels && <span className="truncate">{label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ---- Bottom: toggles + user + logout --------------------------- */}
        <div className="space-y-3 border-t border-panel-line px-3 py-4">
          <div className={`flex items-center gap-2 ${showLabels ? 'justify-between' : 'flex-col'}`}>
            <button
              onClick={toggleTheme}
              title="Toggle dark / light mode"
              className="flex items-center justify-center rounded-full bg-panel-raised p-2 text-ink-invert/70 transition-colors hover:text-ink-invert"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {/* Collapse/expand only applies at desktop widths -- hidden on
                mobile, where the drawer's open/closed state (the X above
                and the hamburger in the top bar) already covers this. */}
            <button
              onClick={toggleSidebar}
              title="Collapse / expand panel"
              className="hidden items-center justify-center rounded-full bg-panel-raised p-2 text-ink-invert/70 transition-colors hover:text-ink-invert lg:flex"
            >
              {isOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>
          </div>

          <div className={`flex items-center gap-3 ${showLabels ? '' : 'flex-col'}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brass text-xs font-semibold text-panel">
              {(user?.name || '?').charAt(0).toUpperCase()}
            </div>
            {showLabels && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-invert">{user?.name}</p>
                <p className="truncate text-xs text-ink-invert/50">{user?.email}</p>
              </div>
            )}
            <button
              onClick={logout}
              title="Log out"
              className="rounded-full p-1.5 text-ink-invert/50 transition-colors hover:bg-panel-raised hover:text-danger"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
