"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch((error: unknown) => {
        console.error("SAIWAY service worker registration failed", error instanceof Error ? error.name : "UNKNOWN");
      });
    }
  }, []);

  return null;
}
