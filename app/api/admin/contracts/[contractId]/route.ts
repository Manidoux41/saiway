import { changeContract, deleteContract } from "@/lib/employment-contracts";

export const runtime = "nodejs";
type Context = { params: Promise<{ contractId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  return changeContract(request, (await params).contractId);
}

export async function DELETE(request: Request, { params }: Context) {
  return deleteContract(request, (await params).contractId);
}
