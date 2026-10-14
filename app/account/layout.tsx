import { requireRole } from "@/lib/access";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireRole("CUSTOMER");
  return children;
}
