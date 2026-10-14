"use client";

import { createContext, useContext, type ReactNode } from "react";
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
  async function signOut() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error("Sign out failed");
    window.location.replace("/auth");
  }

  return <AuthContext.Provider value={{ user: initialUser, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
