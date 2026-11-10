const CACHE_NAME = "saiway-shell-v8";
const APP_SHELL = ["/icons/saiway-mark.svg", "/icons/icon-192.svg", "/icons/icon-512.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png", "/icons/favicon-32.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

async function authorizedDevice(message) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`/api/notifications/device?id=${encodeURIComponent(message.data.subscriptionId)}`, {
        credentials: "include", cache: "no-store", signal: AbortSignal.timeout(4000),
        headers: typeof message.data.deviceToken === "string" ? { Authorization: `Bearer ${message.data.deviceToken}` } : {},
      });
      if (response.status >= 500) throw new Error("Push device authorization temporarily unavailable");
      return response.ok;
    } catch (error) {
      if (attempt === 1) throw error;
      console.warn("Retrying push device authorization");
    }
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    try {
      const message = event.data?.json();
      if (!message || typeof message.body !== "string" || typeof message.data?.subscriptionId !== "string") throw new Error("Invalid push payload");
      if (!await authorizedDevice(message)) {
        console.warn("Push skipped: device recipient authorization was revoked or is unavailable");
        return;
      }
      const url = ["/admin", "/driver", "/account"].includes(message.data.url) ? message.data.url : "/account";
      await self.registration.showNotification("SAIWAY", {
        body: message.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png",
        tag: message.tag, lang: message.lang, data: { url },
        requireInteraction: message.urgent === true,
      });
    } catch (error) {
      console.error("SAIWAY push display failed", error instanceof Error ? error.message : "UNKNOWN");
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = ["/admin", "/driver", "/account"].includes(event.notification.data?.url) ? event.notification.data.url : "/account";
    const url = new URL(target, self.location.origin).href;
    const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const tab of tabs) {
      if (new URL(tab.url).origin === self.location.origin) {
        await tab.navigate(url);
        await tab.focus();
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") return;
  if (!APP_SHELL.includes(url.pathname)) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
      }
      return response;
    })),
  );
});
