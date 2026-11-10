import "server-only";
import sharp from "sharp";
import { z } from "zod";
import { authorize } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { readDriverImageUpload } from "@/lib/driver-image-upload";
import { blogAdminInclude, blogFailure } from "@/lib/blog";

export async function mutateBlogPhoto(request: Request, postId: string, photoId?: string) {
  try {
    const actor = await authorize(request, "ADMIN");
    if (!actor) return Response.json({ error: "Administrator access required" }, { status: 403 });
    let upload: { data: Uint8Array<ArrayBuffer>; mimeType: string; sizeBytes: number } | undefined;
    let caption: string | undefined;
    if (request.method === "POST" || request.method === "PUT") {
      const image = await readDriverImageUpload(request);
      if (image instanceof Response) return image;
      try {
        const data = await sharp(image.data, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
        upload = { data: new Uint8Array(data), mimeType: "image/webp", sizeBytes: data.length };
      } catch {
        return Response.json({ error: "Invalid image" }, { status: 415 });
      }
    } else if (request.method === "PATCH") {
      const parsed = z.object({ caption: z.string().trim().min(1).max(500) }).strict().safeParse(await request.json());
      if (!parsed.success) return Response.json({ error: "Invalid caption" }, { status: 400 });
      caption = parsed.data.caption;
    }
    const post = await prisma.$transaction(async (tx) => {
      const parent = await tx.blogPost.update({ where: { id: postId }, data: { updatedAt: new Date() } });
      let id = photoId;
      if (request.method === "POST" && upload) {
        const last = await tx.blogPhoto.aggregate({ where: { postId }, _max: { sortOrder: true } });
        id = (await tx.blogPhoto.create({ data: { postId, caption: parent.title, sortOrder: (last._max.sortOrder ?? -1) + 1, ...upload }, select: { id: true } })).id;
      }
      else if (request.method === "DELETE") await tx.blogPhoto.delete({ where: { id: photoId, postId } });
      else await tx.blogPhoto.update({ where: { id: photoId, postId }, data: { ...(upload ?? {}), ...(caption !== undefined ? { caption } : {}) } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "BlogPhoto", entityId: id, action: request.method === "DELETE" ? "DELETE" : request.method === "POST" ? "UPLOAD" : "UPDATE", metadata: { postId } } });
      return tx.blogPost.findUniqueOrThrow({ where: { id: postId }, include: blogAdminInclude });
    });
    return Response.json({ post }, { status: request.method === "POST" ? 201 : 200 });
  } catch (error) { return blogFailure(error); }
}
