import "server-only";
import path from "node:path";
import PDFDocument from "pdfkit";
import { authorize } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { advertisingFailure, advertisingSelect } from "@/lib/advertising";
import { readEmployer } from "@/lib/employer";
import { drawPdfBrand } from "@/lib/pdf-brand";
import { scriptRuns } from "@/lib/contract-pdf";
import { advertisingCopy } from "@/components/i18n/advertising-copy";

export async function advertisingPdf(request: Request, id: string) {
  try {
    if (!await authorize(request, "ADMIN")) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const contract = await prisma.advertisingContract.findFirst({ where: { id, deletedAt: null }, select: advertisingSelect });
    if (!contract) return Response.json({ error: "Contract not found" }, { status: 404 });
    const employer = await readEmployer();
    const locale = new URL(request.url).searchParams.get("language");
    const language = locale === "fr" || locale === "km" ? locale : "en";
    const copy = advertisingCopy[language];
    const dir = path.join(process.cwd(), "assets/fonts");
    const doc = new PDFDocument({ size: "A4", margins: { top: 95, bottom: 60, left: 48, right: 48 }, bufferPages: true, font: path.join(dir, "NotoSans-Regular.ttf"), info: { Title: `${copy["ads.document"]} ${contract.reference}`, Author: employer.name || "SAIWAY" } });
    for (const [font, file] of Object.entries({ latin: "NotoSans-Regular.ttf", latinBold: "NotoSans-Bold.ttf", khmer: "Battambang-Regular.ttf", khmerBold: "Battambang-Bold.ttf" })) doc.registerFont(font, path.join(dir, file));
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const output = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
    function write(value: string, bold = false) {
      const runs = scriptRuns(value);
      runs.forEach((run, index) => doc.font(run.khmer ? bold ? "khmerBold" : "khmer" : bold ? "latinBold" : "latin").fontSize(bold ? 12 : 10).fillColor("#101b3d").text(run.text, { continued: index < runs.length - 1 }));
      doc.moveDown(.6);
    }
    const date = (value: Date) => new Intl.DateTimeFormat(language, { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Phnom_Penh" }).format(value);
    write(copy["ads.document"], true);
    write(contract.reference, true);
    write(copy["ads.documentNotice"]);
    write(`${copy["ads.employer"]}: ${employer.name || "SAIWAY"}`);
    for (const value of [employer.registrationNo, employer.address, employer.representative, employer.representativeTitle]) if (value) write(value);
    write(`${copy["ads.advertiser"]}: ${contract.advertiser}`, true);
    write(`${copy["ads.contactName"]}: ${contract.contactName}`);
    if (contract.contactEmail) write(`${copy["ads.email"]}: ${contract.contactEmail}`);
    if (contract.contactPhone) write(`${copy["ads.phone"]}: ${contract.contactPhone}`);
    write(`${copy["ads.dates"]}: ${date(contract.startsAt)} — ${date(contract.endsAt)} (Asia/Phnom_Penh)`);
    write(`${copy["ads.amount"]}: ${(contract.amountCents / 100).toFixed(2)}`);
    write(copy[`ads.${contract.status}`], true);
    write(`${copy["ads.placements"]}: ${contract.placements.map((placement) => copy[`ads.${placement}`]).join(", ")}`);
    write(`${copy["ads.headline"]}: ${contract.title}`);
    write(contract.description);
    write(`${copy["ads.link"]}: ${contract.targetUrl}`);
    write(copy["ads.notice"]);
    if (contract.terms) { write(copy["ads.terms"], true); write(contract.terms); }
    write(`${copy["ads.signatures"]}\n\n____________________________\n\n____________________________`);
    const pages = doc.bufferedPageRange();
    for (let index = 0; index < pages.count; index++) {
      doc.switchToPage(index);
      drawPdfBrand(doc, 48, 30);
      doc.font("latin").fontSize(8).fillColor("#64748b").text(`${contract.reference} | ${index + 1} / ${pages.count}`, 48, doc.page.height - 40, { lineBreak: false });
    }
    doc.end();
    return new Response(new Uint8Array(await output), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="SAIWAY-${contract.reference}.pdf"`, "Cache-Control": "no-store" } });
  } catch (error) { return advertisingFailure(error); }
}
