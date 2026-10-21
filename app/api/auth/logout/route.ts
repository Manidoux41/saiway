import { clearSessionCookie } from "@/lib/auth-session";
import { customerSessionToken, sessionTokenHash } from "@/lib/customer-session";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const token = customerSessionToken(request);
  if (token) {
    try {
      await prisma.customerSession.deleteMany({ where: { tokenHash: sessionTokenHash(token) } });
    } catch {
      return Response.json({ error: "Sign out unavailable; please retry" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  return Response.json({ signedOut: true }, { headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
}
