import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { client, errorMessage, guestClient } from '@/lib/api';

export function useApi<T>(path: string | null, schema: { parse: (value: unknown) => T }, interval = 0, mode: 'account' | 'guest' = 'account') {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string; loading: boolean }>({
    path, data: null, error: '', loading: Boolean(path),
  });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!path) return;
    let active = true;
    let pending = false;
    const controller = new AbortController();
    async function load() {
      if (pending || AppState.currentState === 'background') return;
      pending = true;
      setState(current => ({ path, data: current.path === path ? current.data : null, error: current.path === path ? current.error : '', loading: true }));
      try {
        const result = await (mode === 'guest' ? guestClient() : client()).request(path!, schema, { signal: controller.signal });
        if (active) setState({ path, data: result, error: '', loading: false });
      } catch (failure) { if (active) setState(current => ({ ...current, error: errorMessage(failure), loading: false })); }
      finally { pending = false; }
    }
    void load();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    const timer = interval ? setInterval(() => { void load(); }, interval) : null;
    return () => { active = false; controller.abort(); listener.remove(); if (timer) clearInterval(timer); };
  }, [path, schema, interval, revision, mode]);
  const setData = useCallback((data: T | null) => {
    setState(current => ({ ...current, path, data }));
  }, [path]);
  const updateData = useCallback((updater: (current: T | null) => T | null) => {
    setState(current => ({ ...current, path, data: updater(current.path === path ? current.data : null) }));
  }, [path]);
  return {
    data: state.path === path ? state.data : null, setData, updateData,
    error: state.path === path ? state.error : '', loading: Boolean(path) && (state.path !== path || state.loading), refresh,
  };
}

export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function useOperation() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const run = async (operation: () => Promise<void>, success = '') => {
    if (lock.current) return;
    lock.current = true; setPending(true); setError(''); setMessage('');
    try { await operation(); if (success) setMessage(success); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { lock.current = false; setPending(false); }
  };
  return { pending, error, message, run, setError, setMessage };
}
