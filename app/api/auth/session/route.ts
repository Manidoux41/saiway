import { authorize } from "@/lib/access";
import { createCustomerSession, customerSessionToken } from "@/lib/customer-session";
import { sessionCookie } from "@/lib/auth-session";

export async function POST(request: Request) {
  try {
    const account = await authorize(request, "CUSTOMER");
    if (!account) return Response.json({ error: "Customer access required" }, { status: 403 });
    const token = customerSessionToken(request);
    const cookie = token ? sessionCookie(token, true) : await createCustomerSession(account.id);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Session renewal unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
