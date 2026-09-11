/**
 * ToastContext.jsx
 * ---------------------------------------------------------------------
 * PURPOSE
 *   A single, app-wide place to surface success/error feedback. Before
 *   this existed, several forms (Invoices, Payments, Meetings,
 *   Documents...) would fail validation on the server and the request
 *   would simply reject -- nothing told the person WHY nothing
 *   happened, so a perfectly working "Save" button looked broken.
 *
 *   Call `useToast()` anywhere and use `showError` / `showSuccess`.
 *   `getErrorMessage(err)` pulls the backend's `{ error: "..." }`
 *   message out of an axios error, falling back to something readable
 *   if the request never reached the server at all (offline, a
 *   service down, CORS, etc).
 */

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

// Pulls a human-readable message out of any error thrown by an
// apiClient call. Centralised here so every form in the app reports
// failures the same, helpful way instead of a blank screen or a raw
// "Network Error" string.
export function getErrorMessage(err) {
  if (!err) return 'Something went wrong. Please try again.';
  if (err.response?.data?.error) return err.response.data.error;
  if (err.response?.status === 413) return 'That file is too large.';
  if (err.response?.status >= 500) return 'Something went wrong on our end. Please try again in a moment.';
  if (err.message === 'Network Error') {
    return 'Could not reach the server. Check your connection and that the backend is running.';
  }
  return err.message || 'Something went wrong. Please try again.';
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, tone) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => dismiss(id), 6000);
      return id;
    },
    [dismiss]
  );

  const showError = useCallback((messageOrErr) => {
    const message = typeof messageOrErr === 'string' ? messageOrErr : getErrorMessage(messageOrErr);
    return push(message, 'error');
  }, [push]);

  const showSuccess = useCallback((message) => push(message, 'success'), [push]);

  return (
    <ToastContext.Provider value={{ showError, showSuccess, dismiss }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-popover animate-[fadeIn_0.15s_ease-out] ${
              t.tone === 'error'
                ? 'border-danger/20 bg-canvas text-danger dark:bg-canvas-dark'
                : 'border-success/20 bg-canvas text-success dark:bg-canvas-dark'
            }`}
          >
            {t.tone === 'error' ? (
              <XCircle size={17} className="mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            )}
            <p className="flex-1 leading-snug text-ink dark:text-ink-invert">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-ink-soft transition-colors hover:text-ink dark:text-ink-invert/50 dark:hover:text-ink-invert"
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
