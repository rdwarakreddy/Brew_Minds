/**
 * AppLayout.jsx
 * ---------------------------------------------------------------------
 * Wraps every authenticated page: fixed dark Sidebar on the left, and
 * the white scrollable canvas (`<Outlet />` -- the active section's
 * page) on the right. The content area's left margin shifts to match
 * the sidebar's current width so nothing is ever hidden behind it --
 * that margin only applies at `lg` and up. Below that, the sidebar is
 * an off-canvas drawer (see Sidebar.jsx) opened via the hamburger
 * button in the mobile top bar here, and the content area runs full
 * width with no margin.
 */

import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { useSidebar } from '../../context/SidebarContext';

export default function AppLayout() {
  const { isOpen, toggleMobileSidebar } = useSidebar();

  return (
    <div className="min-h-screen bg-canvas dark:bg-canvas-dark">
      <Sidebar />

      {/* ---- Mobile top bar: hamburger to open the drawer -------------- */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-canvas px-4 dark:border-line-dark dark:bg-canvas-dark lg:hidden">
        <button
          onClick={toggleMobileSidebar}
          className="rounded-lg p-2 text-ink-soft hover:bg-canvas-muted hover:text-ink dark:text-ink-invert/60 dark:hover:bg-canvas-dark-muted dark:hover:text-ink-invert"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <span className="font-display text-base font-medium text-ink dark:text-ink-invert">Brew Minds</span>
      </header>

      <main className={`min-h-screen transition-[margin] duration-200 ${isOpen ? 'lg:ml-64' : 'lg:ml-[76px]'}`}>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
