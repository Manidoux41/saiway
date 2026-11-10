import { z } from "zod";
import { authorize } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { blogInputSchema } from "@/lib/blog-client";
import { blogAdminInclude, blogFailure } from "@/lib/blog";

export const runtime = "nodejs";
type Context = { params: Promise<{ postId: string }> };
const version = z.object({ expectedUpdatedAt: z.iso.datetime() });

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, "ADMIN");
    if (!actor) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const { postId } = await params;
    const input = blogInputSchema.safeExtend({ expectedUpdatedAt: z.iso.datetime() }).safeParse(await request.json());
    if (!input.success) return Response.json({ error: "Invalid article" }, { status: 400 });
    const { expectedUpdatedAt, ...data } = input.data;
    const post = await prisma.$transaction(async (tx) => {
      if (data.bookingId && !await tx.booking.count({ where: { id: data.bookingId, status: "TRIP_COMPLETED" } })) return null;
      if (data.coverPhotoId && !await tx.blogPhoto.count({ where: { id: data.coverPhotoId, postId } })) return null;
      const previous = await tx.blogPost.findUniqueOrThrow({ where: { id: postId, updatedAt: new Date(expectedUpdatedAt) } });
      const post = await tx.blogPost.update({ where: { id: postId, updatedAt: previous.updatedAt }, data: { ...data, publishedAt: data.published ? previous.publishedAt ?? new Date() : null }, include: blogAdminInclude });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "BlogPost", entityId: postId, action: "UPDATE" } });
      return post;
    });
    return post ? Response.json({ post }) : Response.json({ error: "Select a completed trip" }, { status: 400 });
  } catch (error) { return blogFailure(error); }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, "ADMIN");
    if (!actor) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const { postId } = await params;
    const input = version.strict().safeParse(await request.json());
    if (!input.success) return Response.json({ error: "Invalid version" }, { status: 400 });
    await prisma.$transaction(async (tx) => {
      await tx.blogPost.delete({ where: { id: postId, updatedAt: new Date(input.data.expectedUpdatedAt) } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "BlogPost", entityId: postId, action: "DELETE" } });
    });
    return Response.json({ ok: true });
  } catch (error) { return blogFailure(error); }
}
