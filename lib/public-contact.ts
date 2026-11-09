import "server-only";
import { prisma } from "@/lib/prisma";
import { contactSettingKey, contactSettings, defaultContactDriverName, defaultContactEmail } from "@/lib/contact-settings";

export async function publicContact() {
  const stored = await prisma.systemSetting.findUnique({ where: { key: contactSettingKey } });
  const settings = contactSettings(stored?.value);
  const driverId = settings?.driverId;
  const driver = driverId === null ? null : await prisma.driverProfile.findFirst({
    where: {
      ...(driverId ? { id: driverId } : {}),
      user: { status: "ACTIVE", ...(!settings ? { name: { equals: defaultContactDriverName, mode: "insensitive" } } : {}) },
    },
    select: { id: true, user: { select: { name: true } }, contactQrImages: { select: { channel: true, uploadedAt: true } } },
    orderBy: { id: "asc" },
  });
  return { email: settings?.email ?? defaultContactEmail, driver };
}
