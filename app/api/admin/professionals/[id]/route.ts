import { reviewProfessional } from "@/lib/professionals";
export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return reviewProfessional(request, (await params).id);
}
