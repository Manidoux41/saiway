import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth-session";

export const runtime = "nodejs";

function guard(request: Request) {
  const session = readSession(request);
  return session?.role === "ADMIN";
}

export async function GET(request: Request) {
  if (!guard(request)) return Response.json({ error: "Administrator access required" }, { status: 403 });
  const [users, vehicles, entries, forecasts, contracts] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.vehicle.findMany({ include: { contracts: true }, orderBy: { createdAt: "desc" } }),
    prisma.accountingEntry.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.forecastLine.findMany({ orderBy: { month: "asc" } }),
    prisma.vehicleContract.findMany({ include: { vehicle: { select: { name: true, plate: true } } }, orderBy: { startsAt: "desc" } }),
  ]);
  return Response.json({ users, vehicles, entries, forecasts, contracts }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!guard(request)) return Response.json({ error: "Administrator access required" }, { status: 403 });
  try {
    const body = await request.json() as { entity?: string; data?: Record<string, unknown> };
    const data = body.data || {};
    if (body.entity === "accounting") return Response.json({ item: await prisma.accountingEntry.create({ data: { type: data.type as never, label: String(data.label), amountCents: Number(data.amountCents), currency: String(data.currency || "USD"), dueAt: data.dueAt ? new Date(String(data.dueAt)) : undefined, notes: data.notes ? String(data.notes) : undefined } }) }, { status: 201 });
    if (body.entity === "forecast") return Response.json({ item: await prisma.forecastLine.create({ data: { month: new Date(String(data.month)), expectedRevenueCents: Number(data.expectedRevenueCents || 0), expectedExpenseCents: Number(data.expectedExpenseCents || 0), notes: data.notes ? String(data.notes) : undefined } }) }, { status: 201 });
    if (body.entity === "vehicle") return Response.json({ item: await prisma.vehicle.create({ data: { name: String(data.name), plate: String(data.plate), seats: Number(data.seats) } }) }, { status: 201 });
    return Response.json({ error: "Unsupported management entity" }, { status: 400 });
  } catch {
    return Response.json({ error: "Unable to create management record" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  if (!guard(request)) return Response.json({ error: "Administrator access required" }, { status: 403 });
  try {
    const body = await request.json() as { entity?: string; id?: string; data?: Record<string, unknown> };
    const data = body.data || {};
    if (!body.id) return Response.json({ error: "Missing record id" }, { status: 400 });
    if (body.entity === "user") return Response.json({ item: await prisma.user.update({ where: { id: body.id }, data: { name: data.name ? String(data.name) : undefined, status: data.status as never } }) });
    if (body.entity === "vehicle") return Response.json({ item: await prisma.vehicle.update({ where: { id: body.id }, data: { name: data.name ? String(data.name) : undefined, plate: data.plate ? String(data.plate) : undefined, seats: data.seats ? Number(data.seats) : undefined, active: typeof data.active === "boolean" ? data.active : undefined } }) });
    if (body.entity === "accounting") return Response.json({ item: await prisma.accountingEntry.update({ where: { id: body.id }, data: { label: data.label ? String(data.label) : undefined, amountCents: data.amountCents ? Number(data.amountCents) : undefined, paidAt: data.paidAt ? new Date(String(data.paidAt)) : undefined, notes: data.notes ? String(data.notes) : undefined } }) });
    return Response.json({ error: "Unsupported management entity" }, { status: 400 });
  } catch {
    return Response.json({ error: "Unable to update management record" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!guard(request)) return Response.json({ error: "Administrator access required" }, { status: 403 });
  try {
    const body = await request.json() as { entity?: string; id?: string };
    if (!body.id) return Response.json({ error: "Missing record id" }, { status: 400 });
    if (body.entity === "user") await prisma.user.update({ where: { id: body.id }, data: { status: "SUSPENDED" } });
    else if (body.entity === "vehicle") await prisma.vehicle.update({ where: { id: body.id }, data: { active: false } });
    else if (body.entity === "accounting") await prisma.accountingEntry.delete({ where: { id: body.id } });
    else return Response.json({ error: "Unsupported management entity" }, { status: 400 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unable to delete management record" }, { status: 400 });
  }
}
