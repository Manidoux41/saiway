import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const blogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  sort: z.enum(["createdAt", "updatedAt", "publishedAt", "title", "language", "published", "featured", "layout"]).default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});

export function blogListOrder({ sort, direction }: z.infer<typeof blogListQuerySchema>): Prisma.BlogPostOrderByWithRelationInput[] {
  const field: Prisma.BlogPostOrderByWithRelationInput = sort === "publishedAt"
    ? { publishedAt: { sort: direction, nulls: "last" } } : { [sort]: direction };
  return [field, { id: direction }];
}
