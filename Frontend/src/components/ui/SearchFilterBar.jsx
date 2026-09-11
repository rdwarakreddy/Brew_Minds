/**
 * SearchFilterBar.jsx
 * ---------------------------------------------------------------------
 * The search bar + inline filter dropdowns that sit above the Leads,
 * Projects, Tasks, Documents and Invoices lists/boards. `filters` is an
 * array describing each dropdown so every section can declare its own
 * filters (status, source, project...) without duplicating the layout.
 * Filter dropdowns use the same custom Dropdown component as every form
 * field in the app, instead of a native <select>.
 */

import { Search } from 'lucide-react';
import Dropdown from './Dropdown';

export default function SearchFilterBar({ search, onSearchChange, placeholder, filters = [] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[240px] flex-1">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder || 'Search...'}
          className="w-full rounded-lg border border-line bg-canvas py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-ink-soft/50 focus:border-brass focus:ring-1 focus:ring-brass dark:border-line-dark dark:bg-canvas-dark-muted dark:text-ink-invert"
        />
      </div>

      {filters.map((filter) => (
        <Dropdown
          key={filter.name}
          value={filter.value}
          onChange={filter.onChange}
          placeholder={filter.placeholder}
          className="w-48"
          options={[{ value: '', label: filter.placeholder }, ...filter.options]}
        />
      ))}
    </div>
  );
}
