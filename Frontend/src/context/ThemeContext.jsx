/**
 * ThemeContext.jsx
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Drives the small dark/light toggle at the bottom of the sidebar.
 *   We add/remove a `dark` class on <html> (Tailwind's `darkMode:
 *   'class'` strategy) so every component can simply use `dark:`
 *   variant classes instead of each component managing its own theme
 *   state. Preference persists across visits via localStorage, and we
 *   fall back to the user's OS-level preference on first visit.
 */

import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
