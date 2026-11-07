export const movementPushIntervalMs = 60_000;
export const pushKinds = ["AVAILABLE", "UNAVAILABLE", "BOOKED", "NEW_BOOKING", "DISPATCHED", "ASSIGNED", "ARRIVED", "EN_ROUTE", "STARTED", "COMPLETED", "MOVING", "TEST"] as const;
export type PushKind = typeof pushKinds[number];

export function allowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash &&
      (["fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(url.hostname) ||
        url.hostname.endsWith(".notify.windows.com"));
  } catch { return false; }
}

export function movingBetween(
  earlier: { latitude: number; longitude: number; accuracy: number | null },
  current: { latitude: number; longitude: number; accuracy: number | null },
): boolean {
  if (earlier.accuracy === null || current.accuracy === null || earlier.accuracy > 50 || current.accuracy > 50) return false;
  const radians = (n: number) => n * Math.PI / 180;
  const a = Math.sin(radians(current.latitude - earlier.latitude) / 2) ** 2 +
    Math.cos(radians(earlier.latitude)) * Math.cos(radians(current.latitude)) * Math.sin(radians(current.longitude - earlier.longitude) / 2) ** 2;
  const distance = 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return distance >= Math.max(50, earlier.accuracy + current.accuracy);
}
