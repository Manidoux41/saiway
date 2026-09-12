"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type UserRole = "customer" | "driver" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

type AuthContextValue = {
  user: AuthUser | null;
  signIn: (user: AuthUser) => void;
  register: (user: AuthUser) => void;
  authenticate: (email: string, role: UserRole) => AuthUser | null;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem("saiway-user");
  if (!value) return null;
  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    window.localStorage.removeItem("saiway-user");
    return null;
  }
}

function readAccounts(): AuthUser[] {
  if (typeof window === "undefined") return [];
  const value = window.localStorage.getItem("saiway-accounts");
  const bootstrapAdmin: AuthUser = { id: "bootstrap-admin", name: "SAIWAY Administrator", email: "admin@saiway.local", role: "admin" };
  if (!value) return [bootstrapAdmin];
  try {
    const accounts = JSON.parse(value) as AuthUser[];
    return accounts.some((account) => account.email === bootstrapAdmin.email) ? accounts : [...accounts, bootstrapAdmin];
  } catch {
    window.localStorage.removeItem("saiway-accounts");
    return [];
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);

  function signIn(nextUser: AuthUser) {
    setUser(nextUser);
    window.localStorage.setItem("saiway-user", JSON.stringify(nextUser));
  }

  function register(nextUser: AuthUser) {
    const accounts = readAccounts().filter((account) => account.email !== nextUser.email);
    window.localStorage.setItem("saiway-accounts", JSON.stringify([...accounts, nextUser]));
  }

  function authenticate(email: string, role: UserRole) {
    return readAccounts().find((account) => account.email.toLowerCase() === email.toLowerCase() && account.role === role) ?? null;
  }

  function signOut() {
    setUser(null);
    window.localStorage.removeItem("saiway-user");
  }

  return <AuthContext.Provider value={{ user, signIn, register, authenticate, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
