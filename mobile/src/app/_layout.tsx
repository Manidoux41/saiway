import { LanguageProvider, useLanguage } from '@/providers/language';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '@/providers/session';
import { GpsProvider } from '@/providers/gps';
import { colors } from '@/components/native-ui';
import { AdvertisingPopup } from '@/components/advertising-popup';
import { NotificationsProvider } from '@/providers/notifications';

export default function RootLayout() {
  return <LanguageProvider><AppLayout /></LanguageProvider>;
}
function AppLayout() {
  const { t } = useLanguage();
  return <SessionProvider><NotificationsProvider><GpsProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="(main)" />
      <Stack.Screen name="legal" options={{ headerShown: true, title: t('Informations légales'), headerTintColor: colors.primary }} />
      <Stack.Screen name="trip/[id]" options={{ headerShown: true, title: t("Votre course"), headerTintColor: colors.primary }} />
    </Stack>
    <AdvertisingPopup />
  </GpsProvider></NotificationsProvider></SessionProvider>;
}
