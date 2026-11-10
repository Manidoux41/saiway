import { z } from "zod";

export const blogInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().max(600),
  content: z.string().trim().max(100000),
  language: z.enum(["en", "fr", "km"]),
  published: z.boolean(),
  featured: z.boolean(),
  bookingId: z.string().min(1).nullable(),
  layout: z.enum(["STACKED", "GRID", "ALTERNATING"]).default("STACKED"),
  coverPhotoId: z.string().min(1).nullable().default(null),
}).strict().superRefine((value, ctx) => {
  if (value.published) {
    if (!value.excerpt) ctx.addIssue({ code: "custom", path: ["excerpt"], message: "Introduction required to publish" });
    if (!value.content) ctx.addIssue({ code: "custom", path: ["content"], message: "Text required to publish" });
  }
});
export const blogPhotoSchema = z.object({ id: z.string(), caption: z.string(), updatedAt: z.string(), sortOrder: z.number().int().default(0) });
export const blogPostSchema = blogInputSchema.safeExtend({
  id: z.string(), publishedAt: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
  photos: z.array(blogPhotoSchema),
  booking: z.object({ reference: z.string(), status: z.string() }).nullable(),
});
export type AdminBlogPost = z.infer<typeof blogPostSchema>;
export type BlogInput = z.infer<typeof blogInputSchema>;
export type BlogCardData = {
  id: string; title: string; excerpt: string; language: string; publishedAt: string | null;
  photos: { id: string; caption: string; updatedAt: string }[];
  coverPhoto?: { id: string; caption: string; updatedAt: string } | null;
};
export type PublicBlogPost = BlogCardData & { content: string; layout: "STACKED" | "GRID" | "ALTERNATING" };
export function blogPhotoUrl(photo: { id: string; updatedAt: string }, admin = false) {
  return `/api/blog/photos/${encodeURIComponent(photo.id)}${admin ? "?preview=true&" : "?"}v=${encodeURIComponent(photo.updatedAt)}`;
}
