/**
 * Dropdown.jsx
 * ---------------------------------------------------------------------
 * PURPOSE
 *   A fully custom-styled replacement for the native <select> element,
 *   used everywhere in the app (form fields, filters) instead of the
 *   browser's default dropdown chrome -- which can't be restyled
 *   consistently across browsers/OSes and looks out of place next to
 *   the rest of the app's premium visual language.
 *
 * DESIGN
 *   - Generously rounded corners and padding on every side (per the
 *     brief: "colorful design with curves at the edges, right padding
 *     in all the sides").
 *   - The trigger button and open menu both use the app's orange accent
 *     for the focus ring / hover / selected states, never plain grey.
 *   - Keyboard support: Enter/Space opens it, Arrow Up/Down moves the
 *     highlighted option, Enter selects, Escape closes -- so it behaves
 *     like a real form control, not just a styled div.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function Dropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  disabled = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);

  const selected = options.find((opt) => String(opt.value) === String(value));

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function openMenu() {
    if (disabled) return;
    setIsOpen(true);
    const currentIndex = options.findIndex((opt) => String(opt.value) === String(value));
    setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
  }

  function selectOption(opt) {
    onChange(opt.value);
    setIsOpen(false);
  }

  function handleKeyDown(e) {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[highlightedIndex]) selectOption(options[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-canvas py-2.5 pl-4 pr-3 text-left text-sm transition-colors dark:bg-canvas-dark-muted ${
          isOpen
            ? 'border-brass ring-1 ring-brass'
            : 'border-line hover:border-brass/50 dark:border-line-dark'
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      >
        <span className={selected ? 'truncate text-ink dark:text-ink-invert' : 'truncate text-ink-soft/70'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-brass transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-64 overflow-y-auto rounded-lg border border-line bg-canvas p-1.5 shadow-popover dark:border-line-dark dark:bg-canvas-dark">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-soft dark:text-ink-invert/50">No options</p>
          ) : (
            options.map((opt, index) => {
              const isSelected = String(opt.value) === String(value);
              const isHighlighted = index === highlightedIndex;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => selectOption(opt)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-brass/10 font-medium text-brass-dark dark:text-brass-light'
                      : isHighlighted
                        ? 'bg-canvas-muted dark:bg-canvas-dark-muted'
                        : ''
                  } text-ink dark:text-ink-invert`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={14} className="shrink-0 text-brass" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
