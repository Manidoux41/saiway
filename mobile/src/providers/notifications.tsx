import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import { z } from 'zod';
import { client, configuredOrigin, errorMessage } from '@/lib/api';
import { clearPushRegistration, pushRevision, savedPushRegistration, savePushRegistration, withPushLock } from '@/lib/native-push';
import { notificationDestination } from '@/lib/notification-policy';
import { useLanguage } from './language';
import { useSession } from './session';

const statusSchema = z.object({ enabled: z.boolean(), configured: z.boolean() });
const enabledSchema = z.object({ enabled: z.literal(true) });
const disabledSchema = z.object({ disabled: z.literal(true) });
type NotificationState = { enabled: boolean; pending: boolean; error: string; message: string; enable: () => Promise<void>; disable: () => Promise<void>; test: () => Promise<void>; settings: () => Promise<void> };
const Context = createContext<NotificationState | null>(null);
const supported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && Platform.OS !== 'web';
async function notifications() {
  if (!supported) throw new Error('Les notifications nécessitent une version SAIWAY installée, pas Expo Go.');
  return import('expo-notifications');
}

export function NotificationsProvider({ children }: PropsWithChildren) {
  const { user, ready, error: sessionError } = useSession();
  const { language, t } = useLanguage();
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const seen = useRef<string | null>(null);
  const userId = user?.id;
  const sync = useCallback(async () => {
    const revision = pushRevision();
    return withPushLock(async () => {
    if (revision !== pushRevision()) return;
    setEnabled(false);
    if (!userId || !ready || sessionError || !supported) return;
    const saved = await savedPushRegistration();
    if (!saved) return;
    if (saved.userId !== userId || saved.origin !== configuredOrigin()) {
      throw new Error(t('Cet appareil doit réactiver ses notifications pour ce compte.'));
    }
    const api = await notifications();
    const permission = await api.getPermissionsAsync();
    if (!permission.granted) {
      await client().request('/api/notifications/native', disabledSchema, { method: 'DELETE', body: { token: saved.token } });
      if (saved.previousToken) await client().request('/api/notifications/native', disabledSchema, { method: 'DELETE', body: { token: saved.previousToken } });
      await clearPushRegistration();
      return;
    }
    const status = await client().request(`/api/notifications/native?token=${encodeURIComponent(saved.token)}`, statusSchema);
    setEnabled(status.enabled);
    if (!status.configured) throw new Error(t('Les notifications natives ne sont pas configurées sur le serveur.'));
    if (!status.enabled) {
      if (saved.previousToken) await client().request('/api/notifications/native', disabledSchema, { method: 'DELETE', body: { token: saved.previousToken } });
      await clearPushRegistration(); setError(''); return;
    }
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (typeof projectId !== 'string') throw new Error(t('Identifiant du projet Expo manquant.'));
    const current = (await api.getExpoPushTokenAsync({ projectId })).data;
    if (saved.previousToken) await client().request('/api/notifications/native', disabledSchema, { method: 'DELETE', body: { token: saved.previousToken } });
    if (current !== saved.token) await savePushRegistration(current, userId, saved.token);
    await client().request('/api/notifications/native', enabledSchema, {
      method: 'POST', body: { token: current, platform: Platform.OS, language },
    });
    if (current !== saved.token) await client().request('/api/notifications/native', disabledSchema, { method: 'DELETE', body: { token: saved.token } });
    await savePushRegistration(current, userId);
    setEnabled(true);
    setError('');
    });
  }, [userId, ready, sessionError, language, t]);
  useEffect(() => {
    let active = true;
    const refresh = () => { void sync().catch(failure => { if (active) setError(errorMessage(failure)); }); };
    refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { active = false; listener.remove(); };
  }, [sync]);
  useEffect(() => {
    if (!supported || !userId || !ready || sessionError) return;
    let active = true;
    let listener: { remove: () => void } | undefined;
    let tokenListener: { remove: () => void } | undefined;
    let cleanupHandler: (() => void) | undefined;
    void notifications().then(async api => {
      if (!active) return;
      api.setNotificationHandler({ handleNotification: async notification => {
        const intended = Boolean(notificationDestination(notification.request.content.data, userId));
        return { shouldShowBanner: intended, shouldShowList: intended, shouldPlaySound: intended, shouldSetBadge: false };
      } });
      cleanupHandler = () => api.setNotificationHandler(null);
      tokenListener = api.addPushTokenListener(() => {
        void sync().catch(failure => { if (active) setError(errorMessage(failure)); });
      });
      const receive = (response: import('expo-notifications').NotificationResponse) => {
        const id = response.notification.request.identifier;
        if (!active || seen.current === id) return;
        seen.current = id;
        const path = notificationDestination(response.notification.request.content.data, userId);
        if (path) router.push(path);
        void api.clearLastNotificationResponseAsync().catch(failure => setError(errorMessage(failure)));
      };
      listener = api.addNotificationResponseReceivedListener(receive);
      const last = await api.getLastNotificationResponseAsync();
      if (last) receive(last);
    }).catch(failure => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; listener?.remove(); tokenListener?.remove(); cleanupHandler?.(); };
  }, [userId, ready, sessionError, sync]);
  useEffect(() => {
    if (!supported || userId || !ready) return;
    void notifications().then(async api => {
      await api.clearLastNotificationResponseAsync();
      await api.dismissAllNotificationsAsync();
    }).catch(failure => console.warn('Notification cleanup failed', errorMessage(failure)));
  }, [userId, ready]);
  async function run(action: () => Promise<void>) {
    const revision = pushRevision();
    setPending(true); setError(''); setMessage('');
    try { await withPushLock(async () => { if (revision === pushRevision()) await action(); }); } catch (failure) { setError(errorMessage(failure)); }
    finally { setPending(false); }
  }
  async function enable() {
    await run(async () => {
      if (!userId) throw new Error(t('Connexion requise.'));
      if (!supported) throw new Error(t('Les notifications nécessitent une version SAIWAY installée, pas Expo Go.'));
      const status = await client().request('/api/notifications/native', statusSchema);
      if (!status.configured) throw new Error(t('Les notifications natives ne sont pas configurées sur le serveur.'));
      const api = await notifications();
      if (Platform.OS === 'android') await api.setNotificationChannelAsync('trips', {
        name: 'SAIWAY', importance: api.AndroidImportance.HIGH, sound: 'default',
      });
      const permission = await api.requestPermissionsAsync();
      if (!permission.granted) throw new Error(t('Autorisez les notifications dans les réglages de votre appareil.'));
      const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
      if (typeof projectId !== 'string') throw new Error(t('Identifiant du projet Expo manquant.'));
      const token = (await api.getExpoPushTokenAsync({ projectId })).data;
      const saved = await savedPushRegistration();
      if (saved && (saved.userId !== userId || saved.origin !== configuredOrigin())) throw new Error(t('Cet appareil doit réactiver ses notifications pour ce compte.'));
      if (saved?.previousToken) await client().request('/api/notifications/native', disabledSchema, { method: 'DELETE', body: { token: saved.previousToken } });
      // Save first so a server-success/storage-failure cannot leave an unremovable device.
      await savePushRegistration(token, userId, saved?.token !== token ? saved?.token : undefined);
      await client().request('/api/notifications/native', enabledSchema, {
        method: 'POST', body: { token, platform: Platform.OS, language },
      });
      if (saved && saved.token !== token) await client().request('/api/notifications/native', disabledSchema, { method: 'DELETE', body: { token: saved.token } });
      await savePushRegistration(token, userId);
      setEnabled(true);
    });
  }
  async function disable() {
    await run(async () => {
      const saved = await savedPushRegistration();
      if (saved && (saved.userId !== userId || saved.origin !== configuredOrigin())) throw new Error(t('Cet appareil doit réactiver ses notifications pour ce compte.'));
      if (saved) await client().request('/api/notifications/native', disabledSchema, { method: 'DELETE', body: { token: saved.token } });
      if (saved?.previousToken) await client().request('/api/notifications/native', disabledSchema, { method: 'DELETE', body: { token: saved.previousToken } });
      await clearPushRegistration(); setEnabled(false);
    });
  }
  async function test() {
    await run(async () => {
      const saved = await savedPushRegistration();
      if (!saved || !enabled) throw new Error(t('Activez les notifications sur cet appareil.'));
      await client().request('/api/notifications/test', z.object({ queued: z.literal(true) }), { method: 'POST', body: { endpoint: saved.token } });
      setMessage(t('Notification de test mise en file. La réception dépend du réseau et des réglages de l’appareil.'));
    });
  }
  return <Context.Provider value={{ enabled, pending, error, message, enable, disable, test, settings: () => run(() => Linking.openSettings()) }}>{children}</Context.Provider>;
}
export function useNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error('NotificationsProvider missing');
  return context;
}
