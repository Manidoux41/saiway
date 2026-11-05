import "server-only";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/access";
import { readDriverImageUpload } from "@/lib/driver-image-upload";

function unavailable(error: unknown) {
  console.error("Driver photo request failed", { name: error instanceof Error ? error.name : "UNKNOWN" });
  return Response.json({ error: "Photo service unavailable" }, { status: 503 });
}

const denied = () => Response.json({ error: "Administrator access required" }, { status: 403 });

export async function adminDriverPhoto(request: Request, driverId: string) {
  try {
    if (!await authorize(request, "ADMIN")) return denied();
    const photo = await prisma.driverPhoto.findUnique({ where: { driverId }, select: { mimeType: true, sizeBytes: true, data: true } });
    if (!photo) return Response.json({ error: "Not found" }, { status: 404 });
    return new Response(Buffer.from(photo.data), {
      headers: {
        "Content-Type": photo.mimeType,
        "Content-Length": String(photo.sizeBytes),
        "Content-Disposition": 'inline; filename="driver-photo"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) { return unavailable(error); }
}

export async function adminUploadDriverPhoto(request: Request, driverId: string) {
  try {
    const admin = await authorize(request, "ADMIN");
    if (!admin) return denied();
    const upload = await readDriverImageUpload(request);
    if (upload instanceof Response) return upload;
    const { data, mimeType } = upload;
    if (!await prisma.driverProfile.findUnique({ where: { id: driverId }, select: { id: true } })) return Response.json({ error: "Driver not found" }, { status: 404 });
    const photo = await prisma.$transaction(async (tx) => {
      const saved = await tx.driverPhoto.upsert({
        where: { driverId },
        create: { driverId, mimeType, sizeBytes: data.length, data },
        update: { mimeType, sizeBytes: data.length, data, uploadedAt: new Date() },
        select: { id: true, sizeBytes: true, uploadedAt: true },
      });
      await tx.auditLog.create({ data: { actorId: admin.id, entity: "DriverPhoto", entityId: saved.id, action: "UPLOAD", metadata: { driverId } } });
      return saved;
    });
    return Response.json({ photo: { sizeBytes: photo.sizeBytes, uploadedAt: photo.uploadedAt } }, { status: 201 });
  } catch (error) { return unavailable(error); }
}

export async function adminDeleteDriverPhoto(request: Request, driverId: string) {
  try {
    const admin = await authorize(request, "ADMIN");
    if (!admin) return denied();
    const deleted = await prisma.$transaction(async (tx) => {
      const photo = await tx.driverPhoto.findUnique({ where: { driverId }, select: { id: true } });
      if (!photo) return false;
      await tx.driverPhoto.delete({ where: { id: photo.id } });
      await tx.auditLog.create({ data: { actorId: admin.id, entity: "DriverPhoto", entityId: photo.id, action: "DELETE", metadata: { driverId } } });
      return true;
    });
    return deleted ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
  } catch (error) { return unavailable(error); }
}
