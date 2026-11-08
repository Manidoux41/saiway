import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { appleStartupImages } from "../lib/pwa-assets.mjs";

const root = new URL("../", import.meta.url);
const mark = await readFile(new URL("public/icons/saiway-mark.svg", root), "utf8");
const innerMark = mark.replace(/<svg[^>]*>/, "").replace("</svg>", "");
await mkdir(new URL("public/splash/", root), { recursive: true });

for (const size of [192, 512]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" fill="#032ea1"/><g transform="translate(64 64) scale(9.6)">${innerMark}</g></svg>`;
  await writeFile(new URL(`public/icons/icon-${size}.svg`, root), svg);
  await sharp(Buffer.from(svg)).png().toFile(new URL(`public/icons/icon-${size}.png`, root).pathname);
}
await sharp(Buffer.from(mark)).resize(180, 180).flatten({ background: "#032ea1" }).png().toFile(new URL("public/icons/apple-touch-icon.png", root).pathname);
await sharp(Buffer.from(mark)).resize(32, 32).png().toFile(new URL("public/icons/favicon-32.png", root).pathname);

const faviconImages = await Promise.all([16, 32, 48].map((size) => sharp(Buffer.from(mark)).resize(size, size).png().toBuffer()));
const icoHeader = Buffer.alloc(6 + 16 * faviconImages.length);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(faviconImages.length, 4);
let offset = icoHeader.length;
faviconImages.forEach((image, index) => {
  const entry = 6 + index * 16;
  icoHeader[entry] = [16, 32, 48][index];
  icoHeader[entry + 1] = [16, 32, 48][index];
  icoHeader.writeUInt16LE(1, entry + 4);
  icoHeader.writeUInt16LE(32, entry + 6);
  icoHeader.writeUInt32LE(image.length, entry + 8);
  icoHeader.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(new URL("app/favicon.ico", root), Buffer.concat([icoHeader, ...faviconImages]));

for (const image of appleStartupImages) {
  const match = /saiway-(\d+)x(\d+)\.png$/.exec(image.url);
  if (!match) throw new Error(`Invalid splash asset name: ${image.url}`);
  const [, widthText, heightText] = match;
  const width = Number(widthText), height = Number(heightText);
  const scale = Number(/pixel-ratio: (\d+)/.exec(image.media)?.[1]);
  const logoWidth = 180 * scale, logoHeight = 48 * scale;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f3f6fc"/><g transform="translate(${(width - logoWidth) / 2} ${(height - logoHeight) / 2}) scale(${scale})"><g transform="translate(0 4)">${innerMark}</g><text x="52" y="31" font-family="Arial, sans-serif" font-size="22" font-weight="900" letter-spacing="4" fill="#021f73">SAIWAY</text></g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(new URL(`public${image.url}`, root).pathname);
}
console.log(`Generated SAIWAY favicon, mobile icons and ${appleStartupImages.length} launch screens.`);
