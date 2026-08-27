import type { Config } from 'tailwindcss';

// Every value below is sourced verbatim from DESIGN.md's frontmatter tokens
// (colors, typography, rounded, spacing). Do not hand-edit a value here without
// updating DESIGN.md first — DESIGN.md is the single source of truth.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary': 'var(--color-primary)',
        'secondary': 'var(--color-secondary)',
        'tertiary': 'var(--color-tertiary)',
        'background': 'var(--color-background)',
        'surface': 'var(--color-surface)',
        'text': 'var(--color-text)',
        'border': 'var(--color-border)',
        'success': 'var(--color-success)',
        'warning': 'var(--color-warning)',
        'error': 'var(--color-error)',
        'neutral': {
          DEFAULT: 'var(--color-neutral)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-neutral-300)',
          400: 'var(--color-neutral-400)',
          500: 'var(--color-neutral-500)',
          600: 'var(--color-neutral-600)',
          700: 'var(--color-neutral-700)',
          800: 'var(--color-neutral-800)',
          900: 'var(--color-neutral-900)',
        },
        'accent': {
          100: 'var(--color-accent-100)',
          200: 'var(--color-accent-200)',
          300: 'var(--color-accent-300)',
          400: 'var(--color-accent-400)',
          500: 'var(--color-accent-500)',
          600: 'var(--color-accent-600)',
          700: 'var(--color-accent-700)',
          800: 'var(--color-accent-800)',
          900: 'var(--color-accent-900)',
        },
        'accent-2': {
          100: 'var(--color-accent-2-100)',
          200: 'var(--color-accent-2-200)',
          300: 'var(--color-accent-2-300)',
          400: 'var(--color-accent-2-400)',
          500: 'var(--color-accent-2-500)',
          600: 'var(--color-accent-2-600)',
          700: 'var(--color-accent-2-700)',
          800: 'var(--color-accent-2-800)',
          900: 'var(--color-accent-2-900)',
        },
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Caprasimo', '"Baloo 2"', 'cursive'],
        sans: [
          'var(--font-body)',
          'Figtree',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
      },
      fontSize: {
        'h1': ['42px', { lineHeight: '1.12', letterSpacing: '-0.015em', fontWeight: '400' }],
        'h2': ['30px', { lineHeight: '1.12', letterSpacing: '-0.015em', fontWeight: '400' }],
        'h3': ['22px', { lineHeight: '1.12', letterSpacing: '-0.015em', fontWeight: '400' }],
        'h4': ['18px', { lineHeight: '1.12', letterSpacing: '-0.015em', fontWeight: '400' }],
        'h5': ['15px', { lineHeight: '1.12', letterSpacing: '-0.015em', fontWeight: '400' }],
        'h6': ['12px', { lineHeight: '1.12', letterSpacing: '0.08em', fontWeight: '400' }],
        'body-md': ['15px', { lineHeight: '1.55', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '1.55', fontWeight: '400' }],
        'label': ['14px', { lineHeight: '1.2', fontWeight: '600' }],
        'caption': ['11px', { lineHeight: '1.3', fontWeight: '400' }],
      },
      borderRadius: {
        sm: '8px',
        md: '16px',
        lg: '28px',
        card: '32px',
        full: '999px',
      },
      spacing: {
        // DESIGN.md base spacing unit is 4.4px (not 4px/8px) — these override
        // Tailwind's default numeric spacing keys to preserve the exact scale.
        1: '4.4px',
        2: '8.8px',
        3: '13.2px',
        4: '17.6px',
        6: '26.4px',
        8: '35.2px',
      },
      boxShadow: {
        // Computed against DESIGN.md's darkest neutral (#2F281C = rgb(47,40,28)),
        // not a generic black, per DESIGN.md's Elevation & Depth section.
        sm: '0 1px 2px rgba(47, 40, 28, 0.14)',
        md: '0 3px 10px rgba(47, 40, 28, 0.16)',
        lg: '0 12px 32px rgba(47, 40, 28, 0.22)',
      },
    },
  },
  plugins: [],
};

export default config;
