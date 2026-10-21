import { getAccount, updateAccount } from "@/lib/admin-accounts";

export const runtime = "nodejs";
type Context = { params: Promise<{ userId: string }> };

export async function GET(request: Request, { params }: Context) {
  return getAccount(request, (await params).userId);
}

export async function PATCH(request: Request, { params }: Context) {
  return updateAccount(request, (await params).userId);
}
