import { vehicleIcon } from "@/lib/vehicle-icon";

export const runtime = "nodejs";
type Context = { params: Promise<{ vehicleId: string }> };

export async function GET(request: Request, { params }: Context) {
  return vehicleIcon(request, (await params).vehicleId);
}
