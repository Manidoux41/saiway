import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import { configuredOrigin } from './api';

const key = 'saiway.mobile.push';
const registration = z.object({ token: z.string(), previousToken: z.string().optional(), userId: z.string(), origin: z.string() });
export async function savedPushRegistration() {
  const saved = await SecureStore.getItemAsync(key);
  return saved ? registration.parse(JSON.parse(saved)) : null;
}
export async function savePushRegistration(token: string, userId: string, previousToken?: string) {
  await SecureStore.setItemAsync(key, JSON.stringify({ token, previousToken, userId, origin: configuredOrigin() }),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}
export async function clearPushRegistration() {
  await SecureStore.deleteItemAsync(key);
}
let revision = 0;
let pending: Promise<unknown> = Promise.resolve();
export function pushRevision() { return revision; }
export function invalidatePushOperations() { revision++; }
export function withPushLock<T>(action: () => Promise<T>): Promise<T> {
  const next = pending.then(action);
  pending = next.then(() => undefined, () => undefined);
  return next;
}
