import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = readSession(request);
  if (!session || session.role !== "CUSTOMER") return Response.json({ error: "Customer access required" }, { status: 403 });
  const profile = await prisma.user.findUnique({ where: { id: session.id }, select: { name: true, email: true, phone: true, customer: { select: { address: true, paymentBrand: true, paymentLast4: true } } } });
  return Response.json(profile, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const session = readSession(request);
  if (!session || session.role !== "CUSTOMER") return Response.json({ error: "Customer access required" }, { status: 403 });
  try {
    const body = await request.json() as { name?: string; phone?: string; address?: string; paymentBrand?: string; paymentLast4?: string; paymentProviderCustomerId?: string };
    const user = await prisma.user.update({ where: { id: session.id }, data: { name: body.name?.trim(), phone: body.phone?.trim(), customer: { upsert: { create: { address: body.address?.trim(), paymentBrand: body.paymentBrand?.trim(), paymentLast4: body.paymentLast4?.replace(/\D/g, "").slice(-4), paymentProviderCustomerId: body.paymentProviderCustomerId?.trim() }, update: { address: body.address?.trim(), paymentBrand: body.paymentBrand?.trim(), paymentLast4: body.paymentLast4?.replace(/\D/g, "").slice(-4), paymentProviderCustomerId: body.paymentProviderCustomerId?.trim() } } } }, select: { name: true, email: true, phone: true, customer: { select: { address: true, paymentBrand: true, paymentLast4: true } } } });
    return Response.json(user);
  } catch {
    return Response.json({ error: "Unable to update account" }, { status: 400 });
  }
}
