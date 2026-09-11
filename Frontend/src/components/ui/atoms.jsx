/**
 * atoms.jsx
 * ---------------------------------------------------------------------
 * Tiny, frequently reused pieces that don't warrant their own file:
 * a section page header, an empty-state placeholder, a status badge,
 * and a loading spinner.
 */

export function PageHeader({ icon: Icon, title, description, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 rounded-xl bg-brass/10 p-2.5 dark:bg-canvas-dark-muted">
            <Icon size={20} className="text-brass" />
          </div>
        )}
        <div>
          <h1 className="font-display text-xl font-medium text-ink dark:text-ink-invert sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-soft dark:text-ink-invert/60">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-16 text-center dark:border-line-dark">
      {Icon && <Icon size={28} className="mb-3 text-ink-soft/50" />}
      <p className="font-display text-base font-medium text-ink dark:text-ink-invert">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-ink-soft dark:text-ink-invert/60">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const BADGE_TONES = {
  neutral: 'bg-canvas-muted text-ink-soft dark:bg-canvas-dark-muted dark:text-ink-invert/70',
  brass: 'bg-brass/10 text-brass-dark dark:text-brass-light',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  warning: 'bg-warning/10 text-warning',
};

export function Badge({ children, tone = 'neutral' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function DetailList({ items }) {
  return (
    <dl className="divide-y divide-line dark:divide-line-dark">
      {items
        .filter((item) => item.hidden !== true)
        .map((item, i) => (
          <div key={i} className="grid grid-cols-3 gap-4 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-soft dark:text-ink-invert/50">
              {item.label}
            </dt>
            <dd className="col-span-2 text-sm text-ink dark:text-ink-invert">{item.value ?? '—'}</dd>
          </div>
        ))}
    </dl>
  );
}

export function Spinner({ size = 20 }) {
  return (
    <div
      className="animate-spin rounded-full border-2 border-line border-t-brass dark:border-line-dark"
      style={{ width: size, height: size }}
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-canvas dark:bg-canvas-dark">
      <Spinner size={28} />
    </div>
  );
}
