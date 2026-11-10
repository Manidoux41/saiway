import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { BlogCardData, PublicBlogPost } from "@/lib/blog-client";

export const blogPhotoSelect = { id: true, caption: true, updatedAt: true } as const;
export const blogAdminInclude = { photos: { select: blogPhotoSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, booking: { select: { reference: true, status: true } } } satisfies Prisma.BlogPostInclude;
const publicSelect = {
  id: true, title: true, excerpt: true, language: true, publishedAt: true,
  photos: { select: blogPhotoSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.BlogPostSelect;

export async function publishedBlogPosts({ featured = false, page = 1 }: { featured?: boolean; page?: number } = {}): Promise<BlogCardData[]> {
  const posts = await prisma.blogPost.findMany({
    where: { published: true, ...(featured ? { featured: true } : {}) },
    select: { ...publicSelect, photos: { ...publicSelect.photos, take: 1 } },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: featured ? 3 : 12, skip: featured ? 0 : (page - 1) * 12,
  });
  return posts.map((post) => ({ ...post, publishedAt: post.publishedAt?.toISOString() ?? null, photos: post.photos.map((photo) => ({ ...photo, updatedAt: photo.updatedAt.toISOString() })) }));
}

export async function publishedBlogPost(id: string): Promise<PublicBlogPost | null> {
  const post = await prisma.blogPost.findFirst({ where: { id, published: true }, select: { ...publicSelect, content: true } });
  return post ? { ...post, publishedAt: post.publishedAt?.toISOString() ?? null, photos: post.photos.map((photo) => ({ ...photo, updatedAt: photo.updatedAt.toISOString() })) } : null;
}

export function blogFailure(error: unknown) {
  if (error instanceof SyntaxError) return Response.json({ error: "Invalid request" }, { status: 400 });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return Response.json({ error: "Article changed or no longer exists. Reload and retry." }, { status: 409 });
    if (error.code === "P2003") return Response.json({ error: "Invalid related record" }, { status: 400 });
  }
  console.error("Blog request failed", { name: error instanceof Error ? error.name : "UNKNOWN" });
  return Response.json({ error: "Blog service unavailable" }, { status: 503 });
}
