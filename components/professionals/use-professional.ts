"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { professionalSchema, type Professional } from "@/lib/professional-policy";
import { z } from "zod";

export function useProfessional() {
  const { user } = useAuth();
  const [state, setState] = useState<{ professional: Professional | null; loaded: boolean; error: boolean }>({ professional: null, loaded: false, error: false });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (user?.role !== "customer") return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/professionals", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Professional profile unavailable");
        const value = z.object({ professional: professionalSchema.nullable() }).parse(await response.json());
        setState({ ...value, loaded: true, error: false });
      } catch {
        if (!controller.signal.aborted) setState({ professional: null, loaded: false, error: true });
      }
    }
    void load();
    return () => controller.abort();
  }, [user?.id, user?.role, revision]);
  return { ...state, loaded: user?.role !== "customer" || state.loaded, refresh: () => setRevision(value => value + 1) };
}
