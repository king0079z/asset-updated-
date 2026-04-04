import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';

interface GradientCardProps {
  children: React.ReactNode;
  colors?: [string, string];
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

export function GradientCard({
  children,
  colors = theme.gradients.primary,
  style,
  contentStyle,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
}: GradientCardProps) {
  return (
    <LinearGradient
      colors={colors}
      start={start}
      end={end}
      style={[styles.gradient, style]}
    >
      <View style={[styles.content, contentStyle]}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: theme.radius.xl,
    ...theme.shadows.colored,
    overflow: 'hidden',
  },
  content: {
    padding: theme.spacing.xl,
  },
});
