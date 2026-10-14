import { requireRole } from "@/lib/access";

export default async function BookingLayout({ children }: { children: React.ReactNode }) {
  await requireRole("CUSTOMER");
  return children;
}
