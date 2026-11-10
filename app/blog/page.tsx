import { BlogIndex } from "@/components/blog/blog-public";
import { publishedBlogPosts } from "@/lib/blog";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const value = Number((await searchParams).page ?? "1");
  if (!Number.isSafeInteger(value) || value < 1 || value > 100000) notFound();
  const page = value;
  const posts = await publishedBlogPosts({ page });
  return <BlogIndex posts={posts} page={page} />;
}
