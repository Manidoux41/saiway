import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '@/providers/session';
import { GpsProvider } from '@/providers/gps';
import { colors } from '@/components/native-ui';
import { AdvertisingPopup } from '@/components/advertising-popup';

export default function RootLayout() {
  return <SessionProvider><GpsProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="(main)" />
      <Stack.Screen name="trip/[id]" options={{ headerShown: true, title: 'Votre course', headerTintColor: colors.primary }} />
    </Stack>
    <AdvertisingPopup />
  </GpsProvider></SessionProvider>;
}
