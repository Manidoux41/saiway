import { useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { z } from 'zod';
import { useSession } from '@/providers/session';
import { useApi, useOperation } from '@/hooks/use-api';
import { client } from '@/lib/api';
import { availabilitySchema, bookingsSchema, bookingResultSchema, walkupQuoteSchema } from '@/lib/contracts';
import { cents, integer } from '@/lib/policy';
import { AddressField } from '@/components/address-field';
import RouteMap from '@/components/route-map';
import { Button, Card, Choices, confirm, Field, money, Notice, Page, styles } from '@/components/native-ui';

export default function Walkup() {
  const { user } = useSession();
  const { guestId } = useLocalSearchParams<{ guestId?: string }>();
  const driver = user?.role === 'driver';
  const vehicles = useApi(driver ? '/api/driver/availability' : null, availabilitySchema);
  const bookings = useApi(driver && guestId ? '/api/driver/bookings' : null, bookingsSchema);
  const guest = bookings.data?.bookings.find(booking => booking.id === guestId);
  const operation = useOperation();
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [passengers, setPassengers] = useState('1');
  const [passengerName, setPassengerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [agreedPrice, setAgreedPrice] = useState('');
  const [reason, setReason] = useState('');
  const [quote, setQuote] = useState<{ key: string; value: z.infer<typeof walkupQuoteSchema> } | null>(null);
  const selectedVehicle = guest?.vehicleId ?? (vehicleId || vehicles.data?.driverAvailability.selectedVehicleId || '');
  const pickup = guest?.fromAddress ?? fromAddress;
  const key = JSON.stringify([pickup, toAddress, selectedVehicle, guestId]);
  const currentQuote = quote?.key === key ? quote.value : null;
  if (!driver) return <Redirect href="/(main)/trips" />;
  function preview() {
    void operation.run(async () => {
      if (!pickup.trim() || !toAddress.trim() || !selectedVehicle) throw new Error('Départ, destination et véhicule sont obligatoires.');
      if (guestId && (!guest || guest.status !== 'DRIVER_ARRIVED')) throw new Error('Marquez la prise en charge invité comme arrivée avant de choisir sa destination.');
      const result = await client().request('/api/driver/bookings', walkupQuoteSchema, {
        method: 'POST', body: { action: 'preview', selection: { fromAddress: pickup.trim(), toAddress: toAddress.trim(), vehicleId: selectedVehicle } },
      });
      setQuote({ key, value: result });
    });
  }
  function start() {
    void operation.run(async () => {
      if (!currentQuote || currentQuote.expiresAt <= Date.now()) throw new Error('Recalculez le trajet : devis absent ou expiré.');
      const outside = currentQuote.priceCents === null;
      const agreedPriceCents = outside ? cents(agreedPrice) : undefined;
      if (outside && reason.trim().length < 3) throw new Error('Indiquez le motif du prix convenu hors zone.');
      const body = {
        quoteToken: currentQuote.token, passengers: guest ? guest.passengers : integer(passengers, 1, 50, 'Passagers'),
        ...(guest ? { guestBookingId: guest.id } : {
          ...(passengerName.trim() ? { passengerName: passengerName.trim() } : {}),
          ...(customerEmail.trim() ? { customerEmail: customerEmail.trim().toLowerCase() } : {}),
          ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
        }),
        ...(outside ? { agreedPriceCents, priceReason: reason.trim() } : {}),
      };
      if (!await confirm('Démarrer la course maintenant', `${money(currentQuote.priceCents ?? agreedPriceCents ?? 0)} · le passager doit accepter le trajet et son prix.`)) return;
      const result = await client().request('/api/driver/bookings', bookingResultSchema, { method: 'POST', body });
      setQuote(null);
      router.push({ pathname: '/trip/[id]', params: { id: result.booking.id } });
    });
  }
  return <Page title={guestId ? 'Destination de l’invité' : 'Course immédiate'} subtitle="Trajet et tarif calculés par le serveur.">
    <Notice error={vehicles.error || bookings.error} />
    <Card>
      <AddressField label="Départ" value={pickup} onChange={setFromAddress} disabled={Boolean(guestId) || operation.pending} />
      <AddressField label="Destination" value={toAddress} onChange={setToAddress} disabled={operation.pending} />
      {!guestId && <Choices value={selectedVehicle} onChange={setVehicleId} disabled={operation.pending}
        options={(vehicles.data?.vehicles ?? []).map(vehicle => ({ value: vehicle.id, label: `${vehicle.name} · ${vehicle.plate}` }))} />}
      <Button title="Calculer le trajet" disabled={operation.pending || Boolean(guestId && !guest)} onPress={preview} />
      {currentQuote && <>
        <RouteMap from={currentQuote.route.from} to={currentQuote.route.to} route={currentQuote.route.coordinates} />
        <Text style={styles.text}>{(currentQuote.route.distanceMeters / 1000).toFixed(1)} km · {Math.ceil(currentQuote.route.durationSeconds / 60)} min</Text>
        <Text style={styles.price}>{currentQuote.priceCents === null ? 'Prix à convenir hors zone' : money(currentQuote.priceCents)}</Text>
        {currentQuote.priceCents === null && <>
          <Field label="Prix convenu (USD)" value={agreedPrice} onChangeText={setAgreedPrice} keyboardType="decimal-pad" />
          <Field label="Motif du prix" value={reason} onChangeText={setReason} multiline maxLength={2000} />
        </>}
      </>}
    </Card>
    {!guestId && <Card>
      <Field label="Nombre de passagers" value={passengers} onChangeText={setPassengers} keyboardType="number-pad" />
      <Field label="Nom du passager (facultatif)" value={passengerName} onChangeText={setPassengerName} maxLength={200} />
      <Field label="Email d’un client existant (facultatif)" value={customerEmail} onChangeText={setCustomerEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Téléphone (facultatif)" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" maxLength={50} />
    </Card>}
    <Notice error={operation.error} />
    <Button title="Démarrer la course" disabled={operation.pending || !currentQuote} onPress={start} />
  </Page>;
}
