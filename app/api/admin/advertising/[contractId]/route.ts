import { mutateAdvertising } from "@/lib/advertising";

export const runtime = "nodejs";
type Context = { params: Promise<{ contractId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return mutateAdvertising(request, (await params).contractId);
}
export async function DELETE(request: Request, { params }: Context) {
  return mutateAdvertising(request, (await params).contractId);
}
