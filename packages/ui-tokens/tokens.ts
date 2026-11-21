/**
 * Codeathon Design Tokens
 * Light theme only. Base color driven, flat surfaces, clear borders, confident type scale.
 */

export const DEFAULT_BASE_COLOR = '#0F52BA'; // Sapphire Blue

export const tokens = {
  colors: {
    // Base palette driven by --color-base
    base: {
      50: 'var(--color-base-50, #EFF6FF)',
      100: 'var(--color-base-100, #DBEAFE)',
      200: 'var(--color-base-200, #BFDBFE)',
      300: 'var(--color-base-300, #93C5FD)',
      400: 'var(--color-base-400, #60A5FA)',
      500: 'var(--color-base-500, #2563EB)',
      DEFAULT: 'var(--color-base, #0F52BA)',
      600: 'var(--color-base-600, #1D4ED8)',
      700: 'var(--color-base-700, #1E40AF)',
      800: 'var(--color-base-800, #1E3A8A)',
      900: 'var(--color-base-900, #172554)',
    },
    // Ink (Text)
    ink: {
      primary: 'var(--color-ink-primary, #0F172A)',
      secondary: 'var(--color-ink-secondary, #334155)',
      muted: 'var(--color-ink-muted, #64748B)',
      disabled: 'var(--color-ink-disabled, #94A3B8)',
      inverse: 'var(--color-ink-inverse, #FFFFFF)',
    },
    // Paper (Surfaces & Backgrounds)
    paper: {
      DEFAULT: 'var(--color-paper, #FFFFFF)',
      subtle: 'var(--color-paper-subtle, #F8FAFC)',
      muted: 'var(--color-paper-muted, #F1F5F9)',
      elevated: 'var(--color-paper-elevated, #FFFFFF)',
    },
    // Line (Borders & Dividers)
    line: {
      subtle: 'var(--color-line-subtle, #F1F5F9)',
      DEFAULT: 'var(--color-line, #E2E8F0)',
      strong: 'var(--color-line-strong, #CBD5E1)',
      focus: 'var(--color-line-focus, #0F52BA)',
    },
    // Warm accent complementary to the cool base
    accent: {
      50: 'var(--color-accent-50, #FFF7ED)',
      100: 'var(--color-accent-100, #FFEDD5)',
      500: 'var(--color-accent-500, #F97316)',
      DEFAULT: 'var(--color-accent, #EA580C)',
      600: 'var(--color-accent-600, #C2410C)',
      700: 'var(--color-accent-700, #9A3412)',
    },
    // Semantics
    success: {
      50: '#ECFDF5',
      100: '#D1FAE5',
      500: '#10B981',
      DEFAULT: '#059669',
      600: '#047857',
      700: '#065F46',
    },
    warning: {
      50: '#FFFBEB',
      100: '#FEF3C7',
      500: '#F59E0B',
      DEFAULT: '#D97706',
      600: '#B45309',
      700: '#92400E',
    },
    danger: {
      50: '#FEF2F2',
      100: '#FEE2E2',
      500: '#EF4444',
      DEFAULT: '#DC2626',
      600: '#B91C1C',
      700: '#991B1B',
    },
    info: {
      50: '#F0F9FF',
      100: '#E0F2FE',
      500: '#0EA5E9',
      DEFAULT: '#0284C7',
      600: '#0369A1',
      700: '#075985',
    },
  },
  borderRadius: {
    none: '0',
    sm: '4px',
    DEFAULT: '6px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    '2xl': '16px',
    full: '9999px',
  },
  boxShadow: {
    subtle: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
    card: '0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.08)',
    raised: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.06)',
    modal: '0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.08)',
  },
  screens: {
    xs: '360px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1440px',
  },
  minTapTarget: '44px',
} as const;

export const cssRootVariables = `
:root {
  --color-base: #0F52BA;
  --color-base-50: #EFF6FF;
  --color-base-100: #DBEAFE;
  --color-base-200: #BFDBFE;
  --color-base-300: #93C5FD;
  --color-base-400: #60A5FA;
  --color-base-500: #2563EB;
  --color-base-600: #1D4ED8;
  --color-base-700: #1E40AF;
  --color-base-800: #1E3A8A;
  --color-base-900: #172554;

  --color-ink-primary: #0F172A;
  --color-ink-secondary: #334155;
  --color-ink-muted: #64748B;
  --color-ink-disabled: #94A3B8;
  --color-ink-inverse: #FFFFFF;

  --color-paper: #FFFFFF;
  --color-paper-subtle: #F8FAFC;
  --color-paper-muted: #F1F5F9;
  --color-paper-elevated: #FFFFFF;

  --color-line-subtle: #F1F5F9;
  --color-line: #E2E8F0;
  --color-line-strong: #CBD5E1;
  --color-line-focus: #0F52BA;

  --color-accent: #EA580C;
  --color-accent-50: #FFF7ED;
  --color-accent-100: #FFEDD5;
  --color-accent-500: #F97316;
  --color-accent-600: #C2410C;
  --color-accent-700: #9A3412;
}
`;
