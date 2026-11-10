import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSession } from '@/providers/session';
import { colors, Loading, Page } from '@/components/native-ui';

export default function MainLayout() {
  const { user, ready } = useSession();
  if (!ready) return <Page title="SAIWAY"><Loading /></Page>;
  if (!user) return <Redirect href="/auth" />;
  const driver = user.role === 'driver';
  return <Tabs screenOptions={{
    headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
    tabBarLabelStyle: { fontSize: 11 },
  }}>
    <Tabs.Screen name="trips" options={{ title: driver ? 'Courses' : 'Mes trajets', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 23 }}>≡</Text> }} />
    <Tabs.Screen name="book" options={{ title: 'Réserver', href: driver ? null : '/(main)/book', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 23 }}>＋</Text> }} />
    <Tabs.Screen name="walkup" options={{ title: 'Nouvelle', href: driver ? '/(main)/walkup' : null, tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 23 }}>＋</Text> }} />
    <Tabs.Screen name="finance" options={{ title: 'Finances', href: driver ? '/(main)/finance' : null, tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 23 }}>$</Text> }} />
    <Tabs.Screen name="documents" options={{ title: 'Documents', href: driver ? '/(main)/documents' : null, tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 23 }}>▤</Text> }} />
    <Tabs.Screen name="account" options={{ title: 'Compte', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 23 }}>◎</Text> }} />
  </Tabs>;
}
