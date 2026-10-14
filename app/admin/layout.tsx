import { requireRole } from "@/lib/access";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN");
  return children;
}
