/**
 * TimePicker.jsx
 * ---------------------------------------------------------------------
 * A custom replacement for the native <input type="time">, styled to
 * match DatePicker/Dropdown. Opens a scrollable list of times in
 * 15-minute increments. Value in/out is still a plain "HH:MM" 24-hour
 * string, so it's a drop-in replacement for existing call sites.
 */

import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

function buildTimeOptions() {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const period = h < 12 ? 'AM' : 'PM';
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      options.push({ value, label: `${hour12}:${String(m).padStart(2, '0')} ${period}` });
    }
  }
  return options;
}
const TIME_OPTIONS = buildTimeOptions();

function formatDisplay(value) {
  const match = TIME_OPTIONS.find((o) => o.value === value);
  return match ? match.label : value;
}

export default function TimePicker({ value, onChange, placeholder = 'Select time', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedEl = listRef.current.querySelector('[data-selected="true"]');
      selectedEl?.scrollIntoView({ block: 'center' });
    }
  }, [isOpen]);

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
        <Clock size={15} className="shrink-0 text-brass" />
      </button>

      {isOpen && (
        <div
          ref={listRef}
          className="absolute left-0 top-full z-40 mt-1.5 max-h-56 w-40 overflow-y-auto rounded-lg border border-line bg-canvas p-1.5 shadow-popover dark:border-line-dark dark:bg-canvas-dark"
        >
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              data-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                opt.value === value
                  ? 'bg-brass/10 font-medium text-brass-dark dark:text-brass-light'
                  : 'text-ink hover:bg-canvas-muted dark:text-ink-invert dark:hover:bg-canvas-dark-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
