import { z } from "zod";

export const blogInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().min(1).max(600),
  content: z.string().trim().min(1).max(100000),
  language: z.enum(["en", "fr", "km"]),
  published: z.boolean(),
  featured: z.boolean(),
  bookingId: z.string().min(1).nullable(),
}).strict();
export const blogPhotoSchema = z.object({ id: z.string(), caption: z.string(), updatedAt: z.string() });
export const blogPostSchema = blogInputSchema.extend({
  id: z.string(), publishedAt: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
  photos: z.array(blogPhotoSchema),
  booking: z.object({ reference: z.string(), status: z.string() }).nullable(),
});
export type AdminBlogPost = z.infer<typeof blogPostSchema>;
export type BlogInput = z.infer<typeof blogInputSchema>;
export type BlogCardData = {
  id: string; title: string; excerpt: string; language: string; publishedAt: string | null;
  photos: { id: string; caption: string; updatedAt: string }[];
};
export type PublicBlogPost = BlogCardData & { content: string };
export function blogPhotoUrl(photo: { id: string; updatedAt: string }, admin = false) {
  return `/api/blog/photos/${encodeURIComponent(photo.id)}${admin ? "?preview=true&" : "?"}v=${encodeURIComponent(photo.updatedAt)}`;
}
