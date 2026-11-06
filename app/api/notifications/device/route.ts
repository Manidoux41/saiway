import { activeAccount } from "@/lib/access";
import { prisma } from "@/lib/prisma";

// The service worker checks the logged-in recipient before displaying a push.
export async function GET(request: Request) {
  try {
    const user = await activeAccount(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!user || !id || !await prisma.pushSubscription.count({ where: { id, userId: user.id } })) {
      return Response.json({ authorized: false }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ authorized: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Push device authorization failed");
    return Response.json({ error: "Notification service unavailable" }, { status: 503 });
  }
}
