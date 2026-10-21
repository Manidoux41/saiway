import { contractPdf } from "@/lib/employment-contracts";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ contractId: string }> }) {
  return contractPdf(request, (await params).contractId);
}
