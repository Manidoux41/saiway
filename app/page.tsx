import HomePage from "@/components/home-page";
import { currentAccount } from "@/lib/access";
import { roleHome } from "@/lib/roles";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { publishedBlogPosts } from "@/lib/blog";
import type { BlogCardData } from "@/lib/blog-client";

export default async function Page() {
  const account = await currentAccount();
  if (account && account.role !== "CUSTOMER") redirect(roleHome(account.role));
  const [background, featured] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: "heroBackground" }, select: { value: true } }),
    publishedBlogPosts({ featured: true }).then((posts): { posts: BlogCardData[]; error: boolean } => ({ posts, error: false })).catch((error: unknown) => {
    console.error("Featured blog unavailable", { name: error instanceof Error ? error.name : "UNKNOWN" });
    return { posts: [], error: true };
    }),
  ]);
  return <HomePage background={background?.value} featuredPosts={featured.posts} featuredError={featured.error} />;
}
