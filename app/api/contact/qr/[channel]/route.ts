import { prisma } from "@/lib/prisma";
import { publicContact } from "@/lib/public-contact";
import { contactQrChannels } from "@/lib/driver-contact-qr-client";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel: value } = await params;
  const channel = contactQrChannels.find((item) => item === value);
  if (!channel) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const { driver } = await publicContact();
    if (!driver) return Response.json({ error: "Not found" }, { status: 404 });
    const image = await prisma.driverContactQrImage.findUnique({
      where: { driverId_channel: { driverId: driver.id, channel } },
      select: { data: true, mimeType: true, sizeBytes: true },
    });
    if (!image) return Response.json({ error: "Not found" }, { status: 404 });
    return new Response(Buffer.from(image.data), { headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.sizeBytes),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (error) {
    console.error("Public contact QR unavailable", { name: error instanceof Error ? error.name : "UNKNOWN" });
    return Response.json({ error: "Contact service unavailable" }, { status: 503 });
  }
}
