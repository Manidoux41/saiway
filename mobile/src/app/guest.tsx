import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Text } from 'react-native';
import * as Location from 'expo-location';
import { z } from 'zod';
import { errorMessage, guestClient, restoreGuestSession } from '@/lib/api';
import { guestRideSchema } from '@/lib/contracts';
import { closedStatuses } from '@/lib/policy';
import { useApi, useNow, useOperation } from '@/hooks/use-api';
import { Button, Card, confirm, dateTime, Loading, money, Notice, Page, statusLabels, styles } from '@/components/native-ui';
import RouteMap from '@/components/route-map';

const readySchema = z.object({ ready: z.boolean() });
const cancellable = ['DRIVER_ASSIGNMENT_PENDING', 'DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED'];
export default function Guest() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState('');
  const [revision, setRevision] = useState(0);
  const operation = useOperation();
  const now = useNow();
  useEffect(() => {
    let active = true;
    void restoreGuestSession().then(() => { if (active) { setReady(true); setBootError(''); } })
      .catch(error => { if (active) setBootError(errorMessage(error)); });
    return () => { active = false; };
  }, [revision]);
  const resource = useApi(ready ? '/api/guest-rides' : null, guestRideSchema, 5000, 'guest');
  const booking = resource.data?.booking;
  function requestRide() {
    void operation.run(async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Votre position est nécessaire pour commander sans compte.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (position.coords.accuracy === null || position.coords.accuracy > 100) throw new Error('GPS insuffisamment précis. Réessayez en extérieur.');
      if (!await confirm('Commander un chauffeur', 'Le chauffeur viendra à votre position. Vous choisirez la destination avec lui. Le prix final sera calculé à l’arrivée et réglé au chauffeur.')) return;
      const fresh = Date.now() - position.timestamp < 60000 ? position : await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (fresh.coords.accuracy === null || fresh.coords.accuracy > 100) throw new Error('Précision GPS insuffisante.');
      const result = await guestClient().request('/api/guest-rides', guestRideSchema, { method: 'POST', body: {
        latitude: fresh.coords.latitude, longitude: fresh.coords.longitude, accuracy: fresh.coords.accuracy,
        capturedAt: new Date(fresh.timestamp).toISOString(),
      } });
      resource.setData(result);
    });
  }
  return <Page title="Un chauffeur, maintenant" subtitle="Sans compte, sans coordonnées personnelles."
    refreshing={resource.loading} onRefresh={resource.refresh}>
    <Notice error={bootError || resource.error || operation.error} message={operation.message} />
    {bootError && <Button title="Réessayer la connexion" secondary onPress={() => setRevision(value => value + 1)} />}
    {!ready && !bootError && <Loading />}
    {ready && resource.data && !booking && <Card>
      <Text style={styles.heading}>Nous venons vous chercher.</Text>
      <Text style={styles.text}>Votre GPS sert de point de départ. Le chauffeur et le véhicule sont attribués par SAIWAY.</Text>
      <Button title="Commander à ma position" disabled={operation.pending} onPress={requestRide} />
    </Card>}
    {booking && <Card>
      <Text style={styles.eyebrow}>{booking.reference}</Text>
      <Text style={styles.badge}>{statusLabels[booking.status] ?? booking.status}</Text>
      <Text style={styles.text}>{booking.driverName || 'Recherche d’un chauffeur…'}</Text>
      {booking.vehicle && <Text style={styles.text}>{booking.vehicle.name} · {booking.vehicle.plate}</Text>}
      <Text style={styles.muted}>Départ : {booking.fromAddress}</Text>
      {booking.toAddress && <Text style={styles.text}>Destination : {booking.toAddress}</Text>}
      {booking.priceCents !== null ? <Text style={styles.price}>{money(booking.priceCents, booking.currency)}</Text> :
        <Text style={styles.muted}>Prix calculé à la fin de la course, à régler au chauffeur.</Text>}
      {booking.location && <>
        <RouteMap driver={booking.location} />
        <Text style={styles.muted}>Position du {dateTime(booking.location.recordedAt)}
          {now - Date.parse(booking.location.recordedAt) > 60000 ? ' · POSITION ANCIENNE' : ''}</Text>
      </>}
      {cancellable.includes(booking.status) && <Button title="Annuler ma demande" danger disabled={operation.pending}
        onPress={() => void operation.run(async () => {
          if (!await confirm('Annuler', 'Annuler cette demande de chauffeur ?')) return;
          resource.setData(await guestClient().request('/api/guest-rides', guestRideSchema, { method: 'DELETE' }));
        })} />}
      {closedStatuses.includes(booking.status) && <Button title="Commander une nouvelle course" disabled={operation.pending}
        onPress={() => void operation.run(async () => {
          await guestClient().request('/api/guest-rides/session', readySchema, { method: 'POST' });
          resource.refresh();
        })} />}
    </Card>}
    <Button title="Retour à l’accueil" secondary onPress={() => router.replace('/')} />
    <Text style={styles.muted}>Conservez cette installation pour retrouver la course pendant 7 jours. La session invité est distincte de votre compte.</Text>
  </Page>;
}
