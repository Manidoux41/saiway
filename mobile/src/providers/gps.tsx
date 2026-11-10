import { useLanguage } from '@/providers/language';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { z } from 'zod';
import { client, errorMessage } from '@/lib/api';
import { locationAccessSchema, type Point } from '@/lib/contracts';
import { useApi } from '@/hooks/use-api';
import { useSession } from './session';

const acceptedSchema = z.object({ accepted: z.boolean(), recordedAt: z.string().optional() });
type Gps = {
  enabled: boolean; setEnabled: (enabled: boolean) => void; error: string; lastSent: string | null;
  point: Point | null; sendNow: () => Promise<Point>; access: ReturnType<typeof useApi<z.infer<typeof locationAccessSchema>>>;
};
const Context = createContext<Gps | null>(null);

export function GpsProvider({ children }: PropsWithChildren) {
  const { user } = useSession();
  return <GpsSessionProvider key={user?.id ?? 'guest'}>{children}</GpsSessionProvider>;
}

function GpsSessionProvider({ children }: PropsWithChildren) {
  const { t } = useLanguage();
  const { user } = useSession();
  const access = useApi(user?.role === 'driver' ? '/api/driver/location' : null, locationAccessSchema, 15000);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const sending = useRef(false);
  const lastAttempt = useRef(0);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);

  const send = useCallback(async (position: Location.LocationObject, signal?: AbortSignal) => {
    const { latitude, longitude, accuracy, heading } = position.coords;
    if (Date.now() - position.timestamp > 15000) throw new Error(t("Position GPS trop ancienne. Reessayez en exterieur."));
    const result = await client().request('/api/driver/location', acceptedSchema, {
      method: 'PUT', signal, body: { latitude, longitude, accuracy,
        heading: heading !== null && heading >= 0 && heading < 360 ? heading : null,
        capturedAt: new Date(position.timestamp).toISOString() },
    });
    if (result.accepted) { setLastSent(result.recordedAt ?? new Date().toISOString()); setPoint({ latitude, longitude }); }
    setError('');
    return { latitude, longitude };
  }, [t]);

  useEffect(() => {
    if (!enabled || !foreground || !access.data?.enabled || user?.role !== 'driver') return;
    let active = true;
    const abort = new AbortController();
    let subscription: Location.LocationSubscription | undefined;
    async function start() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) throw new Error(t("Autorisez la localisation pour partager votre position."));
        if (!active) return;
        const watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 0 }, position => {
          if (sending.current || Date.now() - lastAttempt.current < 5000 || !active) return;
          sending.current = true; lastAttempt.current = Date.now();
          void send(position, abort.signal).catch(failure => {
            if (!abort.signal.aborted) setError(errorMessage(failure));
          }).finally(() => { sending.current = false; });
        }, reason => { if (active) setError(t("Localisation interrompue : {p0}", { p0: reason })); });
        if (!active) watcher.remove();
        else subscription = watcher;
      } catch (failure) { if (!abort.signal.aborted) setError(errorMessage(failure)); }
    }
    void start();
    return () => { active = false; abort.abort(); subscription?.remove(); };
  }, [enabled, foreground, access.data?.enabled, user?.role, send, t]);

  async function sendNow() {
    if (!enabled || !foreground || !access.data?.enabled) throw new Error(t("Activez le partage GPS au premier plan."));
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new Error(t("Permission GPS refusee."));
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    if (position.coords.accuracy === null || position.coords.accuracy > 50) throw new Error(t("Precision GPS insuffisante (50 m maximum)."));
    return send(position);
  }
  return <Context.Provider value={{ enabled, setEnabled, error, lastSent, point, sendNow, access }}>{children}</Context.Provider>;
}
export function useGps() {
  const gps = useContext(Context);
  if (!gps) throw new Error('GpsProvider manquant.');
  return gps;
}
