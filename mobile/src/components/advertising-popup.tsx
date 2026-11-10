import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApi, useNow, useOperation } from '@/hooks/use-api';
import { configuredOrigin } from '@/lib/api';
import { advertisementsSchema, advertisementImagePath, advertisingPlacement, drivingStatuses, nextAdvertisement,
  type Advertisement, type AdPlacement } from '@/lib/advertising';
import { bookingsSchema } from '@/lib/contracts';
import { useSession } from '@/providers/session';
import { BrandLogo } from './brand';
import { Button, colors, Notice, styles } from './native-ui';

export function AdvertisingPopup() {
  const { user, ready, error } = useSession();
  return <AdvertisingSession key={user?.id ?? 'public'} ready={ready && !error} />;
}

function AdvertisingSession({ ready }: { ready: boolean }) {
  const { user } = useSession();
  const path = usePathname();
  const placement = advertisingPlacement(path, user?.role);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [seen, setSeen] = useState<Partial<Record<AdPlacement, boolean>>>({});
  const driver = user?.role === 'driver';
  const bookings = useApi(driver && placement === 'DRIVER' && foreground ? '/api/driver/bookings' : null, bookingsSchema, 5000);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  const consume = useCallback((value: AdPlacement) => {
    setSeen(current => ({ ...current, [value]: true }));
  }, []);
  const blocked = driver && (!bookings.data || Boolean(bookings.error) ||
    bookings.data.bookings.some(booking => drivingStatuses.includes(booking.status)));
  if (!ready || !foreground || !placement || blocked) return null;
  return <CampaignPopup key={placement} placement={placement} consumed={Boolean(seen[placement])} onShow={consume} />;
}

function CampaignPopup({ placement, consumed, onShow }: {
  placement: AdPlacement; consumed: boolean; onShow: (placement: AdPlacement) => void;
}) {
  const campaigns = useApi(`/api/advertising?placement=${placement}`, advertisementsSchema, 60000);
  const now = useNow();
  const [selected, setSelected] = useState<Advertisement | null>(null);
  const [dismissed, setDismissed] = useState(consumed);
  const operation = useOperation();
  const candidate = campaigns.data ? nextAdvertisement(campaigns.data.advertisements, now) : null;
  useEffect(() => {
    if (selected || !candidate || dismissed) return;
    const timer = setTimeout(() => setSelected(candidate), 1200);
    return () => clearTimeout(timer);
  }, [candidate, selected, dismissed]);
  const current = selected && campaigns.data?.advertisements.find(ad => ad.id === selected.id && Date.parse(ad.endsAt) > now);
  function close() { setDismissed(true); }
  useEffect(() => {
    if (campaigns.error) console.warn('Publicités SAIWAY indisponibles :', campaigns.error);
  }, [campaigns.error]);
  if (!current || dismissed || campaigns.error) return null;
  return <Modal transparent animationType="fade" visible onRequestClose={close} onShow={() => onShow(placement)} statusBarTranslucent>
    <SafeAreaView style={popupStyles.backdrop}>
      <View style={popupStyles.dialog} accessibilityViewIsModal accessibilityLabel="Publicité SAIWAY">
        <ScrollView contentContainerStyle={{ padding: 22, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <BrandLogo />
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Fermer la publicité"
              hitSlop={8} style={popupStyles.close}><Text style={{ color: colors.dark, fontSize: 24 }}>×</Text></Pressable>
          </View>
          <Text style={styles.eyebrow}>PUBLICITÉ · PARTENAIRE</Text>
          {current.image && <CampaignImage key={`${current.id}-${current.image.updatedAt}`} ad={current} />}
          <Text style={styles.muted}>Sponsorisé par {current.advertiser}</Text>
          <Text accessibilityRole="header" style={styles.heading}>{current.title}</Text>
          <Text style={styles.text}>{current.description}</Text>
          <Notice error={operation.error} />
          <Button title="Découvrir l’offre" disabled={operation.pending} onPress={() => void operation.run(async () => {
            const validated = advertisementsSchema.shape.advertisements.element.parse(current);
            await Linking.openURL(validated.targetUrl);
            close();
          })} />
          <Button title="Continuer dans SAIWAY" secondary onPress={close} />
        </ScrollView>
      </View>
    </SafeAreaView>
  </Modal>;
}

function CampaignImage({ ad }: { ad: Advertisement }) {
  const [failed, setFailed] = useState(false);
  return failed ? <Notice error="L’image de cette publicité est indisponible." /> :
    <Image source={{ uri: `${configuredOrigin()}${advertisementImagePath(ad)}` }} accessibilityLabel={ad.title}
      style={{ width: '100%', aspectRatio: 2, borderRadius: 16 }} contentFit="cover" cachePolicy="none" onError={() => setFailed(true)} />;
}

const popupStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(16,27,61,0.62)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 520, maxHeight: '90%', backgroundColor: '#F7F9FF', borderRadius: 26, borderTopWidth: 4, borderTopColor: '#E00025', overflow: 'hidden' },
  close: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6ECFA' },
});
