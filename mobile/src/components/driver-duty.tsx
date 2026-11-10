import { useState } from 'react';
import { Linking, Switch, Text, View } from 'react-native';
import { z } from 'zod';
import { useApi, useOperation } from '@/hooks/use-api';
import { client } from '@/lib/api';
import { availabilitySchema, availabilityStateSchema } from '@/lib/contracts';
import { useGps } from '@/providers/gps';
import { Button, Card, Choices, dateTime, Notice, styles } from './native-ui';
import RouteMap from './route-map';

const updatedSchema = z.object({ driverAvailability: availabilityStateSchema });
export function DriverDuty() {
  const state = useApi('/api/driver/availability', availabilitySchema);
  const operation = useOperation();
  const gps = useGps();
  const [chosenVehicle, setChosenVehicle] = useState<string | null>(null);
  const vehicleId = chosenVehicle ?? state.data?.driverAvailability.selectedVehicleId ?? '';
  function update(isAvailable: boolean) {
    void operation.run(async () => {
      await client().request('/api/driver/availability', updatedSchema, {
        method: 'PATCH', body: { isAvailable, selectedVehicleId: vehicleId || null },
      });
      state.refresh(); gps.access.refresh();
    }, 'Disponibilité enregistrée.');
  }
  return <Card>
    <Text style={styles.heading}>Votre service</Text>
    <Notice error={state.error || operation.error || gps.access.error || gps.error} message={operation.message} />
    {state.data && <>
      <Text style={styles.text}>{state.data.driverAvailability.isAvailable ? 'Disponible pour des courses' : 'Indisponible'}</Text>
      <Choices value={vehicleId} onChange={setChosenVehicle} disabled={operation.pending}
        options={state.data.vehicles.map(vehicle => ({ value: vehicle.id, label: `${vehicle.name} · ${vehicle.plate}` }))} />
      <Button title="Enregistrer et me rendre disponible" disabled={!vehicleId || operation.pending}
        onPress={() => update(true)} />
      <Button title="Me rendre indisponible" secondary disabled={operation.pending} onPress={() => update(false)} />
    </>}
    {state.error && <Button title="Réessayer" secondary onPress={state.refresh} />}
    <View style={[styles.row, { justifyContent: 'space-between' }]}>
      <Text style={styles.label}>Partager mon GPS</Text>
      <Switch accessibilityLabel="Partager ma position au premier plan" value={gps.enabled} onValueChange={gps.setEnabled} />
    </View>
    <Text style={styles.muted}>Avec votre accord, en service uniquement et tant que l’application reste ouverte. Gardez cet écran actif pendant une course au compteur.</Text>
    <Text style={styles.muted}>{gps.lastSent ? `Dernier envoi : ${dateTime(gps.lastSent)}` : 'Aucune position envoyée.'}</Text>
    {gps.access.data?.returningToHub && <Text style={styles.text}>Retour au dépôt en cours.</Text>}
    {gps.point && <RouteMap driver={gps.point} hubs={gps.access.data?.hubs} />}
    {gps.access.data?.returningToHub && gps.access.data.hubs.map(hub =>
      <Button key={hub.id} title={`Rejoindre ${hub.name}`} secondary onPress={() => void operation.run(async () => {
        await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${hub.latitude},${hub.longitude}`);
      })} />)}
    {gps.enabled && <Button title="Actualiser ma position" secondary disabled={operation.pending}
      onPress={() => void operation.run(async () => { await gps.sendNow(); }, 'Position transmise.')} />}
  </Card>;
}
