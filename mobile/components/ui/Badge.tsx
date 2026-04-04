import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '@/constants/theme';

type Variant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'muted' | 'purple';

const VARIANT_STYLES: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary:  { bg: theme.colors.primaryXLight, text: theme.colors.primary },
  success:  { bg: theme.colors.successBg,    text: theme.colors.success },
  warning:  { bg: theme.colors.warningBg,    text: theme.colors.warning },
  error:    { bg: theme.colors.errorBg,      text: theme.colors.error },
  info:     { bg: theme.colors.infoBg,       text: theme.colors.info },
  muted:    { bg: theme.colors.borderLight,  text: theme.colors.textMuted },
  purple:   { bg: theme.colors.purpleBg,     text: theme.colors.purple },
};

interface BadgeProps {
  label: string;
  variant?: Variant;
  size?: 'sm' | 'md';
  style?: ViewStyle;
  dot?: boolean;
}

export function Badge({ label, variant = 'muted', size = 'md', style, dot }: BadgeProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <View style={[
      styles.badge,
      size === 'sm' && styles.sm,
      { backgroundColor: v.bg },
      style,
    ]}>
      {dot && <View style={[styles.dot, { backgroundColor: v.text }]} />}
      <Text style={[styles.text, size === 'sm' && styles.textSm, { color: v.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  textSm: {
    fontSize: 10,
    fontWeight: '700',
  },
});
