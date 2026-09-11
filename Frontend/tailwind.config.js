/**
 * tailwind.config.js
 * ---------------------------------------------------------------------
 * DESIGN TOKENS for the Brew Minds Freelancer Platform.
 *
 * Palette rationale (per the brief: dark-black sidebar, white canvas,
 * black buttons on white / white buttons on black, ORANGE for
 * identification -- not yellow):
 *   - panel        (#0A0A0C) - the sidebar's near-black background
 *   - panel-raised (#151517) - hover/active state on top of the panel
 *   - panel-line   (#232326) - hairline dividers inside the dark panel
 *   - canvas       (#FFFFFF) - the main white working area
 *   - canvas-muted (#FBF7F2) - warm off-white for section backgrounds,
 *                              distinguishing "recessed" areas without
 *                              resorting to grey drop-shadow SaaS cards
 *   - ink           (#171412) - primary text on the white canvas
 *   - ink-soft      (#726B63) - secondary/muted text
 *   - line          (#EBE3D8) - hairline borders on the white canvas
 *   - brass         (#D2540A) - THE identification/accent colour: a rich
 *                                burnt orange (never yellow) used for
 *                                active states, key numbers, icons, and
 *                                links throughout the app. Named "brass"
 *                                for historical reasons in the codebase
 *                                but every value below is orange.
 *   - danger        (#B3432F) - overdue tasks / destructive actions
 *   - success        (#3D7A5D) - completed / positive states
 *   - warning        (#C1440E) - in-progress / attention states (a
 *                                deeper red-orange, distinct from brass
 *                                but still squarely in the orange family)
 *
 * Typography:
 *   - display: "Cormorant Garamond" (serif) -- section headings, the
 *     dashboard greeting, and the invoice template's headline treatment,
 *     giving the app an editorial, premium personality with high-contrast,
 *     elegant letterforms.
 *   - sans: "DM Sans" -- every other UI element (labels, buttons, table
 *     data, forms). Chosen over a generic grotesk for its slightly
 *     warmer, more distinctive letterforms at small sizes.
 *   - numeric: "Space Grotesk" -- the large stat figures on the
 *     Dashboard and Payments section (see StatCard.jsx). A distinct,
 *     confident geometric sans gives numbers their own visual weight,
 *     separate from headings, the way a ledger sets its totals apart.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        panel: '#0A0A0C',
        'panel-raised': '#17130F',
        'panel-line': '#2A231C',
        canvas: '#FFFFFF',
        'canvas-muted': '#FBF7F2',
        'canvas-dark': '#0F0D0B',
        'canvas-dark-muted': '#1C1712',
        ink: '#171412',
        'ink-soft': '#726B63',
        'ink-invert': '#F7F3EE',
        line: '#EBE3D8',
        'line-dark': '#2E2721',
        brass: {
          DEFAULT: '#D2540A',
          light: '#F0895A',
          dark: '#9C3D07',
        },
        danger: '#B3432F',
        success: '#3D7A5D',
        warning: '#C1440E',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        numeric: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,20,18,0.05)',
        premium: '0 4px 24px rgba(23,20,18,0.08)',
        popover: '0 16px 40px rgba(10,10,12,0.22)',
      },
    },
  },
  plugins: [],
};
