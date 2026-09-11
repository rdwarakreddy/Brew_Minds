/**
 * StatCard.jsx
 * ---------------------------------------------------------------------
 * The recurring "big number + label" metric tile used on the Dashboard
 * (Total Amount, Total Paid...), Clients (Total Clients, Ongoing...),
 * and Payments sections. Deliberately flat -- a hairline border instead
 * of a drop shadow, and one accent colour used sparingly on the icon --
 * to avoid the generic "SaaS card kit" look called out in the design
 * guidance.
 */
export default function StatCard({ label, value, icon: Icon, tone = 'default' }) {
  const toneClasses = {
    default: 'text-ink dark:text-ink-invert',
    brass: 'text-brass',
    success: 'text-success',
    danger: 'text-danger',
  };

  return (
    <div className="flex items-start justify-between rounded-xl border border-line bg-canvas p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-premium dark:border-line-dark dark:bg-canvas-dark-muted">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft dark:text-ink-invert/50">
          {label}
        </p>
        <p className={`mt-2 font-numeric text-2xl font-semibold ${toneClasses[tone]}`}>{value}</p>
      </div>
      {Icon && (
        <div className="rounded-full bg-brass/10 p-2.5 dark:bg-canvas-dark">
          <Icon size={18} className="text-brass" />
        </div>
      )}
    </div>
  );
}
