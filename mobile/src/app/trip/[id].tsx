import { useLanguage } from '@/providers/language';
import { useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Linking, Share, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { z } from 'zod';
import { useSession } from '@/providers/session';
import { useGps } from '@/providers/gps';
import { useApi, useNow, useOperation } from '@/hooks/use-api';
import { client } from '@/lib/api';
import { ApiError } from '@/lib/transport';
import { bookingResultSchema, bookingsSchema, paymentSchema, trackingSchema, type Booking } from '@/lib/contracts';
import { canCancel, canPayOnline, cents, nextStatus, paid, paymentLocked, trackingStatuses, trustedCheckout } from '@/lib/policy';
import { Button, Card, Choices, confirm, Field, Loading, Notice, Page, statusLabels, styles } from '@/components/native-ui';
import RouteMap from '@/components/route-map';

const meterSchema = z.object({ distanceMeters: z.number().nullable(), priceCents: z.number(), complete: z.boolean(), mode: z.string() });
const transitionLabels: Record<string, string> = {
  DRIVER_ASSIGNED: 'Accepter la course', DRIVER_ACCEPTED: 'Partir vers le client',
  DRIVER_EN_ROUTE: 'Signaler mon arrivée', DRIVER_ARRIVED: 'Démarrer la course', TRIP_STARTED: 'Terminer la course',
};

export default function Trip() {
  const { t, money, dateTime, historyNote } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const driver = user?.role === 'driver';
  const resource = useApi(user ? driver ? '/api/driver/bookings' : '/api/bookings' : null, bookingsSchema, 10000);
  const booking = resource.data?.bookings.find(item => item.id === id);
  const tracking = useApi(user && booking && trackingStatuses.includes(booking.status) ? `/api/bookings/${encodeURIComponent(id)}/location` : null, trackingSchema, 5000);
  const meter = useApi(driver && booking?.status === 'TRIP_STARTED' && booking.fareDetails?.guestMeter ?
    `/api/driver/bookings?meter=${encodeURIComponent(id)}` : null, meterSchema, 10000);
  const operation = useOperation();
  const now = useNow();
  const gps = useGps();
  const [observations, setObservations] = useState('');
  const [circuit, setCircuit] = useState('');
  const [collectionMethod, setCollectionMethod] = useState('CASH');
  const [correctedPrice, setCorrectedPrice] = useState('');
  if (!user) return <Redirect href="/auth" />;
  const refresh = () => { resource.refresh(); tracking.refresh(); meter.refresh(); gps.access.refresh(); };
  function update(result: { booking: Booking }) {
    resource.updateData(current => current ? { bookings: current.bookings.map(item => item.id === result.booking.id ? result.booking : item) } : current);
    resource.refresh();
    gps.access.refresh();
  }
  function advance(course: Booking) {
    void operation.run(async () => {
      const status = nextStatus[course.status];
      if (!status || !await confirm(t(transitionLabels[course.status]), `${course.reference}\n${course.fromAddress} → ${course.toAddress}`)) return;
      const guestMeter = course.fareDetails?.guestMeter || course.pricingStatus === 'AWAITING_DESTINATION';
      const point = guestMeter && ['TRIP_STARTED', 'TRIP_COMPLETED'].includes(status) ? await gps.sendNow() : undefined;
      if (status === 'TRIP_COMPLETED' && circuit && circuit !== course.fareDetails?.circuit &&
        !await confirm(t("Modifier le circuit"), t("La modification peut augmenter le prix final. Le passager doit être informé."))) return;
      const body = {
        id: course.id, status,
        ...(status === 'TRIP_COMPLETED' ? { observations, ...(point ? { finalPoint: point } : {}), ...(circuit ? { tourCircuit: circuit } : {}) } : {}),
      };
      let result: { booking: Booking };
      try {
        result = await client().request('/api/driver/bookings', bookingResultSchema, { method: 'PATCH', body });
      } catch (failure) {
        if (!(failure instanceof ApiError) || failure.status !== 409 || failure.message !== 'GPS_INCOMPLETE_CONFIRM_ROUTE') throw failure;
        if (!await confirm(t("GPS incomplet"), t("Confirmer explicitement l’utilisation de la distance routière estimée par le serveur pour terminer cette course ?"))) return;
        result = await client().request('/api/driver/bookings', bookingResultSchema, { method: 'PATCH', body: { ...body, confirmEstimatedDistance: true } });
      }
      update(result);
    });
  }
  function payment(course: Booking, action: 'checkout' | 'verify') {
    void operation.run(async () => {
      const result = await client().request(`/api/payments/payway/${action}`, paymentSchema, { method: 'POST', body: { bookingId: course.id } });
      if (result.paid) { operation.setMessage(t("Paiement confirmé par le serveur.")); refresh(); return; }
      if (action === 'checkout' && result.checkoutUrl) {
        const url = trustedCheckout(result.checkoutUrl);
        if (result.sandbox && !await confirm(t("Paiement de test"), t("Ce paiement utilise l’environnement de test PayWay. Continuer ?"))) return;
        await WebBrowser.openBrowserAsync(url);
        const verification = await client().request('/api/payments/payway/verify', paymentSchema, { method: 'POST', body: { bookingId: course.id } });
        operation.setMessage(verification.paid ? t("Paiement confirmé.") : t("Paiement non confirmé. Vous pouvez vérifier à nouveau dans quelques secondes."));
        refresh();
      } else operation.setMessage(t("Paiement non confirmé par le serveur."));
    });
  }
  function collect(course: Booking, received: boolean) {
    void operation.run(async () => {
      if (!await confirm(received ? t("Confirmer l’encaissement") : t("Signaler un paiement non reçu"),
        `${money(course.priceCents, course.currency)} · ${course.reference}${received ? ` · ${t(collectionMethod)}` : ''}`)) return;
      update(await client().request('/api/driver/payments', bookingResultSchema, {
        method: 'POST', body: { bookingId: course.id, received, ...(received ? { collectionMethod } : {}) },
      }));
      operation.setMessage(received ? t("Encaissement enregistré.") : t("Paiement non reçu signalé."));
    });
  }
  return <Page title={booking?.reference ?? t("Votre course")} subtitle={t("Heure locale du Cambodge")} refreshing={resource.loading} onRefresh={refresh}>
    <Notice error={resource.error || tracking.error || meter.error || operation.error} message={operation.message} />
    {resource.loading && !resource.data && <Loading />}
    {resource.data && !booking && <Card><Text style={styles.text}>{t("Cette course est introuvable ou inaccessible avec ce compte.")}</Text></Card>}
    {booking && <>
      <Card>
        <Text style={styles.badge}>{t(statusLabels[booking.status] ?? booking.status)}</Text>
        <Text style={styles.heading}>{booking.fromAddress}</Text><Text style={styles.muted}>{t("vers")}</Text>
        <Text style={styles.heading}>{booking.toAddress}</Text>
        <Text style={styles.text}>{dateTime(booking.pickupAt)}</Text>
        <Text style={styles.muted}>{booking.passengers} {' '}{t("passager(s) ·")}{' '}{booking.luggageCount} {' '}{t("bagage(s)")}</Text>
        <Text style={styles.price}>{money(booking.priceCents, booking.currency)}</Text>
        <Text style={styles.muted}>{paid(booking) ? t("Payée") : paymentLocked(booking) ? t("Paiement en cours de traitement") : t("À régler")}</Text>
        {booking.metered && <Text style={styles.muted}>{t("Tarif variable : le montant définitif est calculé par le serveur à l’arrivée.")}</Text>}
        {booking.fareDetails && <>
          {booking.fareDetails.distanceMeters !== null && <Text style={styles.muted}>{(booking.fareDetails.distanceMeters / 1000).toFixed(1)} {' '}{t("km ·")}{' '}{t(booking.fareDetails.distanceSource ?? '')}</Text>}
          {booking.fareDetails.circuit && <Text style={styles.muted}>{t("Circuit :")}{' '}{t(booking.fareDetails.circuit)} · {booking.fareDetails.bookedHours} {' '}{t("h ·")}{' '}{booking.fareDetails.extraHours} {' '}{t("h supplémentaire(s)")}</Text>}
          {booking.fareDetails.supplements?.map((item, index) => <Text key={index} style={styles.muted}>{item.label} : {money(item.cents)}</Text>)}
        </>}
        <Text style={styles.text}>{t("Passager :")}{' '}{booking.passengerName || booking.customer?.name || t("Invité")}</Text>
        {booking.professionalCompany && <Text style={styles.muted}>{t('Professionnel :')} {booking.professionalCompany} · {booking.professionalPhone}</Text>}
        {booking.driver && <Text style={styles.text}>{t("Chauffeur :")}{' '}{booking.driver.user.name}</Text>}
        {booking.vehicle && <Text style={styles.text}>{booking.vehicle.name} · {booking.vehicle.plate}</Text>}
        {booking.flightNumber && <Text style={styles.text}>{t("Vol :")}{' '}{booking.flightNumber}</Text>}
        {booking.pickupNotes && <Text style={styles.text}>{t("Prise en charge :")}{' '}{booking.pickupNotes}</Text>}
        {booking.specialNeeds && <Text style={styles.text}>{t("Besoins :")}{' '}{booking.specialNeeds}</Text>}
        <Button title={t("Partager la référence")} secondary onPress={() => void operation.run(async () => {
          await Share.share({ message: `${booking.reference}\n${booking.fromAddress} → ${booking.toAddress}\n${dateTime(booking.pickupAt)}` });
        })} />
      </Card>
      {(booking.routeDetails || tracking.data?.location) && <Card>
        <Text style={styles.heading}>{t("Suivi du trajet")}</Text>
        <RouteMap from={booking.routeDetails?.from} to={booking.routeDetails?.to} route={booking.routeDetails?.coordinates}
          driver={tracking.data?.location ?? undefined} history={tracking.data?.history} />
        {tracking.data?.location && <Text style={styles.muted}>
          {t("Position du")}{' '}{dateTime(tracking.data.location.recordedAt)}
          {now - Date.parse(tracking.data.location.recordedAt) > 60000 ? t(" · POSITION ANCIENNE") : ''}
        </Text>}
      </Card>}
      {meter.data && <Card><Text style={styles.heading}>{t("Compteur invité")}</Text>
        <Text style={styles.price}>{money(meter.data.priceCents)}</Text>
        <Text style={styles.text}>{((meter.data.distanceMeters ?? 0) / 1000).toFixed(2)} {' '}{t("km")}</Text>
        {!meter.data.complete && <Text style={styles.error}>{t("Relevé GPS incomplet. Gardez le GPS actif.")}</Text>}
      </Card>}
      {driver ? <>
        <Card>
          <Text style={styles.heading}>{t("Actions chauffeur")}</Text>
          <Notice error={gps.error} />
          <Button title={t("GPS : {p0} — {p1}", { p0: gps.enabled ? t("actif") : t("désactivé"), p1: gps.enabled ? t("arrêter") : t("activer") })} secondary
            onPress={() => gps.setEnabled(!gps.enabled)} />
          {nextStatus[booking.status] && <>
            {booking.status === 'TRIP_STARTED' && <>
              <Field label={t("Observations de fin de course")} value={observations} onChangeText={setObservations} multiline maxLength={2000} />
              {booking.tripType === 'TOURIST_TOUR' && <Choices value={circuit || booking.fareDetails?.circuit || 'SMALL'} onChange={setCircuit}
                options={[{ value: 'SMALL', label: t("Petit circuit") }, { value: 'GRAND', label: t("Grand circuit") }, { value: 'REMOTE', label: t("Éloigné") }]} />}
            </>}
            <Button title={t(transitionLabels[booking.status])} disabled={operation.pending} onPress={() => advance(booking)} />
            {booking.status === 'DRIVER_ARRIVED' && booking.pricingStatus === 'AWAITING_DESTINATION' &&
              <Button title={t("Choisir la destination et le tarif plutôt que le compteur")} secondary
                onPress={() => router.push({ pathname: '/(main)/walkup', params: { guestId: booking.id } })} />}
          </>}
          {(() => {
            const phone = booking.contactPhone || booking.customer?.phone;
            if (!phone) return null;
            const digits = phone.replace(/[^\d+]/g, '');
            return <View style={{ gap: 10 }}>
              <Button title={t("Appeler le passager")} secondary onPress={() => void operation.run(async () => { await Linking.openURL(`tel:${digits}`); })} />
              <Button title="WhatsApp" secondary onPress={() => void operation.run(async () => { await Linking.openURL(`https://wa.me/${digits.replace(/\D/g, '')}`); })} />
              <Button title="Telegram" secondary onPress={() => void operation.run(async () => { await Linking.openURL(`https://t.me/+${digits.replace(/\D/g, '')}`); })} />
              <Button title={t("SMS au passager")} secondary onPress={() => void operation.run(async () => { await Linking.openURL(`sms:${digits}`); })} />
            </View>;
          })()}
          <Button title={t("Ouvrir la navigation")} secondary onPress={() => void operation.run(async () => {
            const routePoint = booking.routeDetails && (booking.status === 'TRIP_STARTED' ? booking.routeDetails.to : booking.routeDetails.from);
            const destination = routePoint ? `${routePoint.latitude},${routePoint.longitude}` : booking.status === 'TRIP_STARTED' ? booking.toAddress : booking.fromAddress;
            await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`);
          })} />
        </Card>
        {booking.status === 'TRIP_COMPLETED' && !paymentLocked(booking) && <Card>
          <Text style={styles.heading}>{t("Encaissement")}</Text>
          <Choices value={collectionMethod} onChange={setCollectionMethod} disabled={operation.pending} options={[
            { value: 'CASH', label: t("Espèces") }, { value: 'CARD', label: t("Carte") }, { value: 'ABA', label: 'ABA' }, { value: 'OTHER', label: t("Autre") },
          ]} />
          <Button title={t("J’ai reçu le paiement")} disabled={operation.pending} onPress={() => collect(booking, true)} />
          <Button title={t("Paiement non reçu")} secondary disabled={operation.pending} onPress={() => collect(booking, false)} />
          {booking.fareDetails?.guestMeter && <>
            <Field label={t("Corriger le prix du compteur (USD)")} value={correctedPrice} onChangeText={setCorrectedPrice} keyboardType="decimal-pad" />
            <Button title={t("Enregistrer le prix corrigé")} secondary disabled={operation.pending} onPress={() => void operation.run(async () => {
              const finalPriceCents = cents(correctedPrice);
              if (!await confirm(t("Corriger le prix"), `${money(booking.priceCents)} → ${money(finalPriceCents)} ?`)) return;
              update(await client().request('/api/driver/bookings', bookingResultSchema, {
                method: 'PATCH', body: { id: booking.id, expectedPriceCents: booking.priceCents, finalPriceCents },
              }));
            })} />
          </>}
        </Card>}
      </> : <Card>
        <Text style={styles.heading}>{t("Paiement et réservation")}</Text>
        {!paymentLocked(booking) && !['CANCELLED', 'NO_SHOW', 'REFUNDED'].includes(booking.status) && <>
          <Button title={t("Payer au chauffeur")} secondary disabled={operation.pending} onPress={() => void operation.run(async () => {
            update(await client().request('/api/bookings/payment-method', bookingResultSchema, { method: 'POST', body: { bookingId: booking.id, paymentMethod: 'DRIVER' } }));
          }, t("Paiement au chauffeur sélectionné."))} />
          {canPayOnline(booking, now) && <Button title={t("Choisir le paiement en ligne")} secondary disabled={operation.pending} onPress={() => void operation.run(async () => {
            update(await client().request('/api/bookings/payment-method', bookingResultSchema, { method: 'POST', body: { bookingId: booking.id, paymentMethod: 'ONLINE' } }));
          }, t("Paiement en ligne sélectionné."))} />}
        </>}
        {canPayOnline(booking, now) && booking.paymentMethod !== 'DRIVER' && <Button title={t("Payer avec ABA PayWay")} disabled={operation.pending} onPress={() => payment(booking, 'checkout')} />}
        {!paid(booking) && <Button title={t("Vérifier le paiement")} secondary disabled={operation.pending} onPress={() => payment(booking, 'verify')} />}
        {canCancel(booking) && <Button title={t("Annuler la réservation")} danger disabled={operation.pending} onPress={() => void operation.run(async () => {
          if (!await confirm(t("Annuler cette réservation"), t("Cette action annule votre trajet. Si un paiement a été reçu, le remboursement doit être traité par SAIWAY."))) return;
          update(await client().request('/api/bookings', bookingResultSchema, { method: 'DELETE', body: { id: booking.id, status: 'CANCELLED' } }));
        })} />}
      </Card>}
      {booking.payments?.filter(item => item.status === 'PAID').map((receipt, index) => <Card key={index}>
        <Text style={styles.heading}>{t("Reçu de paiement")}</Text><Text style={styles.price}>{money(receipt.amountCents, receipt.currency)}</Text>
        <Text style={styles.muted}>{t(receipt.provider)} · {receipt.collectionMethod ? t(receipt.collectionMethod) : t("En ligne")} · {booking.reference}</Text>
      </Card>)}
      {Boolean(booking.statusHistory?.length) && <Card><Text style={styles.heading}>{t("Historique")}</Text>
        {booking.statusHistory?.map((entry, index) => <View key={index}>
          <Text style={styles.label}>{t(statusLabels[entry.status] ?? entry.status)}</Text>
          <Text style={styles.muted}>{dateTime(entry.createdAt)}{entry.note ? ` · ${historyNote(entry.note)}` : ''}</Text>
        </View>)}
      </Card>}
    </>}
  </Page>;
}
