"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { blogPhotoUrl, type BlogCardData, type PublicBlogPost } from "@/lib/blog-client";
import { localizedDate } from "@/lib/locale-format";

export function BlogImage({ photo, cover = false, admin = false }: { photo: { id: string; caption: string; updatedAt: string }; cover?: boolean; admin?: boolean }) {
  const { t } = useLanguage();
  const [failed, setFailed] = useState(false);
  return failed ? <p role="alert" className="p-4 text-sm text-red-700">{t("blog.imageError")}</p> : <Image src={blogPhotoUrl(photo, admin)} alt={photo.caption} width={1200} height={800} unoptimized onError={() => setFailed(true)} className={cover ? "aspect-[3/2] w-full rounded-2xl object-cover" : "h-auto w-full rounded-2xl"} />;
}

export function BlogCards({ posts }: { posts: BlogCardData[] }) {
  const { t, language } = useLanguage();
  return <div className="grid min-w-0 gap-6 md:grid-cols-2 xl:grid-cols-3">{posts.map((post) => <article lang={post.language} key={post.id} className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    {post.photos[0] && <BlogImage key={`${post.photos[0].id}-${post.photos[0].updatedAt}`} photo={post.photos[0]} cover />}
    <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500"><span>{post.language.toUpperCase()}</span>{post.publishedAt && <time dateTime={post.publishedAt}>{localizedDate(language, { dateStyle: "medium", timeZone: "Asia/Phnom_Penh" }).format(new Date(post.publishedAt))}</time>}</div>
    <h2 className="mt-3 break-words text-xl font-bold"><Link href={`/blog/${post.id}`}>{post.title}</Link></h2>
    <p className="mt-3 whitespace-pre-wrap break-words leading-7 text-slate-600">{post.excerpt}</p>
    <Link href={`/blog/${post.id}`} className="mt-4 inline-flex min-h-11 items-center font-semibold text-[var(--color-primary)]">{t("blog.read")}</Link>
  </article>)}</div>;
}

export function BlogIndex({ posts, page }: { posts: BlogCardData[]; page: number }) {
  const { t } = useLanguage();
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
    <h1 className="break-words text-3xl font-black sm:text-4xl">{t("blog.title")}</h1>
    <p className="mb-8 mt-4 max-w-2xl leading-7 text-slate-600">{t("blog.intro")}</p>
    {posts.length ? <BlogCards posts={posts} /> : <p role="status" className="rounded-2xl bg-white p-6">{t("blog.empty")}</p>}
    <nav aria-label={t("blog.pages")} className="mt-8 flex flex-wrap gap-4">
      {page > 1 && <Link className="inline-flex min-h-11 items-center rounded-xl border bg-white px-4" href={`/blog?page=${page - 1}`}>{t("blog.previous")}</Link>}
      {posts.length === 12 && <Link className="inline-flex min-h-11 items-center rounded-xl border bg-white px-4" href={`/blog?page=${page + 1}`}>{t("blog.next")}</Link>}
    </nav>
  </div>;
}

export function BlogArticle({ post }: { post: PublicBlogPost }) {
  const { t, language } = useLanguage();
  return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    <Link href="/blog" className="inline-flex min-h-11 items-center font-semibold text-[var(--color-primary)]">{t("blog.back")}</Link>
    <article lang={post.language} className="mt-4 min-w-0 rounded-3xl bg-white p-5 shadow-sm sm:p-8">
      <p className="text-sm text-slate-500">{post.language.toUpperCase()}{post.publishedAt && <> · <time dateTime={post.publishedAt}>{localizedDate(language, { dateStyle: "long", timeZone: "Asia/Phnom_Penh" }).format(new Date(post.publishedAt))}</time></>}</p>
      <h1 className="mt-4 break-words text-3xl font-black sm:text-4xl">{post.title}</h1>
      <p className="mt-5 whitespace-pre-wrap break-words text-lg leading-8 text-slate-600">{post.excerpt}</p>
      <div className="mt-8 whitespace-pre-wrap break-words leading-8">{post.content}</div>
      {!!post.photos.length && <div className="mt-8 grid min-w-0 gap-6">{post.photos.map((photo) => <figure key={`${photo.id}-${photo.updatedAt}`} className="min-w-0"><BlogImage photo={photo} /><figcaption className="mt-2 break-words text-sm text-slate-600">{photo.caption}</figcaption></figure>)}</div>}
    </article>
    <Link href="/booking" className="mt-8 inline-flex min-h-11 max-w-full items-center rounded-xl bg-[var(--color-primary)] px-5 py-3 font-semibold text-white">{t("nav.bookNow")}</Link>
  </div>;
}

export function FeaturedBlog({ posts, error = false }: { posts: BlogCardData[]; error?: boolean }) {
  const { t } = useLanguage();
  if (!posts.length && !error) return null;
  return <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" aria-labelledby="featured-blog-title">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><h2 id="featured-blog-title" className="text-3xl font-bold">{t("blog.featuredTitle")}</h2><Link href="/blog" className="inline-flex min-h-11 items-center font-semibold text-[var(--color-primary)]">{t("blog.all")}</Link></div>
    {error ? <p role="alert">{t("blog.unavailable")}</p> : <BlogCards posts={posts} />}
  </section>;
}
