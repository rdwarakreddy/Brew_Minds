/**
 * Button.jsx
 * ---------------------------------------------------------------------
 * Implements the brief's colour rule directly: on the white canvas,
 * primary buttons are black-on-white; the sidebar (dark panel) uses the
 * inverse -- white-on-black -- via the `onPanel` variant. Kept to a
 * small, deliberate set of variants so buttons stay visually consistent
 * across all nine sections instead of every page inventing its own.
 */

const VARIANTS = {
  primary: 'bg-ink text-canvas hover:bg-black dark:bg-ink-invert dark:text-canvas-dark dark:hover:bg-white',
  secondary:
    'bg-transparent text-ink border border-line hover:bg-canvas-muted dark:text-ink-invert dark:border-line-dark dark:hover:bg-canvas-dark-muted',
  ghost: 'bg-transparent text-ink-soft hover:text-ink dark:hover:text-ink-invert',
  danger: 'bg-danger text-white hover:bg-danger/90',
  onPanel: 'bg-ink-invert text-panel hover:bg-white',
};

const SIZES = {
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-sm px-5 py-2.5 gap-2',
};

export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className = '',
  children,
  ...props
}) {
  return (
    <Component
      className={`inline-flex items-center justify-center rounded font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={16} strokeWidth={2} />}
      {children}
    </Component>
  );
}
