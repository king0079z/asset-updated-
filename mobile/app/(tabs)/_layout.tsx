import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor:  theme.colors.surface,
          borderTopColor:   theme.colors.border,
          height:           Platform.OS === 'ios' ? 84 : 60,
          paddingBottom:    Platform.OS === 'ios' ? 24 : 6,
          paddingTop:       6,
        },
        tabBarLabelStyle:    { fontSize: 10, fontWeight: '600' },
        headerStyle:         { backgroundColor: theme.colors.primary },
        headerTintColor:     '#fff',
        headerTitleStyle:    { fontWeight: '700', fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="assets"
        options={{
          title: 'Assets',
          tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="portal"
        options={{
          title: 'Portal',
          tabBarIcon: ({ color, size }) => <Ionicons name="ticket" size={size} color={color} />,
          headerTitle: 'IT Service Portal',
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          title: 'Work',
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" size={size} color={color} />,
          headerTitle: 'Work & Approvals',
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Ionicons name="menu" size={size} color={color} />,
        }}
      />
      {/* Inventory tab hidden from bottom bar — accessible via Assets or More */}
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          href: null,
          tabBarIcon: ({ color, size }) => <Ionicons name="layers" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
