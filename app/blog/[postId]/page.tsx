import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/blog/blog-public";
import { publishedBlogPost } from "@/lib/blog";

export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ postId: string }> }) {
  const post = await publishedBlogPost((await params).postId);
  if (!post) notFound();
  return <BlogArticle post={post} />;
}
