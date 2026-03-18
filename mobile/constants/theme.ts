/**
 * World-class design system for Asset AI mobile app.
 * Violet/indigo primary to match web; clear hierarchy and touch targets.
 */
export const theme = {
  colors: {
    primary: '#4f46e5',
    primaryDark: '#4338ca',
    primaryLight: '#818cf8',
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceElevated: '#ffffff',
    text: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    success: '#16a34a',
    successBg: '#dcfce7',
    warning: '#d97706',
    warningBg: '#fef3c7',
    error: '#dc2626',
    errorBg: '#fee2e2',
    info: '#0ea5e9',
    infoBg: '#e0f2fe',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  typography: {
    title: { fontSize: 22, fontWeight: '700' as const },
    titleSmall: { fontSize: 18, fontWeight: '700' as const },
    body: { fontSize: 16, fontWeight: '400' as const },
    bodyMedium: { fontSize: 16, fontWeight: '600' as const },
    caption: { fontSize: 14, fontWeight: '400' as const },
    captionMedium: { fontSize: 14, fontWeight: '600' as const },
    label: { fontSize: 12, fontWeight: '600' as const },
    overline: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const },
  },
  shadows: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5 },
  },
  touchTargetMinHeight: 48,
} as const;

export type Theme = typeof theme;
