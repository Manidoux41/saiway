import { authorize } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { blogFailure } from "@/lib/blog";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ photoId: string }> }) {
  try {
    const { photoId } = await params;
    const preview = new URL(request.url).searchParams.get("preview") === "true";
    if (preview && !await authorize(request, "ADMIN")) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const photo = await prisma.blogPhoto.findFirst({
      where: { id: photoId, ...(!preview ? { post: { published: true } } : {}) },
      select: { data: true, mimeType: true, sizeBytes: true },
    });
    if (!photo) return Response.json({ error: "Not found" }, { status: 404 });
    return new Response(Buffer.from(photo.data), { headers: {
      "Content-Type": photo.mimeType, "Content-Length": String(photo.sizeBytes),
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (error) { return blogFailure(error); }
}
