import { authorize } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { blogInputSchema } from "@/lib/blog-client";
import { blogAdminInclude, blogFailure } from "@/lib/blog";
import { blogListOrder, blogListQuerySchema } from "@/lib/blog-list-query";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!await authorize(request, "ADMIN")) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const query = blogListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return Response.json({ error: "Invalid listing query" }, { status: 400 });
    const { page } = query.data;
    const [posts, trips] = await Promise.all([
      prisma.blogPost.findMany({ include: blogAdminInclude, orderBy: blogListOrder(query.data), take: 20, skip: (page - 1) * 20 }),
      prisma.booking.findMany({ where: { status: "TRIP_COMPLETED" }, select: { id: true, reference: true }, orderBy: { pickupAt: "desc" } }),
    ]);
    return Response.json({ posts, trips }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return blogFailure(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await authorize(request, "ADMIN");
    if (!actor) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const input = blogInputSchema.safeParse(await request.json());
    if (!input.success) return Response.json({ error: "Invalid article" }, { status: 400 });
    if (input.data.coverPhotoId) return Response.json({ error: "Save the draft before selecting a header photo" }, { status: 400 });
    const post = await prisma.$transaction(async (tx) => {
      if (input.data.bookingId && !await tx.booking.count({ where: { id: input.data.bookingId, status: "TRIP_COMPLETED" } })) return null;
      const post = await tx.blogPost.create({ data: { ...input.data, publishedAt: input.data.published ? new Date() : null }, include: blogAdminInclude });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "BlogPost", entityId: post.id, action: "CREATE" } });
      return post;
    });
    return post ? Response.json({ post }, { status: 201 }) : Response.json({ error: "Select a completed trip" }, { status: 400 });
  } catch (error) { return blogFailure(error); }
}
