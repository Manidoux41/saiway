import { ContactPage } from "@/components/contact-page";
import { publicContact } from "@/lib/public-contact";

export const dynamic = "force-dynamic";

export default async function Page() {
  let contact: Awaited<ReturnType<typeof publicContact>> | undefined;
  try {
    contact = await publicContact();
  } catch (error) {
    console.error("Public contact page unavailable", { name: error instanceof Error ? error.name : "UNKNOWN" });
  }
  if (!contact) return <ContactPage error />;
  return <ContactPage email={contact.email} driver={contact.driver ? {
    name: contact.driver.user.name,
    images: contact.driver.contactQrImages.map((image) => ({ channel: image.channel, uploadedAt: image.uploadedAt.toISOString() })),
  } : null} />;
}
