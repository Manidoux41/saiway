import { mutateAdvertisingImage } from "@/lib/advertising";

export const runtime = "nodejs";
type Context = { params: Promise<{ contractId: string }> };
export async function PUT(request: Request, { params }: Context) {
  return mutateAdvertisingImage(request, (await params).contractId);
}
export async function DELETE(request: Request, { params }: Context) {
  return mutateAdvertisingImage(request, (await params).contractId);
}
