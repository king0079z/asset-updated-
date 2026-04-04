import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
  onPress?: () => void;
  subtitle?: string;
  trend?: { value: number; positive: boolean };
}

export function StatCard({ label, value, icon, gradient, onPress, subtitle, trend }: StatCardProps) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={styles.wrapper}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={22} color="rgba(255,255,255,0.9)" />
        </View>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {trend && (
          <View style={styles.trendRow}>
            <Ionicons
              name={trend.positive ? 'trending-up' : 'trending-down'}
              size={12}
              color={trend.positive ? '#86efac' : '#fca5a5'}
            />
            <Text style={[styles.trendText, { color: trend.positive ? '#86efac' : '#fca5a5' }]}>
              {trend.value}%
            </Text>
          </View>
        )}
      </LinearGradient>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minWidth: 140,
    ...theme.shadows.colored,
  },
  gradient: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    overflow: 'hidden',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: theme.spacing.sm,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
