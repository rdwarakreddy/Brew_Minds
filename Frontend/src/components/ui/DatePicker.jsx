/**
 * DatePicker.jsx
 * ---------------------------------------------------------------------
 * PURPOSE
 *   A fully custom date picker replacing the browser's native
 *   <input type="date">, whose calendar popup can't be restyled and
 *   looks completely out of place next to the rest of the app. Value
 *   in/out is still a plain "YYYY-MM-DD" string, so every existing
 *   call site (forms, filters) works with the same shape as before.
 *
 * DESIGN
 *   A text-like trigger button (rounded, padded, orange focus ring)
 *   opens a small month-grid calendar popover -- visually related to
 *   the bigger Calendar component used in the Meetings section, but
 *   compact enough to live inside a form field.
 */

import { useEffect, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABEL = { month: 'long', year: 'numeric' };

function parseValue(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(value) {
  const date = parseValue(value);
  if (!date) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DatePicker({ value, onChange, placeholder = 'Select date', className = '', min, max }) {
  const [isOpen, setIsOpen] = useState(false);
  const [cursor, setCursor] = useState(() => parseValue(value) || new Date());
  const containerRef = useRef(null);

  useEffect(() => {
    if (value) setCursor(parseValue(value));
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function startOfWeek(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  function navigateMonth(delta) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  function isDisabled(date) {
    const key = formatValue(date);
    if (min && key < min) return true;
    if (max && key > max) return true;
    return false;
  }

  function selectDate(date) {
    if (isDisabled(date)) return;
    onChange(formatValue(date));
    setIsOpen(false);
  }

  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const selected = parseValue(value);
  const todayKey = formatValue(new Date());

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-canvas py-2.5 pl-4 pr-3 text-left text-sm transition-colors dark:bg-canvas-dark-muted ${
          isOpen ? 'border-brass ring-1 ring-brass' : 'border-line hover:border-brass/50 dark:border-line-dark'
        }`}
      >
        <span className={value ? 'text-ink dark:text-ink-invert' : 'text-ink-soft/70'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <CalendarIcon size={15} className="shrink-0 text-brass" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-72 rounded-lg border border-line bg-canvas p-3 shadow-popover dark:border-line-dark dark:bg-canvas-dark">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className="rounded-full p-1 text-ink-soft hover:bg-canvas-muted hover:text-brass dark:hover:bg-canvas-dark-muted"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-ink dark:text-ink-invert">
              {cursor.toLocaleDateString(undefined, MONTH_LABEL)}
            </span>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className="rounded-full p-1 text-ink-soft hover:bg-canvas-muted hover:text-brass dark:hover:bg-canvas-dark-muted"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="py-1 text-[11px] font-medium text-ink-soft/70">
                {d}
              </span>
            ))}
            {cells.map((date) => {
              const key = formatValue(date);
              const isCurrentMonth = date.getMonth() === cursor.getMonth();
              const isSelected = selected && key === formatValue(selected);
              const isToday = key === todayKey;
              const disabled = isDisabled(date);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDate(date)}
                  className={`aspect-square rounded-md text-xs transition-colors ${
                    !isCurrentMonth ? 'text-ink-soft/30' : 'text-ink dark:text-ink-invert'
                  } ${
                    isSelected
                      ? 'bg-brass font-semibold text-white'
                      : isToday
                        ? 'border border-brass/50 font-medium'
                        : 'hover:bg-canvas-muted dark:hover:bg-canvas-dark-muted'
                  } ${disabled ? 'cursor-not-allowed opacity-30' : ''}`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => selectDate(new Date())}
            className="mt-2 w-full rounded-md py-1.5 text-center text-xs font-medium text-brass hover:bg-brass/10"
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}
