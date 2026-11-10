"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { useLanguage } from "@/components/i18n/language-provider";
import { blogInputSchema, blogPostSchema, type AdminBlogPost, type BlogInput } from "@/lib/blog-client";
import { BlogImage } from "@/components/blog/blog-public";
import { prepareBlogImage } from "@/lib/blog-image-client";

const listing = z.object({ posts: z.array(blogPostSchema), trips: z.array(z.object({ id: z.string(), reference: z.string() })) });
type Mutate = (path: string, method: string, data?: BlogInput | { expectedUpdatedAt: string; photoIds?: string[] } | { caption: string } | FormData) => Promise<AdminBlogPost | null>;
const fieldClass = "w-full min-w-0 rounded-xl border bg-white p-3";
const buttonBaseClass = "inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold";
const buttonClass = `${buttonBaseClass} bg-white text-[var(--color-primary)]`;
const saveButtonClass = `${buttonBaseClass} bg-[var(--color-primary)] text-white`;

function BlogEditor({ post, pending, trips, mutate, uploadPhotos, close }: { post: AdminBlogPost | null; pending: boolean; trips: { id: string; reference: string }[]; mutate: Mutate; uploadPhotos: (postId: string, files: File[], photoId?: string) => Promise<void>; close: () => void }) {
  const { t, language } = useLanguage();
  const [invalid, setInvalid] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();
  function readInput(form: HTMLFormElement, draft = false) {
    const values = new FormData(form);
    const input = blogInputSchema.safeParse({
      title: values.get("title"), excerpt: values.get("excerpt"), content: values.get("content"),
      language: values.get("language"), published: !draft && values.get("published") === "on", featured: values.get("featured") === "on",
      bookingId: values.get("bookingId") || null,
      layout: values.get("layout"), coverPhotoId: values.get("coverPhotoId") || null,
    });
    setInvalid(input.success ? [] : input.error.issues.map((issue) => String(issue.path[0])));
    return input.success ? input.data : null;
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = readInput(event.currentTarget);
    if (!input) return;
    void mutate(post ? `/api/admin/blog/${post.id}` : "/api/admin/blog", post ? "PATCH" : "POST", post ? { ...input, expectedUpdatedAt: post.updatedAt } : input);
  }
  async function upload(files: File[], photoId?: string) {
    if (!files.length || pending) return;
    let target = post;
    if (!target && formRef.current) {
      const input = readInput(formRef.current, true);
      if (!input) return;
      target = await mutate("/api/admin/blog", "POST", input);
    }
    if (target) await uploadPhotos(target.id, files, photoId);
  }
  function movePhoto(index: number, direction: number) {
    if (!post) return;
    const photoIds = post.photos.map((photo) => photo.id);
    const target = index + direction;
    [photoIds[index], photoIds[target]] = [photoIds[target], photoIds[index]];
    void mutate(`/api/admin/blog/${post.id}/photos/order`, "PATCH", { expectedUpdatedAt: post.updatedAt, photoIds });
  }
  return <section className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{t(post ? "blog.edit" : "blog.new")}</h2><div className="flex flex-wrap gap-3"><button type="submit" form={formId} className={saveButtonClass} disabled={pending}>{t(pending ? "admin.saving" : "courses.save")}</button><button type="button" className={buttonClass} onClick={close} disabled={pending}>{t("blog.close")}</button></div></header>
    <p className="mt-4 text-sm leading-6 text-slate-600">{t("blog.privacy")}</p>
    {!!invalid.length && <p role="alert" className="mt-3 text-red-700">{t("blog.requiredFields")}: {invalid.map((field) => t(field === "title" ? "blog.postTitle" : field === "excerpt" ? "blog.excerpt" : field === "content" ? "blog.content" : "blog.failure")).join(", ")}</p>}
    <p className="mt-3 text-sm text-slate-600">{t("blog.draftHelp")}</p>
    <form id={formId} ref={formRef} onSubmit={submit} className="mt-5"><fieldset disabled={pending} className="grid min-w-0 gap-4">
      <label className="grid min-w-0 gap-2 text-sm">{t("blog.postTitle")}<input name="title" required maxLength={200} defaultValue={post?.title ?? ""} className={fieldClass} /></label>
      <label className="grid min-w-0 gap-2 text-sm">{t("blog.excerpt")}<textarea name="excerpt" maxLength={600} rows={3} defaultValue={post?.excerpt ?? ""} className={fieldClass} /></label>
      <label className="grid min-w-0 gap-2 text-sm">{t("blog.content")}<textarea name="content" maxLength={100000} rows={14} defaultValue={post?.content ?? ""} className={fieldClass} /></label>
      <label className="grid min-w-0 gap-2 text-sm">{t("blog.language")}<select name="language" defaultValue={post?.language ?? language} className={fieldClass}><option value="fr">Français</option><option value="en">English</option><option value="km">ខ្មែរ</option></select></label>
      <label className="grid min-w-0 gap-2 text-sm">{t("blog.trip")}<select name="bookingId" defaultValue={post?.bookingId ?? ""} className={fieldClass}><option value="">{t("blog.noTrip")}</option>{trips.map((trip) => <option value={trip.id} key={trip.id}>{trip.reference}</option>)}</select></label>
      <label className="grid min-w-0 gap-2 text-sm">{t("blog.layout")}<select name="layout" defaultValue={post?.layout ?? "STACKED"} className={fieldClass}>{(["STACKED", "GRID", "ALTERNATING"] as const).map((layout) => <option key={layout} value={layout}>{t(`blog.${layout}`)}</option>)}</select></label>
      <label className="grid min-w-0 gap-2 text-sm">{t("blog.headerPhoto")}<select name="coverPhotoId" defaultValue={post?.coverPhotoId ?? ""} className={fieldClass}><option value="">{t("blog.noHeader")}</option>{post?.photos.map((photo, index) => <option value={photo.id} key={photo.id}>{index + 1} · {photo.caption}</option>)}</select></label>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="published" defaultChecked={post?.published ?? false} />{t("blog.publish")}</label>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="featured" defaultChecked={post?.featured ?? false} />{t("blog.featured")}</label>
      <button type="submit" className={saveButtonClass}>{t(pending ? "admin.saving" : "courses.save")}</button>
    </fieldset></form>
    {post?.published && <Link className={`${buttonClass} mt-4`} href={`/blog/${post.id}`} target="_blank">{t("blog.view")}</Link>}
    <h3 className="mt-8 text-lg font-bold">{t("blog.photos")}</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">{t("blog.photoHelp")}</p>
    <fieldset disabled={pending} className="mt-4 min-w-0">
      <label className="grid min-w-0 gap-2 text-sm">{t("blog.upload")}<input type="file" multiple accept="image/jpeg,image/png,image/webp" className={fieldClass} onChange={(event) => { void upload(Array.from(event.target.files ?? [])); event.target.value = ""; }} /></label>
      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">{post?.photos.map((photo, index) => <div key={photo.id} className="min-w-0 rounded-2xl border p-3">
        <p className="mb-3 text-sm font-bold">{index + 1}{post.coverPhotoId === photo.id ? ` · ${t("blog.headerPhoto")}` : ""}</p>
        <BlogImage key={`${photo.id}-${photo.updatedAt}`} photo={photo} admin cover />
        <form className="mt-3 grid min-w-0 gap-3" onSubmit={(event) => { event.preventDefault(); void mutate(`/api/admin/blog/${post.id}/photos/${photo.id}`, "PATCH", { caption: String(new FormData(event.currentTarget).get("caption")) }); }}>
          <label className="grid min-w-0 gap-2 text-sm">{t("blog.caption")}<input name="caption" required maxLength={500} defaultValue={photo.caption} className={fieldClass} /></label>
          <button type="submit" className={buttonClass}>{t("blog.saveCaption")}</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={pending || index === 0} onClick={() => movePhoto(index, -1)}>{t("blog.moveUp")}</button><button type="button" className={buttonClass} disabled={pending || index === post.photos.length - 1} onClick={() => movePhoto(index, 1)}>{t("blog.moveDown")}</button></div>
        <label className="mt-4 grid min-w-0 gap-2 text-sm">{t("blog.replace")}<input type="file" accept="image/jpeg,image/png,image/webp" className={fieldClass} onChange={(event) => { void upload(Array.from(event.target.files ?? []), photo.id); event.target.value = ""; }} /></label>
        <button type="button" className={`${buttonClass} mt-3 text-red-700`} onClick={() => { if (window.confirm(t("blog.confirmPhoto"))) void mutate(`/api/admin/blog/${post.id}/photos/${photo.id}`, "DELETE"); }}>{t("blog.removePhoto")}</button>
      </div>)}</div>
    </fieldset>
  </section>;
}

