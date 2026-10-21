import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/access";

export const employerKeys = ["name", "registrationNo", "address", "representative", "representativeTitle"] as const;
export type Employer = Record<(typeof employerKeys)[number], string | null>;
const settingKey = (key: string) => `employer.${key}`;

const employerInput = z.object({
  name: z.string().trim().max(200),
  registrationNo: z.string().trim().max(100),
  address: z.string().trim().max(500),
  representative: z.string().trim().max(200),
  representativeTitle: z.string().trim().max(120),
}).partial().strict();

export async function readEmployer(db: Pick<typeof prisma, "systemSetting"> = prisma): Promise<Employer> {
  const rows = await db.systemSetting.findMany({ where: { key: { in: employerKeys.map(settingKey) } } });
  return Object.fromEntries(employerKeys.map((key) => [key, rows.find((row) => row.key === settingKey(key))?.value || null])) as Employer;
}

export async function employerSettings(request: Request) {
  try {
    const admin = await authorize(request, "ADMIN");
    if (!admin) return Response.json({ error: "Administrator access required" }, { status: 403 });
    if (request.method === "GET") return Response.json({ employer: await readEmployer() }, { headers: { "Cache-Control": "no-store" } });
    let body: unknown;
    try { body = await request.json(); } catch { return Response.json({ error: "Invalid values" }, { status: 400 }); }
    const parsed = employerInput.safeParse(body);
    if (!parsed.success) return Response.json({ error: "Invalid values" }, { status: 400 });
    await prisma.$transaction(async (tx) => {
      for (const [key, value] of Object.entries(parsed.data)) {
        if (value) await tx.systemSetting.upsert({ where: { key: settingKey(key) }, create: { key: settingKey(key), value }, update: { value } });
        else await tx.systemSetting.deleteMany({ where: { key: settingKey(key) } });
      }
      await tx.auditLog.create({ data: { actorId: admin.id, entity: "EmployerSettings", action: "UPDATE", metadata: { fields: Object.keys(parsed.data) } } });
    });
    return Response.json({ employer: await readEmployer() });
  } catch (error) {
    console.error("Employer settings request failed", { name: error instanceof Error ? error.name : "UNKNOWN" });
    return Response.json({ error: "Settings service unavailable" }, { status: 503 });
  }
}
