"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import type { UserRole } from "@/lib/roles";
export type { UserRole } from "@/lib/roles";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

type AuthContextValue = {
  user: AuthUser | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser: AuthUser | null }) {
  const { t } = useLanguage();
  const [renewalError, setRenewalError] = useState(false);
  useEffect(() => {
    if (initialUser?.role !== "customer") return;
    let renewedAt = 0;
    let pending = false;
    const controller = new AbortController();
    async function renew() {
      if (document.visibilityState !== "visible" || pending || Date.now() - renewedAt < 86400000) return;
      pending = true;
      try {
        const response = await fetch("/api/auth/session", { method: "POST", signal: controller.signal });
        if (!response.ok) throw new Error("Session renewal failed");
        renewedAt = Date.now();
        setRenewalError(false);
      } catch { if (!controller.signal.aborted) setRenewalError(true); }
      finally { pending = false; }
    }
    void renew();
    document.addEventListener("visibilitychange", renew);
    const timer = window.setInterval(renew, 86400000);
    return () => { controller.abort(); document.removeEventListener("visibilitychange", renew); window.clearInterval(timer); };
  }, [initialUser?.id, initialUser?.role]);
  async function signOut() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error("Sign out failed");
    window.location.replace("/auth");
  }

  return <AuthContext.Provider value={{ user: initialUser, signOut }}>{renewalError && <p role="alert" className="bg-amber-50 p-3 text-center text-sm">{t("customer.sessionError")}</p>}{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
