import { advertisingImage } from "@/lib/advertising";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ contractId: string }> }) {
  return advertisingImage(request, (await params).contractId);
}
