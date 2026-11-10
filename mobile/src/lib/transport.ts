import { t } from './i18n.ts';
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export function apiOrigin(value: string, development: boolean) {
  if (!value.trim()) throw new Error(t("Configurez EXPO_PUBLIC_API_URL dans mobile/.env."));
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
    (url.protocol !== 'https:' && !(development && url.protocol === 'http:'))) {
    throw new Error(t("EXPO_PUBLIC_API_URL doit etre une origine HTTPS (HTTP autorise seulement en developpement)."));
  }
  return url.origin;
}

export function sessionCookie(header: string | null, name: 'saiway_session' | 'saiway_guest_ride' = 'saiway_session') {
  const match = header?.match(new RegExp(`(?:^|,\\s*)${name}=([^;,\\s]*)`));
  if (!match) return undefined;
  return match[1] ? `${name}=${match[1]}` : null;
}

type Decoder<T> = { parse: (value: unknown) => T };
type Options = { method?: string; body?: unknown; signal?: AbortSignal };
type Dependencies = {
  origin: string;
  fetch: typeof globalThis.fetch;
  cookie: () => string | null;
  saveCookie: (cookie: string | null) => Promise<void>;
  cookieName?: 'saiway_session' | 'saiway_guest_ride';
};

export function createTransport(deps: Dependencies) {
  async function response(path: string, options: Options = {}) {
    if (!path.startsWith('/api/') || path.includes('\\') || new URL(path, deps.origin).origin !== deps.origin) {
      throw new Error(t("Chemin API non autorise."));
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, 25000);
    try {
      const cookie = deps.cookie();
      const form = options.body instanceof FormData;
      const result = await deps.fetch.call(globalThis, `${deps.origin}${path}`, {
        method: options.method ?? 'GET', credentials: 'omit', redirect: 'error',
        headers: {
          Accept: 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(options.body !== undefined && !form ? { 'Content-Type': 'application/json' } : {}),
        },
        body: form ? options.body as FormData : options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
      const next = sessionCookie(result.headers.get('set-cookie'), deps.cookieName);
      if (next !== undefined) await deps.saveCookie(next);
      if (!result.ok) {
        const content = await result.text();
        let message = t("Erreur API ({p0}).", { p0: result.status });
        if (result.headers.get('content-type')?.includes('application/json')) {
          const error: unknown = JSON.parse(content);
          if (error && typeof error === 'object' && 'error' in error && typeof error.error === 'string') message = error.error;
        }
        throw new ApiError(message, result.status);
      }
      return result;
    } catch (error) {
      if (controller.signal.aborted && !options.signal?.aborted) throw new ApiError(t("Le serveur ne repond pas. Reessayez."), 0);
      throw error;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }
  }
  return {
    response,
    async request<T>(path: string, decoder: Decoder<T>, options?: Options): Promise<T> {
      const result = await response(path, options);
      if (!result.headers.get('content-type')?.includes('application/json')) throw new ApiError(t("Reponse API invalide : JSON attendu."), result.status);
      return decoder.parse(await result.json());
    },
  };
}
