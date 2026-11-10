import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Text } from 'react-native';
import { z } from 'zod';
import { useSession } from '@/providers/session';
import { useApi, useOperation } from '@/hooks/use-api';
import { client } from '@/lib/api';
import { bookingResultSchema, professionalSchema, quoteSchema } from '@/lib/contracts';
import { integer, pickupIso } from '@/lib/policy';
import { AddressField } from '@/components/address-field';
import { Button, Card, Choices, confirm, Field, money, Notice, Page, styles } from '@/components/native-ui';

const placesSchema = z.object({ places: z.array(z.string()) });
const tripTypes = [
  { value: 'AIRPORT_TRANSFER', label: 'Aéroport' }, { value: 'CITY_TRANSFER', label: 'Ville' },
  { value: 'TOURIST_TOUR', label: 'Excursion' }, { value: 'PRIVATE_TRANSFER', label: 'Privé' },
  { value: 'HOTEL_TRANSFER', label: 'Hôtel' },
];
export default function Book() {
  const { user } = useSession();
  const history = useApi(user?.role === 'customer' ? '/api/bookings/places' : null, placesSchema);
  const professional = useApi(user?.role === 'customer' ? '/api/professionals' : null, professionalSchema);
  const operation = useOperation();
  const [form, setForm] = useState(() => ({
    fromAddress: 'SAI Airport', toAddress: '', direction: 'AIRPORT_TO_CITY', tripType: 'AIRPORT_TRANSFER',
    date: new Date(Date.now() + 86400000 + 7 * 3600000).toISOString().slice(0, 10), time: '14:30',
    passengers: '2', luggageCount: '2', passengerName: '', contactPhone: '', flightNumber: '', pickupNotes: '',
    specialNeeds: '', paymentMethod: 'DRIVER', tourCircuit: 'SMALL', tourHours: '8',
  }));
  const [quote, setQuote] = useState<{ key: string; value: z.infer<typeof quoteSchema> } | null>(null);
  const routeKey = JSON.stringify([form.fromAddress, form.toAddress, form.direction, form.tripType, form.tourCircuit, form.tourHours]);
  function field(key: keyof typeof form, value: string) { setForm(current => ({ ...current, [key]: value })); }
  function selection() {
    if (!form.fromAddress.trim() || !form.toAddress.trim()) throw new Error('Choisissez un départ et une destination.');
    return {
      fromAddress: form.fromAddress.trim(), toAddress: form.toAddress.trim(), direction: form.direction,
      tripType: form.tripType,
      ...(form.tripType === 'TOURIST_TOUR' ? { tourCircuit: form.tourCircuit, tourHours: integer(form.tourHours, 1, 48, 'Durée') } : {}),
    };
  }
  const allowed = Boolean(professional.data && (!professional.data.professional || professional.data.professional.status === 'APPROVED'));
  if (user?.role !== 'customer') return <Redirect href="/(main)/trips" />;
  function calculate() {
    void operation.run(async () => {
      const params = new URLSearchParams(Object.entries(selection()).map(([key, value]) => [key, String(value)]));
      const value = await client().request(`/api/bookings/quote?${params}`, quoteSchema);
      setQuote({ key: routeKey, value });
    });
  }
  function book() {
    void operation.run(async () => {
      if (!quote || quote.key !== routeKey) throw new Error('Recalculez le prix avant de réserver.');
      const pickupAt = pickupIso(form.date, form.time);
      if (professional.data?.professional && !form.passengerName.trim()) throw new Error('Le nom du passager est obligatoire pour un compte professionnel.');
      const body = {
        ...selection(), pickupAt, passengers: integer(form.passengers, 1, 50, 'Passagers'),
        luggageCount: integer(form.luggageCount, 0, 50, 'Bagages'), passengerName: form.passengerName.trim() || undefined,
        contactPhone: form.contactPhone.trim(), flightNumber: form.flightNumber.trim(), pickupNotes: form.pickupNotes.trim(),
        specialNeeds: form.specialNeeds.trim(), paymentMethod: form.tripType === 'TOURIST_TOUR' ? 'DRIVER' : form.paymentMethod,
      };
      if (!await confirm('Confirmer la réservation', `${money(quote.value.priceCents, quote.value.currency)} · heure locale du Cambodge\nLe serveur confirme le tarif lors de la création.`)) return;
      const result = await client().request('/api/bookings', bookingResultSchema, { method: 'POST', body });
      setQuote(null);
      router.push({ pathname: '/trip/[id]', params: { id: result.booking.id } });
    });
  }
  return <Page title="Réserver un trajet" subtitle="Prix calculé par SAIWAY, jamais par le téléphone.">
    <Notice error={professional.error || history.error} />
    {professional.data?.professional && <Card>
      <Text style={styles.heading}>{professional.data.professional.companyName}</Text>
      <Text style={styles.text}>Statut professionnel : {professional.data.professional.status}</Text>
      {!allowed && <Text style={styles.error}>Votre compte doit être approuvé avant de réserver.</Text>}
    </Card>}
    <Card>
      <Choices value={form.tripType} options={tripTypes} disabled={operation.pending} onChange={value => field('tripType', value)} />
      <AddressField label="Départ" value={form.fromAddress} onChange={value => field('fromAddress', value)}
        places={['SAI Airport', ...(history.data?.places ?? [])]} disabled={operation.pending} />
      <AddressField label="Destination" value={form.toAddress} onChange={value => field('toAddress', value)}
        places={['SAI Airport', ...(history.data?.places ?? [])]} disabled={operation.pending} />
      <Button title="Inverser le trajet" secondary disabled={operation.pending} onPress={() => setForm(current => ({
        ...current, fromAddress: current.toAddress, toAddress: current.fromAddress,
        direction: current.direction === 'AIRPORT_TO_CITY' ? 'CITY_TO_AIRPORT' : 'AIRPORT_TO_CITY',
      }))} />
      <Choices value={form.direction} disabled={operation.pending} onChange={value => field('direction', value)}
        options={[{ value: 'AIRPORT_TO_CITY', label: 'Aéroport → ville' }, { value: 'CITY_TO_AIRPORT', label: 'Ville → aéroport' }]} />
      {form.tripType === 'TOURIST_TOUR' && <>
        <Choices value={form.tourCircuit} onChange={value => field('tourCircuit', value)} disabled={operation.pending}
          options={[{ value: 'SMALL', label: 'Petit circuit' }, { value: 'GRAND', label: 'Grand circuit' }, { value: 'REMOTE', label: 'Éloigné' }]} />
        <Field label="Durée (heures, 1 à 48)" value={form.tourHours} onChangeText={value => field('tourHours', value)} keyboardType="number-pad" />
      </>}
      <Button title="Calculer le prix" disabled={operation.pending || !allowed} onPress={calculate} />
      {quote?.key === routeKey && <><Text style={styles.price}>{money(quote.value.priceCents, quote.value.currency)}</Text>
        <Text style={styles.muted}>Tarif estimatif. Les suppléments d’excursion et les courses au compteur sont réglés au chauffeur.</Text></>}
    </Card>
    <Card>
      <Field label="Date (AAAA-MM-JJ, Cambodge)" value={form.date} onChangeText={value => field('date', value)} maxLength={10} />
      <Field label="Heure (HH:MM, Cambodge UTC+7)" value={form.time} onChangeText={value => field('time', value)} maxLength={5} />
      <Field label="Passagers (1 à 50)" value={form.passengers} onChangeText={value => field('passengers', value)} keyboardType="number-pad" />
      <Field label="Bagages (0 à 50)" value={form.luggageCount} onChangeText={value => field('luggageCount', value)} keyboardType="number-pad" />
      <Field label="Nom du passager" value={form.passengerName} onChangeText={value => field('passengerName', value)} maxLength={200} />
      <Field label="Téléphone du passager" value={form.contactPhone} onChangeText={value => field('contactPhone', value)} keyboardType="phone-pad" maxLength={30} />
      <Field label="Numéro de vol" value={form.flightNumber} onChangeText={value => field('flightNumber', value)} maxLength={100} />
      <Field label="Instructions de prise en charge" value={form.pickupNotes} onChangeText={value => field('pickupNotes', value)} multiline maxLength={2000} />
      <Field label="Besoins particuliers" value={form.specialNeeds} onChangeText={value => field('specialNeeds', value)} multiline maxLength={2000} />
      {form.tripType !== 'TOURIST_TOUR' && <Choices value={form.paymentMethod} onChange={value => field('paymentMethod', value)}
        options={[{ value: 'DRIVER', label: 'Payer au chauffeur' }, { value: 'ONLINE', label: 'Payer en ligne' }]} />}
      <Notice error={operation.error} />
      <Button title={operation.pending ? 'Enregistrement…' : 'Confirmer ma réservation'}
        disabled={operation.pending || !allowed || quote?.key !== routeKey} onPress={book} />
    </Card>
  </Page>;
}
