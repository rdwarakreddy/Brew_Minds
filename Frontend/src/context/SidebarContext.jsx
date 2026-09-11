/**
 * SidebarContext.jsx
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Tracks whether the left panel is expanded (icons + labels) or
 *   collapsed (icons only) so the main content area can adjust its
 *   left margin in sync with the toggle button inside the sidebar --
 *   this is the DESKTOP behaviour and is unchanged.
 *
 *   Also tracks a separate `isMobileOpen` flag for small screens, where
 *   the sidebar becomes an off-canvas drawer instead of pushing the
 *   content over (there's no room for that on a phone). The two states
 *   are intentionally independent: collapsing the desktop sidebar
 *   should never affect whether the mobile drawer is open, and vice
 *   versa.
 */

import { createContext, useContext, useState } from 'react';

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        toggleSidebar: () => setIsOpen((v) => !v),
        isMobileOpen,
        toggleMobileSidebar: () => setIsMobileOpen((v) => !v),
        closeMobileSidebar: () => setIsMobileOpen(false),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within a SidebarProvider');
  return ctx;
}
