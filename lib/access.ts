import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession, type SessionRole } from "@/lib/auth-session";
import { roleHome } from "@/lib/roles";
import { customerSessionToken, sessionTokenHash } from "@/lib/customer-session";

export async function activeAccount(request: Request) {
  const token = customerSessionToken(request);
  if (token) {
    const stored = await prisma.customerSession.findUnique({
      where: { tokenHash: sessionTokenHash(token) },
      select: { user: { select: { id: true, name: true, email: true, role: true, status: true } } },
    });
    return stored?.user.status === "ACTIVE" && stored.user.role === "CUSTOMER" ? stored.user : null;
  }
  const session = readSession(request);
  if (!session) return null;
  const account = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  return account?.status === "ACTIVE" && account.role === session.role && account.email === session.email ? account : null;
}

export async function authorize(request: Request, role: SessionRole) {
  const account = await activeAccount(request);
  return account?.role === role ? account : null;
}

export const currentAccount = cache(async () => {
  const store = await cookies();
  return activeAccount(new Request("http://saiway.internal", { headers: { cookie: store.toString() } }));
});

export async function requireRole(role: SessionRole) {
  const account = await currentAccount();
  if (!account) redirect("/auth");
  if (account.role !== role) redirect(roleHome(account.role));
  return account;
}
