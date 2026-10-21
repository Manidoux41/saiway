import { createContract } from "@/lib/employment-contracts";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ driverId: string }> }) {
  return createContract(request, (await params).driverId);
}
