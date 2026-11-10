import { useLanguage } from '@/providers/language';
import { useEffect, useRef } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { View } from 'react-native';
import type { Point } from '@/lib/contracts';
import { colors } from './native-ui';

export type RouteMapProps = {
  from?: Point; to?: Point; driver?: Point; history?: Point[]; route?: [number, number][];
  hubs?: (Point & { id: string; name: string })[];
  onPick?: (point: Point) => void;
};
export default function RouteMap({ from, to, driver, history = [], route = [], hubs = [], onPick }: RouteMapProps) {
  const { t } = useLanguage();
  const ref = useRef<MapView>(null);
  const bounds = JSON.stringify([from, to, driver].filter((point): point is Point => Boolean(point)));
  useEffect(() => {
    const points: Point[] = JSON.parse(bounds);
    if (points.length) ref.current?.fitToCoordinates(points, { edgePadding: { top: 45, bottom: 45, left: 45, right: 45 }, animated: true });
  }, [bounds]);
  return <View style={{ borderRadius: 18, overflow: 'hidden', height: 280 }}>
    <MapView ref={ref} style={{ flex: 1 }} initialRegion={{
      ...(from ?? driver ?? { latitude: 13.36, longitude: 103.85 }), latitudeDelta: 0.06, longitudeDelta: 0.06,
    }} onMapReady={() => {
      const points: Point[] = JSON.parse(bounds);
      if (points.length) ref.current?.fitToCoordinates(points, { edgePadding: { top: 45, bottom: 45, left: 45, right: 45 }, animated: false });
    }} onPress={event => onPick?.(event.nativeEvent.coordinate)}>
      {from && <Marker coordinate={from} title={t("Départ")} pinColor={colors.primary} />}
      {to && <Marker coordinate={to} title={t("Destination")} pinColor={colors.gold} />}
      {driver && <Marker coordinate={driver} title={t("Chauffeur")} pinColor="#287FC1" />}
      {hubs.map(hub => <Marker key={hub.id} coordinate={hub} title={hub.name} pinColor={colors.gold} />)}
      {route.length > 1 && <Polyline coordinates={route.map(([longitude, latitude]) => ({ longitude, latitude }))} strokeColor={colors.primary} strokeWidth={4} />}
      {history.length > 1 && <Polyline coordinates={history} strokeColor="#287FC1" strokeWidth={3} />}
    </MapView>
  </View>;
}
