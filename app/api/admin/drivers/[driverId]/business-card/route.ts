import { downloadBusinessCards } from "@/lib/admin-business-cards";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ driverId: string }> }) {
  return downloadBusinessCards(request, (await params).driverId);
}
