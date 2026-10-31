/**
 * src/layouts/AppLayout.tsx
 * Main authenticated shell in light theme:
 * - Collapsible sidebar + top header
 * - Inter font, #F8FAFC page background, white cards/panels, slate-900/600 text, indigo #4F46E5 primary
 * - RBAC-filtered navigation links
 */
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  CreditCard,
  FileText,
  Receipt,
  DollarSign,
  Percent,
  Calculator,
  BarChart2,
  Settings,
  ShoppingBag,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Bell,
  LogOut,
  User as UserIcon,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { NavItem, UserRole } from '../types';
import { cn } from '../utils/cn';

// ─── Navigation config ─────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',            path: '/dashboard',             icon: 'LayoutDashboard',  roles: ['admin', 'staff'] },
  { label: 'Customers',            path: '/customers',             icon: 'Users',            roles: ['admin', 'staff'] },
  { label: 'Products',             path: '/products',              icon: 'Package',          roles: ['admin', 'staff'] },
  { label: 'Plans',                path: '/plans',                 icon: 'CreditCard',       roles: ['admin', 'staff'] },
  { label: 'Quotation Templates',  path: '/quotations',            icon: 'ShoppingBag',      roles: ['admin', 'staff'] },
  { label: 'Subscriptions',        path: '/subscriptions',         icon: 'Receipt',          roles: ['admin', 'staff'] },
  { label: 'Invoices',             path: '/invoices',              icon: 'FileText',         roles: ['admin', 'staff'] },
  { label: 'Payments',             path: '/payments',              icon: 'DollarSign',       roles: ['admin', 'staff'] },
  { label: 'Discounts',            path: '/discounts',             icon: 'Percent',          roles: ['admin'] },
  { label: 'Taxes',                path: '/taxes',                 icon: 'Calculator',       roles: ['admin'] },
  { label: 'Reports',              path: '/reports',               icon: 'BarChart2',        roles: ['admin', 'staff'] },
  { label: 'Settings',             path: '/settings',              icon: 'Settings',         roles: ['admin'] },
  // Customer-facing routes
  { label: 'My Subscriptions',     path: '/my/subscriptions',      icon: 'Receipt',          roles: ['customer'] },
  { label: 'My Invoices',          path: '/my/invoices',           icon: 'FileText',         roles: ['customer'] },
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, Package, CreditCard, FileText,
  Receipt, DollarSign, Percent, Calculator, BarChart2,
  Settings, ShoppingBag,
};

function NavIcon({ name, className }: { name?: string; className?: string }) {
  const Comp = name ? ICON_MAP[name] : null;
  return Comp ? <Comp className={cn('h-4 w-4 flex-shrink-0', className)} /> : null;
}

// ─── Sidebar link ──────────────────────────────────────────────────────────
function SidebarLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn('sidebar-link', isActive && 'active')
      }
      title={collapsed ? item.label : undefined}
    >
      <NavIcon name={item.icon} />
      {!collapsed && (
        <span className="truncate leading-none">{item.label}</span>
      )}
    </NavLink>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────
