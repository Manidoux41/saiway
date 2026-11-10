import { Text } from 'react-native';
import type { Point } from '@/lib/contracts';

export type RouteMapProps = {
  from?: Point; to?: Point; driver?: Point; history?: Point[]; route?: [number, number][];
  hubs?: (Point & { id: string; name: string })[];
  onPick?: (point: Point) => void;
};
export default function RouteMap(_props: RouteMapProps) {
  return <Text>La carte native est disponible sur Android et iOS.</Text>;
}
