import "server-only";
import { siteConfig } from "@/lib/site";

export function drawPdfBrand(doc: PDFKit.PDFDocument, x: number, y: number) {
  const size = 25;
  doc.save();
  doc.roundedRect(x, y, size, size, 7).fill("#032ea1");
  doc.lineWidth(1.7).circle(x + 12.5, y + 12.5, 4.3).stroke("#ffffff");
  doc.lineWidth(1.1).circle(x + 9.5, y + 8.3, 2.8).fillAndStroke("#e00025", "#ffffff");
  doc.circle(x + 16, y + 16, 2.2).fill("#ffffff");
  doc.font("latinBold").fontSize(12).fillColor("#021f73").text(siteConfig.name, x + 32, y + 1, { lineBreak: false });
  doc.font("latin").fontSize(7).fillColor("#475569").text(siteConfig.tagline, x + 32, y + 16, { lineBreak: false });
  doc.restore();
}
