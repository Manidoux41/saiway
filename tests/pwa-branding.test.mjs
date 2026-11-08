import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { appleStartupImages } from "../lib/pwa-assets.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root));
test("installed app icons use the header mark with maskable padding and raster mobile formats", async () => {
  const manifest = JSON.parse(await read("public/manifest.webmanifest"));
  assert.equal(manifest.name, "SAIWAY - Siem Reap Airport Transfers");
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable" && icon.sizes === "512x512"));
  const mark = await read("public/icons/saiway-mark.svg");
  assert.match((await read("components/branding/logo.tsx")).toString(), /src="\/icons\/saiway-mark\.svg"/);
  const logo = await sharp(mark).resize(384, 384).toBuffer();
  const expected = await sharp({ create: { width: 512, height: 512, channels: 4, background: "#032ea1" } })
    .composite([{ input: logo, left: 64, top: 64 }]).png().toBuffer();
  const actual = await sharp(await read("public/icons/icon-512.png")).ensureAlpha().raw().toBuffer();
  const comparison = await sharp(expected).ensureAlpha().raw().toBuffer();
  // SVG rendered at final resolution can differ from resampling its 40 px source.
  let difference = 0;
  for (let index = 0; index < actual.length; index++) difference += Math.abs(actual[index] - comparison[index]);
  assert.ok(difference / actual.length < 2, "Installed icon must reproduce the shared logo");
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    if (Math.hypot(x - 256, y - 256) <= 512 * 0.4) continue;
    const pixel = (y * 512 + x) * 4;
    assert.ok([3, 46, 161].every((value, channel) => Math.abs(actual[pixel + channel] - value) <= 2), "Logo detail must stay within the maskable safe circle");
    assert.equal(actual[pixel + 3], 255);
  }
  for (const icon of manifest.icons) {
    assert.equal(icon.type, "image/png");
    const metadata = await sharp(await read(`public${icon.src}`)).metadata();
    assert.equal(`${metadata.width}x${metadata.height}`, icon.sizes);
  }
  const apple = await sharp(await read("public/icons/apple-touch-icon.png")).metadata();
  assert.equal(apple.width, 180); assert.equal(apple.height, 180);
  assert.equal(apple.hasAlpha, false);
});

test("favicon contains valid 16, 32 and 48 px PNG logo frames", async () => {
  const ico = await read("app/favicon.ico");
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  for (let index = 0; index < 3; index++) {
    const entry = 6 + index * 16;
    const size = [16, 32, 48][index];
    assert.equal(ico[entry], size); assert.equal(ico[entry + 1], size);
    const length = ico.readUInt32LE(entry + 8), offset = ico.readUInt32LE(entry + 12);
    assert.ok(offset + length <= ico.length);
    const png = ico.subarray(offset, offset + length);
    const metadata = await sharp(png).metadata();
    assert.equal(metadata.width, size); assert.equal(metadata.height, size);
    const expected = await sharp(await read("public/icons/saiway-mark.svg")).resize(size, size).ensureAlpha().raw().toBuffer();
    assert.deepEqual(await sharp(png).ensureAlpha().raw().toBuffer(), expected);
  }
});

test("Apple launch screens have matching device dimensions and centered SAIWAY branding", async () => {
  const urls = new Set();
  for (const image of appleStartupImages) {
    assert.ok(!urls.has(image.url), "No duplicate screen URLs"); urls.add(image.url);
    const dimensions = /saiway-(\d+)x(\d+)\.png$/.exec(image.url);
    const { data, info } = await sharp(await read(`public${image.url}`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, Number(dimensions[1])); assert.equal(info.height, Number(dimensions[2]));
    assert.match(image.media, /orientation: (portrait|landscape)/);
    assert.deepEqual([...data.subarray(0, 3)], [243, 246, 252]);
    const scale = Number(/pixel-ratio: (\d+)/.exec(image.media)[1]);
    const logoX = Math.round((info.width - 180 * scale) / 2);
    const logoY = Math.round((info.height - 48 * scale) / 2);
    const point = ((logoY + 20 * scale) * info.width + logoX + 8 * scale) * 3;
    assert.deepEqual([...data.subarray(point, point + 3)], [3, 46, 161], "Splash uses the blue header mark");
  }
  const layout = (await read("app/layout.tsx")).toString();
  assert.match(layout, /startupImage: appleStartupImages/);
  assert.match(layout, /apple-touch-icon\.png/);
  assert.match(layout, /capable: true/);
  assert.match(layout, /"apple-mobile-web-app-capable": "yes"/);
});
