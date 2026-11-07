type Point = { latitude: number; longitude: number };
type Fix = Point & { accuracy: number | null; recordedAt: Date };

export const arrivalRadiusMeters = 50;
export const arrivalAccuracyMeters = 20;
export const arrivalDwellMs = 15_000;
export const arrivalWindowMs = 45_000;
const maxGapMs = 20_000;

export function metersBetween(a: Point, b: Point) {
  const radians = (value: number) => value * Math.PI / 180;
  const value = Math.sin(radians(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
}

export function arrivalConfirmed(pickup: Point, fixes: Fix[], now: Date): boolean {
  const latest = fixes.at(-1);
  if (!latest || latest.recordedAt.getTime() !== now.getTime()) return false;
  let end = now.getTime();
  for (let index = fixes.length - 1; index >= 0; index--) {
    const fix = fixes[index];
    const at = fix.recordedAt.getTime();
    if (at > end || end - at > maxGapMs || now.getTime() - at > arrivalWindowMs ||
      fix.accuracy === null || !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > arrivalAccuracyMeters ||
      !Number.isFinite(fix.latitude) || !Number.isFinite(fix.longitude) ||
      metersBetween(pickup, fix) > arrivalRadiusMeters) return false;
    if (now.getTime() - at >= arrivalDwellMs) return true;
    end = at;
  }
  return false;
}
