/**
 * AssetXAI — Premium Enterprise Design System
 * Matches the web application's visual identity.
 */
export const theme = {
  colors: {
    // Brand
    primary:         '#4f46e5',
    primaryDark:     '#3730a3',
    primaryLight:    '#818cf8',
    primaryXLight:   '#eef2ff',
    secondary:       '#7c3aed',
    secondaryLight:  '#ede9fe',

    // Semantic
    success:         '#16a34a',
    successBg:       '#dcfce7',
    successLight:    '#f0fdf4',
    warning:         '#d97706',
    warningBg:       '#fef3c7',
    warningLight:    '#fffbeb',
    error:           '#dc2626',
    errorBg:         '#fee2e2',
    errorLight:      '#fef2f2',
    info:            '#0ea5e9',
    infoBg:          '#e0f2fe',
    infoLight:       '#f0f9ff',

    // Neutral surfaces
    background:      '#f1f5f9',
    surface:         '#ffffff',
    surfaceElevated: '#ffffff',
    surfaceDim:      '#f8fafc',

    // Text
    text:            '#0f172a',
    textSecondary:   '#475569',
    textMuted:       '#94a3b8',
    textInverse:     '#ffffff',

    // Borders
    border:          '#e2e8f0',
    borderLight:     '#f1f5f9',
    borderFocus:     '#4f46e5',

    // Chart / status colours
    purple:          '#8b5cf6',
    purpleBg:        '#f5f3ff',
    teal:            '#0d9488',
    tealBg:          '#f0fdfa',
    amber:           '#f59e0b',
    amberBg:         '#fffbeb',
    rose:            '#f43f5e',
    roseBg:          '#fff1f2',
  },

  gradients: {
    primary:   ['#4f46e5', '#7c3aed'] as [string, string],
    blue:      ['#3b82f6', '#1d4ed8'] as [string, string],
    success:   ['#16a34a', '#15803d'] as [string, string],
    warning:   ['#f59e0b', '#d97706'] as [string, string],
    error:     ['#ef4444', '#dc2626'] as [string, string],
    teal:      ['#14b8a6', '#0d9488'] as [string, string],
    dark:      ['#1e293b', '#0f172a'] as [string, string],
    card:      ['#ffffff', '#f8fafc'] as [string, string],
  },

  spacing: {
    xs:    4,
    sm:    8,
    md:   12,
    lg:   16,
    xl:   20,
    xxl:  24,
    xxxl: 32,
    huge: 48,
  },

  radius: {
    xs:   6,
    sm:   10,
    md:   14,
    lg:   18,
    xl:   24,
    xxl:  32,
    full: 9999,
  },

  typography: {
    displayLarge:  { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
    display:       { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.3 },
    title:         { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
    titleSmall:    { fontSize: 18, fontWeight: '700' as const },
    titleXSmall:   { fontSize: 16, fontWeight: '700' as const },
    body:          { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
    bodyMedium:    { fontSize: 15, fontWeight: '600' as const },
    bodySmall:     { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    caption:       { fontSize: 13, fontWeight: '400' as const },
    captionMedium: { fontSize: 13, fontWeight: '600' as const },
    label:         { fontSize: 12, fontWeight: '600' as const },
    labelSmall:    { fontSize: 11, fontWeight: '600' as const },
    overline:      { fontSize: 10, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 1 },
    numericLg:     { fontSize: 36, fontWeight: '800' as const, letterSpacing: -1 },
    numericMd:     { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
    numericSm:     { fontSize: 22, fontWeight: '700' as const },
  },

  shadows: {
    xs:  { shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2,  elevation: 1 },
    sm:  { shadowColor: '#000',    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,  elevation: 2 },
    md:  { shadowColor: '#000',    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8,  elevation: 4 },
    lg:  { shadowColor: '#000',    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 6 },
    xl:  { shadowColor: '#000',    shadowOffset: { width: 0, height: 10}, shadowOpacity: 0.14, shadowRadius: 24, elevation: 10 },
    colored: { shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  },

  touchTargetMinHeight: 48,
} as const;

export type Theme = typeof theme;