export function BlogPanel() {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<AdminBlogPost[]>([]);
  const [trips, setTrips] = useState<{ id: string; reference: string }[]>([]);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<AdminBlogPost | "new" | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/admin/blog?page=${page}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
        if (!response.ok) throw new Error("Blog listing unavailable");
        const data = listing.parse(await response.json());
        if (!controller.signal.aborted) { setPosts(data.posts); setTrips(data.trips); }
      } catch {
        if (!controller.signal.aborted) setError(t("blog.unavailable"));
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [page, revision, t]);

  const mutate: Mutate = async (path, method, data) => {
    if (lock.current) return null;
    lock.current = true; setPending(true); setError(""); setSaved(false);
    try {
      const response = await fetch(path, { method, signal: AbortSignal.timeout(60000), ...(data instanceof FormData ? { body: data } : data ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {}) });
      if (!response.ok) {
        setError(t(response.status === 409 ? "blog.conflict" : [413, 415].includes(response.status) ? "blog.invalidImage" : response.status === 403 ? "admin.sessionExpired" : "blog.failure"));
        return null;
      }
      let updated: AdminBlogPost | null = null;
      if (path === "/api/admin/blog" || method !== "DELETE" || path.includes("/photos/")) {
        updated = blogPostSchema.parse((await response.json()).post);
        setSelected(updated);
      }
      else setSelected(null);
      setSaved(true); setLoading(true); setRevision((value) => value + 1);
      return updated;
    } catch { setError(t("blog.failure")); return null; }
    finally { lock.current = false; setPending(false); }
  };
  async function uploadPhotos(postId: string, files: File[], photoId?: string) {
    if (uploading) return;
    setUploading(true); setError(""); setSaved(false);
    try {
      for (const [index, file] of files.entries()) {
        setUploadProgress(`${index + 1} / ${files.length}`);
        const prepared = await prepareBlogImage(file);
        const data = new FormData();
        data.set("file", prepared);
        if (!await mutate(`/api/admin/blog/${postId}/photos${photoId ? `/${photoId}` : ""}`, photoId ? "PUT" : "POST", data)) break;
      }
    } catch { setError(t("blog.invalidImage")); setSaved(false); }
    finally { setUploading(false); setUploadProgress(""); }
  }
  return <section className="min-w-0 space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{t("blog.admin")}</h1><div className="flex flex-wrap gap-3"><button type="button" disabled={pending || uploading || loading} className={buttonClass} onClick={() => { setSelected("new"); setSaved(false); }}>{t("blog.new")}</button><button type="button" disabled={pending || uploading || loading} className={buttonClass} onClick={() => { setError(""); setLoading(true); setRevision((value) => value + 1); }}>{t("admin.retry")}</button></div></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {saved && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{t("blog.saved")}</p>}
    {uploading && <p role="status">{t("blog.uploading")} {uploadProgress}</p>}
    {selected && <BlogEditor key={selected === "new" ? "new" : selected.id} post={selected === "new" ? null : selected} pending={pending || uploading} trips={trips} mutate={mutate} uploadPhotos={uploadPhotos} close={() => setSelected(null)} />}
    {loading && <p role="status">{t("admin.loading")}</p>}
    {!loading && !posts.length && !error && <p>{t("blog.empty")}</p>}
    <div className="grid min-w-0 gap-4">{posts.map((post) => <article key={post.id} className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-4">
      <div className="min-w-0 flex-1"><h2 className="break-words font-bold">{post.title}</h2><p className="mt-2 text-sm text-slate-600">{t(post.published ? "blog.published" : "blog.draft")} · {post.language.toUpperCase()}{post.featured ? ` · ${t("blog.featured")}` : ""}</p>{post.booking && <p className="mt-2 break-words text-xs text-slate-500">{post.booking.reference}</p>}</div>
      <div className="flex flex-wrap gap-3"><button type="button" className={buttonClass} disabled={pending || uploading} onClick={() => { setSelected(post); setSaved(false); }}>{t("blog.edit")}</button><button type="button" className={`${buttonClass} text-red-700`} disabled={pending || uploading} onClick={() => { if (window.confirm(t("blog.confirmDelete"))) void mutate(`/api/admin/blog/${post.id}`, "DELETE", { expectedUpdatedAt: post.updatedAt }); }}>{t("blog.delete")}</button></div>
    </article>)}</div>
    <nav aria-label={t("blog.pages")} className="flex flex-wrap gap-3">
      <button type="button" className={buttonClass} disabled={pending || uploading || loading || page === 1} onClick={() => { setLoading(true); setPage((value) => value - 1); }}>{t("blog.previous")}</button>
      <button type="button" className={buttonClass} disabled={pending || uploading || loading || posts.length < 20} onClick={() => { setLoading(true); setPage((value) => value + 1); }}>{t("blog.next")}</button>
    </nav>
  </section>;
}
