import "server-only";
import { authorize } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { BusinessCardImageError, renderBusinessCards } from "@/lib/business-card-pdf";

export async function downloadBusinessCards(request: Request, driverId?: string) {
  try {
    const admin = await authorize(request, "ADMIN");
    if (!admin) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const url = new URL(request.url);
    const locale = url.searchParams.get("language") ?? "en";
    if (locale !== "en" && locale !== "fr" && locale !== "km") return Response.json({ error: "Invalid language" }, { status: 400 });
    const drivers = await prisma.driverProfile.findMany({
      where: driverId ? { id: driverId } : { user: { phone: { not: null } } },
      select: {
        id: true, user: { select: { name: true, phone: true } },
        photo: { select: { data: true } },
        contactQrImages: { select: { channel: true, data: true }, orderBy: { channel: "asc" } },
      },
      orderBy: { user: { name: "asc" } },
    });
    if (driverId && !drivers.length) return Response.json({ error: "Driver not found" }, { status: 404 });
    const ready = drivers.filter((driver) => driver.user.phone?.trim());
    if (!ready.length) return Response.json({ error: "A booking phone number is required" }, { status: 422 });
    const cards = driverId ? Array.from({ length: 8 }, () => ready[0]) : ready;
    const pdf = await renderBusinessCards(cards, new URL("/booking", url).href, locale);
    await prisma.$transaction(ready.map((driver) => prisma.auditLog.create({ data: {
      actorId: admin.id, entity: "DriverProfile", entityId: driver.id, action: "DOWNLOAD_BUSINESS_CARD_PDF",
    } })));
    return new Response(new Uint8Array(pdf), { headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `attachment; filename="${driverId ? "saiway-business-card" : "saiway-business-cards-a4"}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("Business card PDF request failed", { name: error instanceof Error ? error.name : "UNKNOWN" });
    return Response.json({ error: error instanceof BusinessCardImageError ? "A card image cannot be rendered. Replace the image and retry." : "Business card PDF unavailable" }, { status: error instanceof BusinessCardImageError ? 422 : 503 });
  }
}
