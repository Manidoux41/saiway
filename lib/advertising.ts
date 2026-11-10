import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { activeAccount, authorize } from "@/lib/access";
import { advertisingInputSchema, advertisingPlacements } from "@/lib/advertising-client";
import { DispatchError, dispatchTransaction } from "@/lib/driver-dispatch";
import { readDriverImageUpload } from "@/lib/driver-image-upload";

export const advertisingSelect = {
  id: true, reference: true, advertiser: true, contactName: true, contactEmail: true, contactPhone: true,
  title: true, description: true, targetUrl: true, placements: true, status: true, startsAt: true, endsAt: true,
  amountCents: true, currency: true, priority: true, notes: true, terms: true, createdAt: true, updatedAt: true, deletedAt: true,
  image: { select: { updatedAt: true } },
} satisfies Prisma.AdvertisingContractSelect;
const versionSchema = z.object({ expectedUpdatedAt: z.iso.datetime({ offset: true }) }).strict();
const editSchema = advertisingInputSchema.safeExtend({ expectedUpdatedAt: z.iso.datetime({ offset: true }) });
const removeSchema = versionSchema.extend({ reason: z.string().trim().min(1).max(500) });
export const activeAdvertisingWhere = (now = new Date()): Prisma.AdvertisingContractWhereInput => ({
  deletedAt: null, status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now }, NOT: { placements: { isEmpty: true } },
});
const noCache = { "Cache-Control": "no-store" };

export function advertisingFailure(error: unknown) {
  if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid advertising contract" }, { status: 400 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return Response.json({ error: "Contract changed or was deleted. Reload before editing." }, { status: 409 });
  if (error instanceof DispatchError) return Response.json({ error: "Concurrent update; reload and retry." }, { status: 409 });
  console.error("Advertising service failed", { code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : error instanceof Error ? error.name : "UNKNOWN" });
  return Response.json({ error: "Advertising service unavailable. Verify migrations and retry." }, { status: 503 });
}

export async function listAdvertising(request: Request) {
  try {
    if (!await authorize(request, "ADMIN")) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const contracts = await prisma.advertisingContract.findMany({ where: { deletedAt: null }, select: advertisingSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    return Response.json({ contracts }, { headers: noCache });
  } catch (error) { return advertisingFailure(error); }
}

export async function mutateAdvertising(request: Request, id?: string) {
  try {
    const actor = await authorize(request, "ADMIN");
    if (!actor) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const body: unknown = await request.json();
    const input = request.method === "DELETE" ? removeSchema.parse(body) : id ? editSchema.parse(body) : advertisingInputSchema.parse(body);
    const contract = await dispatchTransaction(async (tx) => {
      const before = id ? await tx.advertisingContract.findFirstOrThrow({ where: { id, deletedAt: null }, select: advertisingSelect }) : null;
      let updated;
      if (id && "expectedUpdatedAt" in input) {
        const { expectedUpdatedAt, ...changes } = input;
        const where = { id, deletedAt: null, updatedAt: new Date(expectedUpdatedAt) };
        if ("reason" in changes) updated = await tx.advertisingContract.update({ where, data: { deletedAt: new Date(), status: "ENDED" }, select: advertisingSelect });
        else updated = await tx.advertisingContract.update({ where, data: changes, select: advertisingSelect });
      } else {
        const data = advertisingInputSchema.parse(input);
        updated = await tx.advertisingContract.create({ data: { ...data, reference: `AD-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}` }, select: advertisingSelect });
      }
      await tx.auditLog.create({ data: {
        actorId: actor.id, entity: "AdvertisingContract", entityId: updated.id, action: request.method === "DELETE" ? "DELETE" : id ? "UPDATE" : "CREATE",
        metadata: { before: JSON.parse(JSON.stringify(before)), after: JSON.parse(JSON.stringify(updated)), ...("reason" in input ? { reason: input.reason } : {}) },
      } });
      return updated;
    });
    return Response.json({ contract }, { status: id ? 200 : 201, headers: noCache });
  } catch (error) { return advertisingFailure(error); }
}

export async function publicAdvertising(request: Request) {
  try {
    const placement = z.enum(advertisingPlacements).parse(new URL(request.url).searchParams.get("placement"));
    if (placement === "DRIVER") {
      const account = await activeAccount(request);
      if (!account || !["DRIVER", "ADMIN"].includes(account.role)) return Response.json({ error: "Driver access required" }, { status: 403 });
    }
    const advertisements = await prisma.advertisingContract.findMany({
      where: { ...activeAdvertisingWhere(), placements: { has: placement } },
      select: { id: true, advertiser: true, title: true, description: true, targetUrl: true, endsAt: true, image: { select: { updatedAt: true } } },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }, { id: "asc" }], take: 6,
    });
    return Response.json({ advertisements }, { headers: noCache });
  } catch (error) { return advertisingFailure(error); }
}

export async function advertisingImage(request: Request, id: string) {
  try {
    const preview = new URL(request.url).searchParams.get("preview") === "true";
    if (preview && !await authorize(request, "ADMIN")) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const contract = await prisma.advertisingContract.findFirst({
      where: { id, ...(preview ? { deletedAt: null } : activeAdvertisingWhere()) },
      select: { image: { select: { data: true } } },
    });
    if (!contract?.image) return new Response(null, { status: 404, headers: noCache });
    return new Response(new Uint8Array(contract.image.data), { headers: { ...noCache, "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return advertisingFailure(error); }
}

export async function mutateAdvertisingImage(request: Request, id: string) {
  try {
    const actor = await authorize(request, "ADMIN");
    if (!actor) return Response.json({ error: "Administrator access required" }, { status: 403 });
    let version: string;
    let data: Uint8Array<ArrayBuffer> | undefined;
    if (request.method === "PUT") {
      const query = versionSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
      version = query.expectedUpdatedAt;
      const upload = await readDriverImageUpload(request);
      if (upload instanceof Response) return upload;
      try {
        data = new Uint8Array(await sharp(upload.data, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1200, height: 800, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer());
      } catch {
        return Response.json({ error: "Invalid advertising image" }, { status: 415 });
      }
    } else version = versionSchema.parse(await request.json()).expectedUpdatedAt;
    const contract = await dispatchTransaction(async (tx) => {
      const updated = await tx.advertisingContract.update({ where: { id, deletedAt: null, updatedAt: new Date(version) }, data: { updatedAt: new Date() }, select: { id: true } });
      if (data) await tx.advertisingImage.upsert({ where: { contractId: id }, create: { contractId: id, data }, update: { data } });
      else await tx.advertisingImage.deleteMany({ where: { contractId: id } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "AdvertisingContract", entityId: updated.id, action: data ? "UPLOAD_IMAGE" : "DELETE_IMAGE" } });
      return tx.advertisingContract.findUniqueOrThrow({ where: { id }, select: advertisingSelect });
    });
    return Response.json({ contract }, { headers: noCache });
  } catch (error) { return advertisingFailure(error); }
}
