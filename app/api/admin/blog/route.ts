import { authorize } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { blogInputSchema } from "@/lib/blog-client";
import { blogAdminInclude, blogFailure } from "@/lib/blog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!await authorize(request, "ADMIN")) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const page = Number(new URL(request.url).searchParams.get("page") ?? "1");
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return Response.json({ error: "Invalid page" }, { status: 400 });
    const [posts, trips] = await Promise.all([
      prisma.blogPost.findMany({ include: blogAdminInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, skip: (page - 1) * 20 }),
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
    const post = await prisma.$transaction(async (tx) => {
      if (input.data.bookingId && !await tx.booking.count({ where: { id: input.data.bookingId, status: "TRIP_COMPLETED" } })) return null;
      const post = await tx.blogPost.create({ data: { ...input.data, publishedAt: input.data.published ? new Date() : null }, include: blogAdminInclude });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "BlogPost", entityId: post.id, action: "CREATE" } });
      return post;
    });
    return post ? Response.json({ post }, { status: 201 }) : Response.json({ error: "Select a completed trip" }, { status: 400 });
  } catch (error) { return blogFailure(error); }
}
