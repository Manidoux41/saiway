import { z } from "zod";
import { authorize } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { blogAdminInclude, blogFailure } from "@/lib/blog";

export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const actor = await authorize(request, "ADMIN");
    if (!actor) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const input = z.object({ expectedUpdatedAt: z.iso.datetime(), photoIds: z.array(z.string().min(1)).max(500) }).strict().safeParse(await request.json());
    if (!input.success) return Response.json({ error: "Invalid photo order" }, { status: 400 });
    const { postId } = await params;
    const post = await prisma.$transaction(async (tx) => {
      await tx.blogPost.update({ where: { id: postId, updatedAt: new Date(input.data.expectedUpdatedAt) }, data: { updatedAt: new Date() } });
      const photos = await tx.blogPhoto.findMany({ where: { postId }, select: { id: true } });
      const ids = new Set(input.data.photoIds);
      if (ids.size !== photos.length || ids.size !== input.data.photoIds.length || photos.some((photo) => !ids.has(photo.id))) throw new Error("INVALID_PHOTO_ORDER");
      for (const [sortOrder, id] of input.data.photoIds.entries()) await tx.blogPhoto.update({ where: { id, postId }, data: { sortOrder } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "BlogPost", entityId: postId, action: "REORDER_PHOTOS", metadata: { photoIds: input.data.photoIds } } });
      return tx.blogPost.findUniqueOrThrow({ where: { id: postId }, include: blogAdminInclude });
    });
    return Response.json({ post });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PHOTO_ORDER") return Response.json({ error: "Photo order must contain all and only this article's photos" }, { status: 400 });
    return blogFailure(error);
  }
}
