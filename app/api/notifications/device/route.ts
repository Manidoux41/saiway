import { activeAccount } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { readPushDeviceToken } from "@/lib/push-device-token";

// Encrypted push carries a short-lived proof, so background display does not need a live login cookie.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const proof = request.headers.get("authorization");
    if (proof) {
      const token = id && proof.startsWith("Bearer ") ? readPushDeviceToken(proof.slice(7), id) : null;
      if (!id || !token || !await prisma.pushSubscription.count({ where: { id, user: { status: "ACTIVE", role: token.role } } })) {
        return Response.json({ authorized: false }, { status: 403, headers: { "Cache-Control": "no-store" } });
      }
      return Response.json({ authorized: true }, { headers: { "Cache-Control": "no-store" } });
    }
    const user = await activeAccount(request);
    if (!user || !id || !await prisma.pushSubscription.count({ where: { id, userId: user.id } })) {
      return Response.json({ authorized: false }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ authorized: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Push device authorization failed");
    return Response.json({ error: "Notification service unavailable" }, { status: 503 });
  }
}
