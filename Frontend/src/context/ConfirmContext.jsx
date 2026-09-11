/**
 * ConfirmContext.jsx
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Replaces the browser's native `confirm()` popup (used previously
 *   for every "Delete this?" prompt) with the app's own styled dialog --
 *   same visual language as the rest of the app, with a clearly red
 *   "Delete" button instead of an unstyled OS-native popup.
 *
 *   Usage, anywhere in the tree:
 *     const confirmDelete = useConfirm();
 *     async function handleDelete() {
 *       const ok = await confirmDelete({
 *         title: 'Delete this lead?',
 *         message: `"${lead.name}" will be permanently removed. This cannot be undone.`,
 *       });
 *       if (!ok) return;
 *       ...
 *     }
 */

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { title, message, confirmLabel, cancelLabel }
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        title: options?.title || 'Are you sure?',
        message: options?.message || 'This action cannot be undone.',
        confirmLabel: options?.confirmLabel || 'Delete',
        cancelLabel: options?.cancelLabel || 'Cancel',
      });
    });
  }, []);

  function settle(result) {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={() => settle(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm animate-[fadeIn_0.15s_ease-out] rounded-lg border border-line bg-canvas p-6 shadow-popover dark:border-line-dark dark:bg-canvas-dark"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10">
                <AlertTriangle size={18} className="text-danger" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-base font-medium text-ink dark:text-ink-invert">{state.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft dark:text-ink-invert/60">{state.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => settle(false)}
                className="rounded px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-canvas-muted hover:text-ink dark:text-ink-invert/70 dark:hover:bg-canvas-dark-muted dark:hover:text-ink-invert"
              >
                {state.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => settle(true)}
                autoFocus
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

/** Returns an async `confirm(options) => Promise<boolean>` function. */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
