"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminRequestError, adminErrorKey, adminRequest, managementSchema, type ManagementData } from "@/lib/admin-client";

export function useAdminManagement(accountId: string | undefined) {
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<{ accountId?: string; data: ManagementData | null; error: ReturnType<typeof adminErrorKey> | null }>({ data: null, error: null });

  const refresh = useCallback(() => {
    setLoading(true);
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await adminRequest("/api/admin/management", { signal: controller.signal });
        const parsed = managementSchema.safeParse(response);
        if (!parsed.success) throw new AdminRequestError("admin.invalidResponse");
        if (!controller.signal.aborted) {
          setState({ accountId, data: parsed.data, error: null });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState((current) => ({ accountId, data: current.accountId === accountId ? current.data : null, error: adminErrorKey(error) }));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [accountId, revision]);

  return { data: state.accountId === accountId ? state.data : null, error: state.accountId === accountId ? state.error : null, loading, refresh };
}
