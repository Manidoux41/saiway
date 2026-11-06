export type LocationPoint = { latitude: number; longitude: number };

export function validLocationPoint(point: LocationPoint): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

export function coordinateAddress(point: LocationPoint): string {
  if (!validLocationPoint(point)) throw new Error("Invalid GPS coordinates");
  return `GPS: ${point.latitude.toFixed(7)}, ${point.longitude.toFixed(7)}`;
}

export function parseCoordinateAddress(value: string): LocationPoint | null {
  const match = value.trim().match(/^(?:GPS:\s*)?([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/i);
  if (!match) return null;
  const point = { latitude: Number(match[1]), longitude: Number(match[2]) };
  return validLocationPoint(point) ? point : null;
}
