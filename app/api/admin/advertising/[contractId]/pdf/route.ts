import { advertisingPdf } from "@/lib/advertising-pdf";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ contractId: string }> }) {
  return advertisingPdf(request, (await params).contractId);
}
