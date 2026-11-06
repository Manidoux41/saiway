import "server-only";
import path from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import sharp from "sharp";
import { angkorWatPaths } from "@/lib/business-card-art";
import { scriptRuns } from "@/lib/contract-pdf";
import { driverCopy } from "@/components/i18n/driver-copy";
import type { ContactQrChannel } from "@/lib/driver-contact-qr-client";
import { contactBrandArt, type ContactBrand } from "@/lib/contact-brand-art";

const mm = (value: number) => value * 72 / 25.4;
const cardWidth = mm(85);
const cardHeight = mm(55);
type Image = { data: Uint8Array };
export type BusinessCardPdfDriver = {
  id: string;
  user: { name: string; phone: string | null };
  photo: Image | null;
  contactQrImages: (Image & { channel: ContactQrChannel })[];
};

export class BusinessCardImageError extends Error {
  constructor() { super("A stored card image is invalid or too large to render"); }
}

async function png(image: Image) {
  try {
    return await sharp(Buffer.from(image.data), { limitInputPixels: 25_000_000 })
      .rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  } catch (error) {
    console.error("Business card image conversion failed", { name: error instanceof Error ? error.name : "UNKNOWN" });
    throw new BusinessCardImageError();
  }
}

export async function renderBusinessCards(drivers: BusinessCardPdfDriver[], bookingUrl: string, language: "en" | "fr" | "km"): Promise<Buffer> {
  const copy = driverCopy[language];
  const doc = new PDFDocument({
    autoFirstPage: false, margin: 0, font: path.join(process.cwd(), "assets", "fonts", "NotoSans-Regular.ttf"),
    info: { Title: "SAIWAY business cards", Author: "SAIWAY", Creator: "SAIWAY" },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  for (const [name, file] of Object.entries({
    latin: "NotoSans-Regular.ttf", latinBold: "NotoSans-Bold.ttf",
    khmer: "Battambang-Regular.ttf", khmerBold: "Battambang-Bold.ttf",
  })) doc.registerFont(name, path.join(process.cwd(), "assets", "fonts", file));

  function text(value: string, x: number, y: number, width: number, size: number, color: string, bold = false, centered = false) {
    const runs = scriptRuns(value).map((run) => ({ text: run.text, font: run.khmer ? bold ? "khmerBold" : "khmer" : bold ? "latinBold" : "latin" }));
    doc.fontSize(size);
    const measured = () => runs.reduce((total, run) => total + doc.font(run.font).widthOfString(run.text), 0);
    while (measured() > width && size > 4) { size -= 0.25; doc.fontSize(size); }
    doc.fillColor(color);
    let cursor = x + (centered ? (width - measured()) / 2 : 0);
    for (const run of runs) {
      doc.font(run.font).text(run.text, cursor, y, { lineBreak: false });
      cursor += doc.widthOfString(run.text);
    }
  }

  function background() {
    doc.roundedRect(0, 0, cardWidth, cardHeight, mm(3)).fill("#f6f3ea");
    doc.save().translate(mm(23), mm(17)).scale(mm(62) / 320);
    doc.fillOpacity(0.32).circle(252, 54, 42).fill("#dfb56b");
    doc.fillOpacity(0.16);
    for (const d of angkorWatPaths) doc.path(d).fill("#032ea1");
    doc.strokeOpacity(0.5).path("M0 161 Q80 153 160 161 T320 161").lineWidth(3).stroke("#dfb56b");
    doc.restore();
    doc.rect(0, 0, cardWidth, mm(12)).fill("#ffffff");
    doc.rect(0, mm(11.5), cardWidth, mm(0.5)).fill("#dfb56b");
    doc.rect(0, mm(12), cardWidth, mm(5)).fill("#032ea1");
    text(copy["cards.business"], mm(3), mm(13), cardWidth - mm(6), 6.5, "#ffffff", false, true);
  }

  function logo() {
    doc.roundedRect(mm(3), mm(2.7), mm(6.5), mm(6.5), mm(1.8)).fill("#032ea1");
    doc.lineWidth(mm(0.5)).circle(mm(6.2), mm(6), mm(1.5)).stroke("#ffffff");
    doc.circle(mm(5.3), mm(4.6), mm(0.85)).fillAndStroke("#e00025", "#ffffff");
    doc.circle(mm(7.3), mm(7.3), mm(0.7)).fill("#ffffff");
    text("SAIWAY", mm(11), mm(3.1), mm(29), 12, "#021f73", true);
    text(copy["cards.tagline"], mm(43), mm(4.2), mm(39), 6.2, "#032ea1");
  }

  function contactLabel(brand: ContactBrand, left: number) {
    const art = contactBrandArt[brand];
    doc.save().translate(mm(left), mm(51.4)).scale(mm(2.5) / 24);
    doc.roundedRect(0, 0, 24, 24, brand === "SAIWAY" ? 6 : 12).fill(art.color);
    if (brand === "SAIWAY") {
      doc.path(art.path).lineWidth(2).stroke("#ffffff");
      doc.circle(8, 7, 3).lineWidth(1.5).fillAndStroke("#e00025", "#ffffff");
      doc.circle(17, 17, 2.5).fill("#ffffff");
    } else {
      if (brand === "TELEGRAM") doc.path(art.path).fill("#ffffff");
      else doc.path(art.path).lineWidth(1.5).stroke("#ffffff");
      if (art.phone) doc.path(art.phone).fill("#ffffff");
    }
    doc.restore();
    text(art.label, mm(left + 3), mm(51.6), mm(11), 4.8, "#4c5877");
  }

  const qr = QRCode.create(bookingUrl, { errorCorrectionLevel: "M" }).modules;
  function bookingQr(x: number, y: number, size: number) {
    doc.rect(x, y, size, size).fill("#ffffff");
    const unit = size / (qr.size + 8);
    doc.fillColor("#101b3d");
    for (let row = 0; row < qr.size; row += 1) {
      for (let col = 0; col < qr.size; col += 1) {
        if (qr.get(row, col)) doc.rect(x + (col + 4) * unit, y + (row + 4) * unit, unit, unit).fill();
      }
    }
  }

  const preparedImages = new Map<string, { photo: Buffer | null; contactImages: { channel: ContactQrChannel; data: Buffer }[] }>();
  try {
    for (const [index, driver] of drivers.entries()) {
      let images = preparedImages.get(driver.id);
      if (!images) {
        images = {
          photo: driver.photo ? await png(driver.photo) : null,
          contactImages: await Promise.all(driver.contactQrImages.map(async (image) => ({ channel: image.channel, data: await png(image) }))),
        };
        preparedImages.set(driver.id, images);
      }
      const { photo, contactImages } = images;
      if (index % 8 === 0) doc.addPage({ size: "A4", margin: 0 });
      const x = (doc.page.width - mm(175)) / 2 + index % 2 * mm(90);
      const y = mm(10) + Math.floor(index % 8 / 2) * mm(60);
      doc.save().translate(x, y);
      doc.roundedRect(0, 0, cardWidth, cardHeight, mm(3)).clip();
      background();
      logo();
      doc.save().circle(mm(16.5), mm(26), mm(7.5)).clip();
      if (photo) doc.image(photo, mm(9), mm(18.5), { cover: [mm(15), mm(15)], align: "center", valign: "center" });
      else {
        doc.rect(mm(9), mm(18.5), mm(15), mm(15)).fill("#eef2fb");
        const initials = driver.user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
        text(initials, mm(11.5), mm(22.5), mm(11), 14, "#032ea1");
      }
      doc.restore();
      doc.lineWidth(mm(0.4)).circle(mm(16.5), mm(26), mm(7.5)).stroke("#dfb56b");
      text(driver.user.name, mm(27), mm(18.5), mm(55), 8.8, "#101b3d", true);
      text(copy["cards.role"], mm(27), mm(22.5), mm(55), 5.7, "#4c5877");
      text(copy["cards.bookWith"].toUpperCase(), mm(27), mm(26), mm(55), 5.1, "#e00025");
      text(driver.user.phone ?? "", mm(27), mm(29.2), mm(55), 8.5, "#032ea1", true);
      const count = contactImages.length + 1;
      const start = (85 - (count * 14 + (count - 1) * 7)) / 2;
      doc.roundedRect(mm(start - 1), mm(36.7), mm(count * 14 + (count - 1) * 7 + 2), mm(17.5), mm(1.5)).fill("#ffffff");
      bookingQr(mm(start), mm(37), mm(14));
      contactLabel("SAIWAY", start);
      contactImages.forEach((image, qrIndex) => {
        const left = start + (qrIndex + 1) * 21;
        doc.image(image.data, mm(left), mm(37), { fit: [mm(14), mm(14)], align: "center", valign: "center" });
        contactLabel(image.channel, left);
      });
      doc.restore();
    }
    doc.end();
    return await complete;
  } catch (error) {
    doc.destroy();
    throw error;
  }
}
