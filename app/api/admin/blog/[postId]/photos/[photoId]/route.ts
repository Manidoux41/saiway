import { mutateBlogPhoto } from "@/lib/blog-photos";

export const runtime = "nodejs";
type Context = { params: Promise<{ postId: string; photoId: string }> };
async function mutate(request: Request, { params }: Context) {
  const { postId, photoId } = await params;
  return mutateBlogPhoto(request, postId, photoId);
}
export const PATCH = mutate;
export const PUT = mutate;
export const DELETE = mutate;
