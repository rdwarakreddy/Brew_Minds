/**
 * Modal.jsx
 * ---------------------------------------------------------------------
 * A single, reused modal shell for every "Add Lead" / "Add Client" /
 * "Schedule Meeting" etc. form. Traps the page behind a dim overlay,
 * closes on overlay click or Escape, and keeps the header (title +
 * close button) visually consistent everywhere.
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, size = 'md', headerActions }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 pt-6 backdrop-blur-[2px] sm:p-4 sm:pt-10">
      <div
        className={`w-full ${widths[size]} animate-[fadeIn_0.15s_ease-out] rounded-lg border border-line bg-canvas shadow-popover dark:border-line-dark dark:bg-canvas-dark`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5 dark:border-line-dark sm:px-6 sm:py-4">
          <h2 className="font-display text-base font-medium text-ink dark:text-ink-invert sm:text-lg">{title}</h2>
          <div className="flex items-center gap-1">
            {headerActions}
            <button
              onClick={onClose}
              className="rounded-full p-1 text-ink-soft transition-colors hover:bg-canvas-muted hover:text-ink dark:hover:bg-canvas-dark-muted dark:hover:text-ink-invert"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
      </div>
    </div>
  );
}
