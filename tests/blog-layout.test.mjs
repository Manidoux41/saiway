import test from 'node:test';
import sharp from 'sharp';
import { assert, base, request, setup, createAccount } from './helpers.mjs';

test('title-only drafts accept photos, ordered layouts and a selected header while protecting publication and ownership', async () => {
  const ctx = await setup();
  const ids = [];
  try {
    const driver = await createAccount(ctx, 'DRIVER');
    const input = { title: `${ctx.prefix} draft`, excerpt: '', content: '', language: 'fr', published: false, featured: false, bookingId: null };
    const created = await request('/api/admin/blog', 'POST', input, ctx.cookie);
    assert.equal(created.status, 201);
    let post = created.data.post;
    ids.push(post.id);
    assert.equal(post.layout, 'STACKED');
    assert.equal((await request(`/api/admin/blog/${post.id}`, 'PATCH', { ...input, published: true, expectedUpdatedAt: post.updatedAt }, ctx.cookie)).status, 400);
    assert.equal((await fetch(`${base}/blog/${post.id}`)).status, 404);
    const other = (await request('/api/admin/blog', 'POST', { ...input, title: `${ctx.prefix} other` }, ctx.cookie)).data.post;
    ids.push(other.id);
    const png = await sharp({ create: { width: 30, height: 20, channels: 3, background: 'blue' } }).png().toBuffer();
    for (let i = 0; i < 3; i++) {
      const body = new FormData();
      body.set('file', new Blob([png], { type: 'image/png' }), `photo-${i}.png`);
      const uploaded = await fetch(`${base}/api/admin/blog/${post.id}/photos`, { method: 'POST', body, headers: { Cookie: ctx.cookie } });
      assert.equal(uploaded.status, 201);
      post = (await uploaded.json()).post;
    }
    const originalIds = post.photos.map(photo => photo.id);
    const reverse = originalIds.toReversed();
    const order = (photoIds, cookie = ctx.cookie, expectedUpdatedAt = post.updatedAt) => request(`/api/admin/blog/${post.id}/photos/order`, 'PATCH', { photoIds, expectedUpdatedAt }, cookie);
    assert.equal((await order(reverse, driver.cookie)).status, 403);
    assert.equal((await order([originalIds[0], originalIds[0], originalIds[2]])).status, 400);
    assert.equal((await order(originalIds.slice(1))).status, 400);
    assert.equal((await order([...originalIds, 'other-photo'])).status, 400);
    post = (await order(reverse)).data.post;
    assert.deepEqual(post.photos.map(photo => photo.id), reverse);
    assert.equal((await order(originalIds, ctx.cookie, created.data.post.updatedAt)).status, 409);
    const publish = { ...input, excerpt: 'A practical introduction', content: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n\nLast paragraph.', published: true, featured: true, coverPhotoId: originalIds[1] };
    assert.equal((await request(`/api/admin/blog/${other.id}`, 'PATCH', { ...publish, expectedUpdatedAt: other.updatedAt }, ctx.cookie)).status, 400);
    for (const layout of ['STACKED', 'GRID', 'ALTERNATING']) {
      const updated = await request(`/api/admin/blog/${post.id}`, 'PATCH', { ...publish, layout, expectedUpdatedAt: post.updatedAt }, ctx.cookie);
      assert.equal(updated.status, 200);
      post = updated.data.post;
      const html = await (await fetch(`${base}/blog/${post.id}`)).text();
      assert.ok(html.includes(`data-blog-layout="${layout}"`));
      for (const paragraph of ['First paragraph.', 'Second paragraph.', 'Third paragraph.', 'Last paragraph.']) assert.ok(html.includes(paragraph));
      const imageIds = [...html.matchAll(/<img[^>]+src="[^"]*\/api\/blog\/photos\/([^?"]+)/g)].map(match => match[1]);
      assert.deepEqual(imageIds, [originalIds[1], originalIds[2], originalIds[0]], 'Header appears once, then the remaining gallery follows the chosen order');
    }
    const deleted = await request(`/api/admin/blog/${post.id}/photos/${originalIds[1]}`, 'DELETE', undefined, ctx.cookie);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.data.post.coverPhotoId, null);
    assert.deepEqual(deleted.data.post.photos.map(photo => photo.id), [originalIds[2], originalIds[0]]);
  } finally {
    await ctx.prisma.blogPost.deleteMany({ where: { id: { in: ids } } });
    await ctx.cleanup();
  }
});
