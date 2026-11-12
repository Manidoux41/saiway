import { useLanguage } from '@/providers/language';
import { Text } from 'react-native';
import type { RouteMapProps } from '@/lib/leaflet-map';
export type { RouteMapProps } from '@/lib/leaflet-map';
export default function RouteMap(_props: RouteMapProps) {
  const { t } = useLanguage();
  return <Text>{t("La carte native est disponible sur Android et iOS.")}</Text>;
}
