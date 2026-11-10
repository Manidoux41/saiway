import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { client, errorMessage, forgetSession, rememberUser, restoreSession } from '@/lib/api';
import { authSchema, bookingsSchema, userSchema, type User } from '@/lib/contracts';
import { z } from 'zod';
import { ApiError } from '@/lib/transport';

type Session = {
  user: User | null; ready: boolean; error: string;
  retry: () => void;
  signIn: (form: { email: string; password: string; role: string; name?: string }, register?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
};
const Context = createContext<Session | null>(null);
const logoutSchema = z.object({ signedOut: z.boolean() });

export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    async function boot() {
      setReady(false); setError('');
      try {
        const saved = await restoreSession();
        if (saved) {
          await client().request(saved.role === 'driver' ? '/api/driver/bookings' : '/api/bookings', bookingsSchema);
        }
        if (active) setUser(saved);
      } catch (failure) {
        if (failure instanceof ApiError && (failure.status === 401 || failure.status === 403)) {
          try {
            await forgetSession();
            if (active) setUser(null);
          } catch (storageFailure) { if (active) setError(errorMessage(storageFailure)); }
        } else if (active) setError(errorMessage(failure));
      }
      finally { if (active) setReady(true); }
    }
    void boot();
    return () => { active = false; };
  }, [revision]);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  async function signIn(form: { email: string; password: string; role: string; name?: string }, register = false) {
    const result = await client().request(`/api/auth/${register ? 'register' : 'login'}`, authSchema, {
      method: 'POST', body: { ...form, email: form.email.trim().toLowerCase() },
    });
    await rememberUser(result.user);
    setUser(result.user);
  }
  async function signOut() {
    try {
      await client().request('/api/auth/logout', logoutSchema, { method: 'POST', body: {} });
    } catch (failure) {
      if (!(failure instanceof ApiError) || (failure.status !== 401 && failure.status !== 403)) throw failure;
    }
    await forgetSession(); setUser(null); setError('');
  }
  async function updateName(name: string) {
    if (!user) throw new Error('Connexion requise.');
    const updated = userSchema.parse({ ...user, name });
    await rememberUser(updated); setUser(updated);
  }
  return <Context.Provider value={{ user, ready, error, retry, signIn, signOut, updateName }}>{children}</Context.Provider>;
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('SessionProvider manquant.');
  return value;
}
