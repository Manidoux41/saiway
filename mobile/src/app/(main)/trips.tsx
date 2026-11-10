import { useLanguage } from '@/providers/language';
import { useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useSession } from '@/providers/session';
import { useApi } from '@/hooks/use-api';
import { bookingsSchema } from '@/lib/contracts';
import { closedStatuses, paid, visibleBookings } from '@/lib/policy';
import { Button, Card, Choices, Field, Loading, Notice, Page, statusLabels, styles } from '@/components/native-ui';
import { DriverDuty } from '@/components/driver-duty';

export default function Trips() {
  const { t, money, dateTime } = useLanguage();
  const { user } = useSession();
  const driver = user?.role === 'driver';
  const resource = useApi(user ? driver ? '/api/driver/bookings' : '/api/bookings' : null, bookingsSchema, 10000);
  const [filter, setFilter] = useState('upcoming');
  const [query, setQuery] = useState('');
  const bookings = resource.data?.bookings ?? [];
  const visible = visibleBookings(bookings, filter, query);
  const active = bookings.filter(booking => !closedStatuses.includes(booking.status));
  const revenue = bookings.reduce((total, booking) => total + (booking.status === 'TRIP_COMPLETED' && paid(booking) ? booking.priceCents : 0), 0);
  return <Page title={t('Bonjour {p0}.', { p0: user?.name.split(' ')[0] ?? '' })}
    subtitle={driver ? t("Votre activité chauffeur · heure du Cambodge") : t("Vos déplacements, simplement.")}
    refreshing={resource.loading} onRefresh={resource.refresh}>
    <Card hero><Text style={[styles.heading, { color: '#FFFFFF' }]}>{driver ? t("En route avec SAIWAY") : t("Prêt pour votre prochain départ ?")}</Text>
      <View style={styles.row}><Text style={[styles.text, { color: '#FFFFFF' }]}>{active.length} {' '}{t("trajet(s) à venir")}</Text>
        {driver && <Text style={[styles.text, { color: '#DFB56B' }]}>{money(revenue)} {' '}{t("encaissés")}</Text>}</View>
      <Button title={driver ? t("Créer une course immédiate") : t("Réserver un trajet")}
        onPress={() => router.push(driver ? '/(main)/walkup' : '/(main)/book')} /></Card>
    {driver && <DriverDuty />}
    <Choices value={filter} onChange={setFilter} options={[
      { value: 'upcoming', label: t("À venir") }, ...(driver ? [{ value: 'today', label: t("Aujourd’hui") }] : [{ value: 'payment', label: t("À régler") }]),
      { value: 'history', label: t("Historique") }, { value: 'all', label: t("Tous") },
    ]} />
    <Field label={t("Rechercher une course")} value={query} onChangeText={setQuery} placeholder={t("Référence, adresse, passager…")} />
    <Notice error={resource.error} />
    {resource.loading && !resource.data && <Loading />}
    {resource.data && !visible.length && <Card><Text style={styles.muted}>{t("Aucune course pour cette sélection.")}</Text></Card>}
    {visible.map(booking => <Card key={booking.id}>
      <View style={styles.row}><Text style={[styles.eyebrow, { flex: 1 }]}>{booking.reference}</Text>
        <Text style={styles.label}>{money(booking.priceCents, booking.currency)}</Text></View>
      <Text style={styles.heading}>{booking.fromAddress}</Text><Text style={styles.muted}>{t("vers")}</Text>
      <Text style={styles.heading}>{booking.toAddress}</Text>
      <Text style={styles.muted}>{dateTime(booking.pickupAt)} · {booking.passengers} {' '}{t("passager(s)")}</Text>
      <View style={styles.row}><Text style={styles.badge}>{t(statusLabels[booking.status] ?? booking.status)}</Text>
        <Text style={styles.muted}>{paid(booking) ? t("Payée") : t("À régler")}</Text></View>
      {booking.professionalCompany && <Text style={styles.muted}>{booking.professionalCompany} · {booking.passengerName}</Text>}
      <Button title={t("Voir la course")} secondary onPress={() => router.push({ pathname: '/trip/[id]', params: { id: booking.id } })} />
    </Card>)}
  </Page>;
}