function Sidebar({
  collapsed,
  onToggle,
  role,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: () => void;
  role: UserRole;
  onNavigate?: () => void;
}) {
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={cn(
        'flex flex-col bg-white border-r border-slate-200',
        'transition-all duration-200 ease-in-out flex-shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo / brand */}
      <div
        className={cn(
          'flex items-center h-16 px-4 border-b border-slate-200 gap-3 flex-shrink-0',
          collapsed && 'justify-center px-2'
        )}
      >
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary-600 flex-shrink-0 shadow-sm shadow-primary-500/30">
          <span className="text-white text-sm font-bold">S</span>
        </div>
        {!collapsed && (
          <span className="font-bold text-slate-900 text-lg tracking-tight truncate">
            SubSentry
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-1" aria-label="Main navigation">
        {visibleItems.map((item) => (
          <SidebarLink
            key={item.path}
            item={item}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden md:flex items-center justify-end px-3 py-3 border-t border-slate-200">
        <button
          onClick={onToggle}
          className="btn-icon btn-ghost"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}

// ─── Top Header ────────────────────────────────────────────────────────────
function TopHeader({
  onMobileMenuOpen,
}: {
  onMobileMenuOpen: () => void;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = user?.full_name || user?.name || user?.email || 'User';

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 bg-white border-b border-slate-200 flex-shrink-0">
      {/* Mobile hamburger */}
      <button
        className="md:hidden btn-icon btn-ghost"
        onClick={onMobileMenuOpen}
        aria-label="Open navigation menu"
        id="mobile-menu-button"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile logo */}
      <div className="md:hidden flex items-center gap-2">
        <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary-600">
          <span className="text-white text-xs font-bold">S</span>
        </div>
        <span className="font-bold text-slate-900 text-base">SubSentry</span>
      </div>

      {/* Spacer on desktop */}
      <div className="hidden md:block" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Role badge */}
        <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
          {user?.role}
        </span>

        {/* Notification bell (placeholder) */}
        <button
          className="btn-icon btn-ghost relative"
          aria-label="Notifications"
          id="notifications-button"
        >
          <Bell className="h-4 w-4 text-slate-600" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            id="user-menu-button"
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg
                       text-sm text-slate-700 hover:bg-slate-100
                       transition-colors duration-150"
            onClick={() => setUserMenuOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={userMenuOpen}
          >
            <div className="h-8 w-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:flex flex-col items-start leading-none text-left">
              <span className="font-semibold text-slate-900 text-xs truncate max-w-[120px]">{displayName}</span>
              <span className="text-slate-500 text-[11px] capitalize">{user?.role}</span>
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', userMenuOpen && 'rotate-180')} />
          </button>

          {/* Dropdown */}
          {userMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-52 bg-white
                         border border-slate-200 rounded-xl shadow-lg
                         py-1.5 z-30 animate-scale-in"
              role="menu"
              aria-labelledby="user-menu-button"
            >
              <div className="px-3.5 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900 truncate">{displayName}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>
              <button
                role="menuitem"
                className="flex items-center gap-2 w-full px-3.5 py-2 text-xs text-slate-700
                           hover:bg-slate-50 transition-colors"
                onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
              >
                <UserIcon className="h-4 w-4 text-slate-500" /> Account Settings
              </button>
              <button
                role="menuitem"
                className="flex items-center gap-2 w-full px-3.5 py-2 text-xs text-rose-600
                           hover:bg-rose-50 transition-colors"
                onClick={handleLogout}
                id="logout-button"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Mobile Drawer ─────────────────────────────────────────────────────────
function MobileDrawer({
  isOpen,
  onClose,
  role,
}: {
  isOpen: boolean;
  onClose: () => void;
  role: UserRole;
}) {
  const location = useLocation();
  useEffect(() => { onClose(); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex md:hidden" aria-modal="true" role="dialog" aria-label="Navigation drawer">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-72 bg-white border-r border-slate-200 flex flex-col animate-slide-in-left">
        <div className="flex items-center justify-between px-4 h-16 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <span className="font-bold text-slate-900">SubSentry</span>
          </div>
          <button className="btn-icon btn-ghost" onClick={onClose} aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1" aria-label="Mobile navigation">
          {NAV_ITEMS.filter((i) => i.roles.includes(role)).map((item) => (
            <SidebarLink key={item.path} item={item} collapsed={false} onNavigate={onClose} />
          ))}
        </nav>
      </div>
    </div>
  );
}

// ─── AppLayout ─────────────────────────────────────────────────────────────
export function AppLayout() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, user, navigate]);

  if (isLoading || !user) return null;

  return (
    <div className="flex h-dvh bg-[#F8FAFC] overflow-hidden text-slate-900">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          role={user.role}
        />
      </div>

      {/* Mobile drawer */}
      <MobileDrawer
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        role={user.role}
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        <TopHeader onMobileMenuOpen={() => setMobileOpen(true)} />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-in"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
