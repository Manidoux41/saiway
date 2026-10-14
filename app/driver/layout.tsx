import { requireRole } from "@/lib/access";

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  await requireRole("DRIVER");
  return children;
}
