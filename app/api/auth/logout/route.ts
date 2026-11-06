import { clearSessionCookie } from "@/lib/auth-session";
import { customerSessionToken, sessionTokenHash } from "@/lib/customer-session";
import { prisma } from "@/lib/prisma";
import { activeAccount } from "@/lib/access";
import { z } from "zod";

export async function POST(request: Request) {
  const token = customerSessionToken(request);
  let body: unknown = {};
  if (request.headers.get("content-type")?.includes("application/json")) {
    const text = await request.text();
    if (text.trim()) {
      try { body = JSON.parse(text); }
      catch { return Response.json({ error: "Invalid logout request" }, { status: 400 }); }
    }
  }
  const parsed = z.object({ pushEndpoint: z.string().max(2048).optional() }).strict().safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid logout request" }, { status: 400 });
  if (token || parsed.data.pushEndpoint) {
    try {
      const account = await activeAccount(request);
      await prisma.$transaction(async (tx) => {
        if (token) await tx.customerSession.deleteMany({ where: { tokenHash: sessionTokenHash(token) } });
        if (account && parsed.data.pushEndpoint) await tx.pushSubscription.deleteMany({ where: { userId: account.id, endpoint: parsed.data.pushEndpoint } });
      });
    } catch {
      return Response.json({ error: "Sign out unavailable; please retry" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  return Response.json({ signedOut: true }, { headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
}
