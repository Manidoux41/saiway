import { useLanguage } from '@/providers/language';
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
import { Button, Card, Choices, confirm, Field, Notice, Page, styles } from '@/components/native-ui';

const placesSchema = z.object({ places: z.array(z.string()) });
const tripTypes = [
  { value: 'AIRPORT_TRANSFER', label: 'Aéroport' }, { value: 'CITY_TRANSFER', label: 'Ville' },
  { value: 'TOURIST_TOUR', label: 'Excursion' }, { value: 'PRIVATE_TRANSFER', label: 'Privé' },
  { value: 'HOTEL_TRANSFER', label: 'Hôtel' },
];
export default function Book() {
  const { t, money } = useLanguage();
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
    if (!form.fromAddress.trim() || !form.toAddress.trim()) throw new Error(t("Choisissez un départ et une destination."));
    return {
      fromAddress: form.fromAddress.trim(), toAddress: form.toAddress.trim(), direction: form.direction,
      tripType: form.tripType,
      ...(form.tripType === 'TOURIST_TOUR' ? { tourCircuit: form.tourCircuit, tourHours: integer(form.tourHours, 1, 48, t("Durée")) } : {}),
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
      if (!quote || quote.key !== routeKey) throw new Error(t("Recalculez le prix avant de réserver."));
      const pickupAt = pickupIso(form.date, form.time);
      if (professional.data?.professional && !form.passengerName.trim()) throw new Error(t("Le nom du passager est obligatoire pour un compte professionnel."));
      const body = {
        ...selection(), pickupAt, passengers: integer(form.passengers, 1, 50, t("Passagers")),
        luggageCount: integer(form.luggageCount, 0, 50, t("Bagages")), passengerName: form.passengerName.trim() || undefined,
        contactPhone: form.contactPhone.trim(), flightNumber: form.flightNumber.trim(), pickupNotes: form.pickupNotes.trim(),
        specialNeeds: form.specialNeeds.trim(), paymentMethod: form.tripType === 'TOURIST_TOUR' ? 'DRIVER' : form.paymentMethod,
      };
      if (!await confirm(t("Confirmer la réservation"), t("{p0} · heure locale du Cambodge\nLe serveur confirme le tarif lors de la création.", { p0: money(quote.value.priceCents, quote.value.currency) }))) return;
      const result = await client().request('/api/bookings', bookingResultSchema, { method: 'POST', body });
      setQuote(null);
      router.push({ pathname: '/trip/[id]', params: { id: result.booking.id } });
    });
  }
  return <Page title={t("Réserver un trajet")} subtitle={t("Prix calculé par SAIWAY, jamais par le téléphone.")}>
    <Notice error={professional.error || history.error} />
    {professional.data?.professional && <Card>
      <Text style={styles.heading}>{professional.data.professional.companyName}</Text>
      <Text style={styles.text}>{t("Statut professionnel :")}{' '}{t(professional.data.professional.status)}</Text>
      {!allowed && <Text style={styles.error}>{t("Votre compte doit être approuvé avant de réserver.")}</Text>}
    </Card>}
    <Card>
      <Choices value={form.tripType} options={tripTypes.map(option => ({ ...option, label: t(option.label) }))} disabled={operation.pending} onChange={value => field('tripType', value)} />
      <AddressField label={t("Départ")} value={form.fromAddress} onChange={value => field('fromAddress', value)}
        places={['SAI Airport', ...(history.data?.places ?? [])]} disabled={operation.pending} />
      <AddressField label={t("Destination")} value={form.toAddress} onChange={value => field('toAddress', value)}
        places={['SAI Airport', ...(history.data?.places ?? [])]} disabled={operation.pending} />
      <Button title={t("Inverser le trajet")} secondary disabled={operation.pending} onPress={() => setForm(current => ({
        ...current, fromAddress: current.toAddress, toAddress: current.fromAddress,
        direction: current.direction === 'AIRPORT_TO_CITY' ? 'CITY_TO_AIRPORT' : 'AIRPORT_TO_CITY',
      }))} />
      <Choices value={form.direction} disabled={operation.pending} onChange={value => field('direction', value)}
        options={[{ value: 'AIRPORT_TO_CITY', label: t("Aéroport → ville") }, { value: 'CITY_TO_AIRPORT', label: t("Ville → aéroport") }]} />
      {form.tripType === 'TOURIST_TOUR' && <>
        <Choices value={form.tourCircuit} onChange={value => field('tourCircuit', value)} disabled={operation.pending}
          options={[{ value: 'SMALL', label: t("Petit circuit") }, { value: 'GRAND', label: t("Grand circuit") }, { value: 'REMOTE', label: t("Éloigné") }]} />
        <Field label={t("Durée (heures, 1 à 48)")} value={form.tourHours} onChangeText={value => field('tourHours', value)} keyboardType="number-pad" />
      </>}
      <Button title={t("Calculer le prix")} disabled={operation.pending || !allowed} onPress={calculate} />
      {quote?.key === routeKey && <><Text style={styles.price}>{money(quote.value.priceCents, quote.value.currency)}</Text>
        <Text style={styles.muted}>{t("Tarif estimatif. Les suppléments d’excursion et les courses au compteur sont réglés au chauffeur.")}</Text></>}
    </Card>
    <Card>
      <Field label={t("Date (AAAA-MM-JJ, Cambodge)")} value={form.date} onChangeText={value => field('date', value)} maxLength={10} />
      <Field label={t("Heure (HH:MM, Cambodge UTC+7)")} value={form.time} onChangeText={value => field('time', value)} maxLength={5} />
      <Field label={t("Passagers (1 à 50)")} value={form.passengers} onChangeText={value => field('passengers', value)} keyboardType="number-pad" />
      <Field label={t("Bagages (0 à 50)")} value={form.luggageCount} onChangeText={value => field('luggageCount', value)} keyboardType="number-pad" />
      <Field label={t("Nom du passager")} value={form.passengerName} onChangeText={value => field('passengerName', value)} maxLength={200} />
      <Field label={t("Téléphone du passager")} value={form.contactPhone} onChangeText={value => field('contactPhone', value)} keyboardType="phone-pad" maxLength={30} />
      <Field label={t("Numéro de vol")} value={form.flightNumber} onChangeText={value => field('flightNumber', value)} maxLength={100} />
      <Field label={t("Instructions de prise en charge")} value={form.pickupNotes} onChangeText={value => field('pickupNotes', value)} multiline maxLength={2000} />
      <Field label={t("Besoins particuliers")} value={form.specialNeeds} onChangeText={value => field('specialNeeds', value)} multiline maxLength={2000} />
      {form.tripType !== 'TOURIST_TOUR' && <Choices value={form.paymentMethod} onChange={value => field('paymentMethod', value)}
        options={[{ value: 'DRIVER', label: t("Payer au chauffeur") }, { value: 'ONLINE', label: t("Payer en ligne") }]} />}
      <Notice error={operation.error} />
      <Button title={operation.pending ? t("Enregistrement…") : t("Confirmer ma réservation")}
        disabled={operation.pending || !allowed || quote?.key !== routeKey} onPress={book} />
    </Card>
  </Page>;
}
