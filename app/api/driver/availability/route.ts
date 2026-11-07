import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authorize } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { DispatchError, dispatchTransaction } from "@/lib/driver-dispatch";
import { inServiceStatuses } from "@/lib/dispatch-policy";
import { enqueueAvailabilityPush } from "@/lib/push-events";
import { schedulePushDelivery } from "@/lib/push-delivery";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
const command = z.object({ isAvailable: z.boolean(), selectedVehicleId: z.string().min(1).nullable() }).strict();
const state = { isAvailable: true, availableSince: true, selectedVehicleId: true } satisfies Prisma.DriverProfileSelect;

function failure(error: unknown) {
  if (error instanceof DispatchError) return Response.json({ error: error.message }, { status: error.status, headers: noStore });
  if (error instanceof SyntaxError || error instanceof z.ZodError) return Response.json({ error: "Invalid availability request" }, { status: 400, headers: noStore });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "Availability changed; refresh and retry" }, { status: 409, headers: noStore });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return Response.json({ error: "Driver profile not found" }, { status: 404, headers: noStore });
  console.error("Driver availability unavailable", { code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "UNKNOWN" });
  return Response.json({ error: "Availability service unavailable" }, { status: 503, headers: noStore });
}

export async function GET(request: Request) {
  try {
    const account = await authorize(request, "DRIVER");
    if (!account) return Response.json({ error: "Driver access required" }, { status: 403, headers: noStore });
    const [driverAvailability, vehicles] = await Promise.all([
      prisma.driverProfile.findUniqueOrThrow({ where: { userId: account.id }, select: state }),
      prisma.vehicle.findMany({ where: { active: true }, select: { id: true, name: true, plate: true, seats: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
    ]);
    return Response.json({ driverAvailability, vehicles }, { headers: noStore });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const account = await authorize(request, "DRIVER");
    if (!account) return Response.json({ error: "Driver access required" }, { status: 403, headers: noStore });
    const value = command.parse(await request.json());
    const driverAvailability = await dispatchTransaction(async (tx) => {
      const driver = await tx.driverProfile.findUniqueOrThrow({ where: { userId: account.id } });
      if (value.isAvailable) {
        if (!value.selectedVehicleId || !await tx.vehicle.count({ where: { id: value.selectedVehicleId, active: true } })) throw new DispatchError("Select an active vehicle", 422);
        if (await tx.driverProfile.count({ where: { id: { not: driver.id }, isAvailable: true, selectedVehicleId: value.selectedVehicleId, user: { status: "ACTIVE", role: "DRIVER" } } })) throw new DispatchError("Vehicle selected by another available driver");
      }
      if (value.selectedVehicleId !== driver.selectedVehicleId && await tx.booking.count({ where: { driverId: driver.id, status: { in: inServiceStatuses } } })) throw new DispatchError("Finish the current trip before changing vehicle");
      if (value.selectedVehicleId && !await tx.vehicle.count({ where: { id: value.selectedVehicleId, active: true } })) throw new DispatchError("Select an active vehicle", 422);
      if (driver.isAvailable === value.isAvailable && driver.selectedVehicleId === value.selectedVehicleId) return { isAvailable: driver.isAvailable, availableSince: driver.availableSince, selectedVehicleId: driver.selectedVehicleId };
      const updated = await tx.driverProfile.update({
        where: { id: driver.id },
        data: { ...value, ...(value.isAvailable && (!driver.isAvailable || driver.selectedVehicleId !== value.selectedVehicleId) ? { availableSince: new Date() } : {}) },
      });
      await tx.auditLog.create({ data: { actorId: account.id, entity: "DriverProfile", entityId: driver.id, action: "AVAILABILITY", metadata: { previousAvailable: driver.isAvailable, isAvailable: updated.isAvailable, previousVehicleId: driver.selectedVehicleId, selectedVehicleId: updated.selectedVehicleId } } });
      await enqueueAvailabilityPush(tx, updated);
      return { isAvailable: updated.isAvailable, availableSince: updated.availableSince, selectedVehicleId: updated.selectedVehicleId };
    });
    schedulePushDelivery();
    return Response.json({ driverAvailability }, { headers: noStore });
  } catch (error) { return failure(error); }
}
