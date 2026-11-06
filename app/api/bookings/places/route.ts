import { authorize } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const customer = await authorize(request, "CUSTOMER");
    if (!customer) return Response.json({ error: "Customer access required" }, { status: 403 });
    const bookings = await prisma.booking.findMany({
      where: { customerId: customer.id },
      select: { fromAddress: true, toAddress: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const places = [...new Set(bookings.flatMap((booking) => [booking.fromAddress, booking.toAddress]))];
    return Response.json({ places }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Customer place history unavailable", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ error: "Place history unavailable" }, { status: 503 });
  }
}
