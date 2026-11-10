import { useState } from 'react';
import * as Location from 'expo-location';
import type { Point } from '@/lib/contracts';
import { useOperation } from '@/hooks/use-api';
import { Button, Field, Notice } from './native-ui';
import RouteMap from './route-map';

export function coordinateAddress(point: Point) {
  return `GPS: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
}
export function AddressField({ label, value, onChange, places = [], disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; places?: string[]; disabled?: boolean;
}) {
  const [mapOpen, setMapOpen] = useState(false);
  const [point, setPoint] = useState<Point | undefined>();
  const operation = useOperation();
  const matches = value.trim().length > 1 ? places.filter(place => place !== value && place.toLowerCase().includes(value.toLowerCase())).slice(0, 3) : [];
  return <>
    <Field label={label} value={value} onChangeText={onChange} editable={!disabled} maxLength={500}
      placeholder="Adresse, hôtel ou point GPS" />
    {!disabled && <>
      {matches.map(place => <Button key={place} title={place} secondary onPress={() => onChange(place)} />)}
      <Button title="Ma position actuelle" secondary disabled={operation.pending} onPress={() => void operation.run(async () => {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) throw new Error('La localisation est nécessaire pour utiliser votre position.');
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setPoint(location.coords); onChange(coordinateAddress(location.coords));
      })} />
      <Button title={mapOpen ? 'Fermer la carte' : 'Choisir sur la carte'} secondary onPress={() => setMapOpen(!mapOpen)} />
      {mapOpen && <RouteMap from={point} onPick={selected => { setPoint(selected); onChange(coordinateAddress(selected)); }} />}
      <Notice error={operation.error} />
    </>}
  </>;
}
