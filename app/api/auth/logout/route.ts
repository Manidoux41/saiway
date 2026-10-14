import { clearSessionCookie } from "@/lib/auth-session";

export async function POST() {
  return Response.json({ signedOut: true }, { headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
}
