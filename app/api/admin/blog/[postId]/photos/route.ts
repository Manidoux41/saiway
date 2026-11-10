import { mutateBlogPhoto } from "@/lib/blog-photos";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  return mutateBlogPhoto(request, (await params).postId);
}
