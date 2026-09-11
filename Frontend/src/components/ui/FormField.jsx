/**
 * FormField.jsx
 * ---------------------------------------------------------------------
 * A small family of labelled form controls shared by every "Add ___"
 * modal across the app (leads, clients, projects, payments, meetings,
 * tasks, documents, invoices) so forms look and behave identically
 * everywhere instead of being rebuilt per-section.
 */

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Dropdown from './Dropdown';
import DatePicker from './DatePicker';
import TimePicker from './TimePicker';

const fieldBase =
  'w-full rounded-lg border border-line bg-canvas px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/50 focus:border-brass focus:ring-1 focus:ring-brass transition-colors dark:bg-canvas-dark-muted dark:border-line-dark dark:text-ink-invert';

function Label({ children, required }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-ink-soft dark:text-ink-invert/60">
      {children}
      {required && <span className="text-danger"> *</span>}
    </label>
  );
}

export function TextField({ label, required, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <Label required={required}>{label}</Label>}
      <input className={fieldBase} {...props} />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

// Same shape as TextField, but always type="password" with a show/hide
// toggle -- used on Login and Register so a mistyped password isn't
// invisible until the account already failed to create/sign in.
export function PasswordField({ label, required, error, className = '', ...props }) {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className={className}>
      {label && <Label required={required}>{label}</Label>}
      <div className="relative">
        <input type={isVisible ? 'text' : 'password'} className={`${fieldBase} pr-11`} {...props} />
        <button
          type="button"
          onClick={() => setIsVisible((v) => !v)}
          tabIndex={-1}
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft/60 transition-colors hover:text-ink dark:text-ink-invert/40 dark:hover:text-ink-invert"
        >
          {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function TextAreaField({ label, required, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <Label required={required}>{label}</Label>}
      <textarea className={`${fieldBase} min-h-[88px] resize-y`} {...props} />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

// NOTE: keeps the same prop shape as a native <input type="date"> (value
// is a "YYYY-MM-DD" string, onChange receives an event-like object with
// .target.value) so every existing call site works unchanged -- only the
// rendered UI (a calendar popover) is custom, not a browser date picker.
export function DateField({ label, required, error, value, onChange, className = '', min, max, placeholder }) {
  return (
    <div className={className}>
      {label && <Label required={required}>{label}</Label>}
      <DatePicker
        value={value}
        onChange={(val) => onChange({ target: { value: val } })}
        min={min}
        max={max}
        placeholder={placeholder}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

// Same drop-in shape as DateField, but for "HH:MM" time values.
export function TimeField({ label, required, error, value, onChange, className = '', placeholder }) {
  return (
    <div className={className}>
      {label && <Label required={required}>{label}</Label>}
      <TimePicker value={value} onChange={(val) => onChange({ target: { value: val } })} placeholder={placeholder} />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

// NOTE: keeps the same prop shape as a native <select> (value, onChange
// receiving a plain string via e.target.value, options=[{value,label}])
// so every existing call site works unchanged -- only the rendered UI is
// a custom, curved, orange-accented dropdown instead of browser chrome.
export function SelectField({ label, required, error, options = [], value, onChange, disabled, className = '' }) {
  return (
    <div className={className}>
      {label && <Label required={required}>{label}</Label>}
      <Dropdown
        value={value}
        onChange={(val) => onChange({ target: { value: val } })}
        options={options}
        disabled={disabled}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
