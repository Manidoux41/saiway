import "server-only";
import { prisma } from "@/lib/prisma";
import { activeAccount, authorize } from "@/lib/access";
import { readDriverImageUpload } from "@/lib/driver-image-upload";
import { contactQrChannels } from "@/lib/driver-contact-qr-client";

const metadata = { channel: true, uploadedAt: true } as const;
const denied = () => Response.json({ error: "Access denied" }, { status: 403 });
const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

function unavailable(error: unknown) {
  console.error("Driver contact QR request failed", { name: error instanceof Error ? error.name : "UNKNOWN" });
  return Response.json({ error: "Contact QR service unavailable" }, { status: 503 });
}

async function access(request: Request, driverId: string, value: string) {
  const account = await activeAccount(request);
  if (!account || !["DRIVER", "ADMIN"].includes(account.role)) return denied();
  const driver = await prisma.driverProfile.findUnique({ where: { id: driverId }, select: { userId: true } });
  if (account.role === "DRIVER" && driver?.userId !== account.id) return denied();
  const channel = contactQrChannels.find((item) => item === value);
  if (!driver || !channel) return notFound();
  return { account, channel };
}

export async function driverContactQrSummary(request: Request) {
  try {
    const account = await authorize(request, "DRIVER");
    if (!account) return denied();
    const driver = await prisma.driverProfile.findUnique({
      where: { userId: account.id },
      select: { id: true, contactQrImages: { select: metadata, orderBy: { channel: "asc" } } },
    });
    return driver ? Response.json({ driver }, { headers: { "Cache-Control": "private, no-store" } }) : notFound();
  } catch (error) { return unavailable(error); }
}

export async function driverContactQrImage(request: Request, driverId: string, value: string) {
  try {
    const allowed = await access(request, driverId, value);
    if (allowed instanceof Response) return allowed;
    const image = await prisma.driverContactQrImage.findUnique({
      where: { driverId_channel: { driverId, channel: allowed.channel } },
      select: { mimeType: true, sizeBytes: true, data: true },
    });
    if (!image) return notFound();
    return new Response(Buffer.from(image.data), { headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.sizeBytes),
      "Content-Disposition": `inline; filename="contact-qr-${allowed.channel.toLowerCase()}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (error) { return unavailable(error); }
}

export async function uploadDriverContactQr(request: Request, driverId: string, value: string) {
  try {
    const allowed = await access(request, driverId, value);
    if (allowed instanceof Response) return allowed;
    const upload = await readDriverImageUpload(request);
    if (upload instanceof Response) return upload;
    const image = await prisma.$transaction(async (tx) => {
      const saved = await tx.driverContactQrImage.upsert({
        where: { driverId_channel: { driverId, channel: allowed.channel } },
        create: { driverId, channel: allowed.channel, ...upload, sizeBytes: upload.data.length },
        update: { ...upload, sizeBytes: upload.data.length, uploadedAt: new Date() },
        select: { id: true, ...metadata },
      });
      await tx.auditLog.create({ data: { actorId: allowed.account.id, entity: "DriverContactQrImage", entityId: saved.id, action: "UPLOAD", metadata: { driverId, channel: allowed.channel } } });
      return { channel: saved.channel, uploadedAt: saved.uploadedAt };
    });
    return Response.json({ image }, { status: 201 });
  } catch (error) { return unavailable(error); }
}

export async function deleteDriverContactQr(request: Request, driverId: string, value: string) {
  try {
    const allowed = await access(request, driverId, value);
    if (allowed instanceof Response) return allowed;
    const deleted = await prisma.$transaction(async (tx) => {
      const where = { driverId_channel: { driverId, channel: allowed.channel } };
      const image = await tx.driverContactQrImage.findUnique({ where, select: { id: true } });
      if (!image) return false;
      await tx.driverContactQrImage.delete({ where });
      await tx.auditLog.create({ data: { actorId: allowed.account.id, entity: "DriverContactQrImage", entityId: image.id, action: "DELETE", metadata: { driverId, channel: allowed.channel } } });
      return true;
    });
    return deleted ? Response.json({ ok: true }) : notFound();
  } catch (error) { return unavailable(error); }
}
