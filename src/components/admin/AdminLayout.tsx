import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ExternalLink,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Settings,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { sanitizeSafeHttpUrl } from '../../lib/validation';

const NAV_ITEMS = [
  { to: '/admin/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/menu', label: 'Menu Management', icon: UtensilsCrossed },
  { to: '/admin/categories', label: 'Categories', icon: FolderKanban },
  { to: '/admin/qr', label: 'QR Code', icon: QrCode },
  { to: '/admin/settings', label: 'Restaurant Settings', icon: Settings },
] as const;

const PAGE_TITLES: Record<string, string> = {
  '/admin/overview': 'Overview',
  '/admin/menu': 'Menu Management',
  '/admin/categories': 'Categories',
  '/admin/qr': 'Universal QR Code',
  '/admin/settings': 'Restaurant Settings',
};

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { restaurant, user, signOut } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Dashboard';
  const menuUrl = restaurant ? `/menu/${encodeURIComponent(restaurant.slug)}` : null;
  const safeLogo = sanitizeSafeHttpUrl(restaurant?.logo_url);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      showToast({ type: 'info', title: 'Signed out', description: 'Your admin session has ended.' });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Logout failed',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setLoggingOut(false);
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#111315] text-zinc-200">
      {/* Brand Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#1B1E22] p-1">
          {safeLogo ? (
            <img
              src={safeLogo}
              alt={restaurant?.name ?? 'Restaurant logo'}
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <UtensilsCrossed className="h-4.5 w-4.5 text-zinc-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {restaurant?.name ?? 'Restaurant Admin'}
          </p>
          <p className="truncate font-mono text-[11px] text-zinc-400">
            /{restaurant?.slug ?? 'menu'}
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Admin navigation" className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#1B4332] text-white shadow-xs'
                  : 'text-zinc-400 hover:bg-white/[0.05] hover:text-white'
              }`
            }
          >
            <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.8} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Account & Logout Footer */}
      <div className="border-t border-white/[0.08] p-3">
        {user?.email && (
          <div className="mb-2 px-3 py-1.5">
            <p className="text-[11px] font-medium text-zinc-500">Administrator</p>
            <p className="truncate text-xs text-zinc-300">{user.email}</p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-60"
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" strokeWidth={1.8} />
          <span>{loggingOut ? 'Signing out...' : 'Logout'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F7F6F3] text-zinc-900">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden w-64 shrink-0 border-r border-zinc-800 lg:block">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 flex lg:hidden">
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
          />
          <div className="relative z-10 w-68 max-w-[82vw] shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-4 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#E6E4DF] bg-[#F7F6F3]/90 px-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E6E4DF] bg-white text-zinc-700 hover:bg-zinc-50 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight text-zinc-900 sm:text-lg">
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {menuUrl && (
              <a
                href={menuUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#E6E4DF] bg-white px-3.5 text-xs font-medium text-zinc-800 transition-colors hover:border-zinc-300 hover:bg-zinc-50 whitespace-nowrap shrink-0"
              >
                <span>Open Public Menu</span>
                <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
              </a>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
