import { downloadBusinessCards } from "@/lib/admin-business-cards";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return downloadBusinessCards(request);
}
