import { t } from './i18n';
import { fetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { z } from 'zod';
import { apiOrigin, createTransport } from './transport';
import { userSchema, type User } from './contracts';

const storedSchema = z.object({ origin: z.string(), cookie: z.string(), user: userSchema });
const storageKey = 'saiway.mobile.session';
let cookie: string | null = null;
let currentUser: User | null = null;
let guestCookie: string | null = null;
const guestKey = 'saiway.mobile.guest';
const guestStoredSchema = z.object({ origin: z.string(), cookie: z.string() });

export function configuredOrigin() {
  return apiOrigin(process.env.EXPO_PUBLIC_API_URL ?? '', __DEV__);
}

async function persist() {
  if (Platform.OS === 'web') throw new Error(t("Cette application utilise le stockage natif. Lancez-la sur Android ou iOS."));
  if (cookie && currentUser) {
    await SecureStore.setItemAsync(storageKey, JSON.stringify({ origin: configuredOrigin(), cookie, user: currentUser }),
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  } else {
    await SecureStore.deleteItemAsync(storageKey);
  }
}

export async function restoreSession() {
  configuredOrigin();
  if (Platform.OS === 'web') throw new Error(t("Utilisez Android ou iOS. Le site Next.js reste l’interface web."));
  const saved = await SecureStore.getItemAsync(storageKey);
  if (!saved) return null;
  const parsed = storedSchema.parse(JSON.parse(saved));
  if (parsed.origin !== configuredOrigin()) {
    await SecureStore.deleteItemAsync(storageKey);
    return null;
  }
  cookie = parsed.cookie;
  currentUser = parsed.user;
  return currentUser;
}

export async function rememberUser(user: User) {
  if (!cookie) throw new Error(t("Le serveur n’a pas retourne de cookie de session."));
  currentUser = user;
  await persist();
}

export async function forgetSession() {
  await SecureStore.deleteItemAsync(storageKey);
  cookie = null;
  currentUser = null;
}

export function authenticatedSource(path: string) {
  if (!path.startsWith('/api/') || path.includes('\\') || !cookie) throw new Error(t("Session ou chemin invalide."));
  return { uri: `${configuredOrigin()}${path}`, headers: { Cookie: cookie } };
}

export function client() {
  return createTransport({
    origin: configuredOrigin(), fetch, cookie: () => cookie,
    saveCookie: async value => { cookie = value; if (currentUser || value === null) await persist(); },
  });
}

export async function restoreGuestSession() {
  if (Platform.OS === 'web') throw new Error(t("Utilisez Android ou iOS."));
  const origin = configuredOrigin();
  const saved = await SecureStore.getItemAsync(guestKey);
  if (saved) {
    const value = guestStoredSchema.parse(JSON.parse(saved));
    guestCookie = value.origin === origin ? value.cookie : null;
    if (!guestCookie) await SecureStore.deleteItemAsync(guestKey);
  }
  await guestClient().request('/api/guest-rides/session', z.object({ ready: z.boolean() }));
}

export function guestClient() {
  return createTransport({
    origin: configuredOrigin(), fetch, cookie: () => guestCookie, cookieName: 'saiway_guest_ride',
    saveCookie: async value => {
      if (value) await SecureStore.setItemAsync(guestKey, JSON.stringify({ origin: configuredOrigin(), cookie: value }),
        { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      else await SecureStore.deleteItemAsync(guestKey);
      guestCookie = value;
    },
  });
}

export function errorMessage(error: unknown) {
  if (error instanceof z.ZodError) return t("Les donnees du serveur sont incompatibles avec cette version de l’application.");
  return error instanceof Error ? error.message : t("Une erreur inattendue est survenue.");
}
