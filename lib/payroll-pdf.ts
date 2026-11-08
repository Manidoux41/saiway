import "server-only";
import path from "node:path";
import PDFDocument from "pdfkit";
import { drawPdfBrand } from "@/lib/pdf-brand";
import { scriptRuns } from "@/lib/contract-pdf";
import { payrollViewSchema } from "@/lib/payroll-client";
import { payrollCopy } from "@/components/i18n/payroll-copy";
import { authorize } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { payrollFailure } from "@/lib/payroll";

export async function payrollPdf(request: Request, id: string, role: "ADMIN" | "DRIVER") {
  try {
    const account = await authorize(request, role);
    if (!account) return Response.json({ error: "Payroll access required" }, { status: 403 });
    const stored = await prisma.payroll.findFirst({ where: { id, ...(role === "DRIVER" ? { driver: { userId: account.id }, status: { in: ["FINALIZED", "PAID"] } } : {}) } });
    if (!stored) return Response.json({ error: "Payroll not found" }, { status: 404 });
    const payroll = payrollViewSchema.parse(JSON.parse(JSON.stringify(stored)));
    const language = new URL(request.url).searchParams.get("language");
    const copy = payrollCopy[language === "fr" || language === "km" ? language : "en"];
    const doc = new PDFDocument({ size: "A4", margins: { top: 95, bottom: 60, left: 48, right: 48 }, bufferPages: true, font: path.join(process.cwd(), "assets/fonts/NotoSans-Regular.ttf"), info: { Title: `SAIWAY payroll ${payroll.month}`, Author: "SAIWAY" } });
    for (const [font, file] of Object.entries({ latin: "NotoSans-Regular.ttf", latinBold: "NotoSans-Bold.ttf", khmer: "Battambang-Regular.ttf", khmerBold: "Battambang-Bold.ttf" })) doc.registerFont(font, path.join(process.cwd(), "assets/fonts", file));
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const output = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
    function write(text: string, bold = false) {
      const runs = scriptRuns(text);
      for (let index = 0; index < runs.length; index++) {
        const run = runs[index];
        doc.font(run.khmer ? bold ? "khmerBold" : "khmer" : bold ? "latinBold" : "latin").fontSize(bold ? 12 : 10).fillColor("#101b3d").text(run.text, { continued: index < runs.length - 1 });
      }
      doc.moveDown(0.5);
    }
    const money = (cents: number) => `USD ${(cents / 100).toFixed(2)}`;
    write(copy["payroll.document"], true);
    write(`${payroll.snapshot.employeeName} — ${payroll.month}`, true);
    write(copy["payroll.help"]);
    write(`${copy["payroll.employer"]}: ${payroll.snapshot.employer.name || "SAIWAY"}`);
    if (payroll.snapshot.employer.registrationNo) write(payroll.snapshot.employer.registrationNo);
    if (payroll.snapshot.employer.address) write(payroll.snapshot.employer.address);
    write(copy[`payroll.${payroll.status}`]);
    write(`${copy["payroll.schedule"]}: ${new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : language === "km" ? "km-KH" : "en-GB", { dateStyle: "long", timeZone: "Asia/Phnom_Penh" }).format(new Date(payroll.scheduledPayAt))}`);
    if (payroll.paidAt) write(`${copy["payroll.payDate"]}: ${new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : language === "km" ? "km-KH" : "en-GB", { dateStyle: "long", timeZone: "Asia/Phnom_Penh" }).format(new Date(payroll.paidAt))}`);
    for (const contract of payroll.snapshot.contracts) write(`${contract.reference}: ${contract.employedDays} / ${new Date(Number(payroll.month.slice(0, 4)), Number(payroll.month.slice(5)), 0).getDate()} — ${money(contract.salaryCents)} → ${money(contract.proratedCents)}`);
    for (const [key, value] of [
      ["payroll.base", payroll.baseSalaryCents], ["payroll.revenue", payroll.eligibleRevenueCents], ["payroll.commission", payroll.commissionCents],
      ["payroll.bonus", payroll.bonusCents], ["payroll.deduction", payroll.deductionCents], ["payroll.net", payroll.netCents],
    ] as const) write(`${copy[key]}: ${money(value)}`, key === "payroll.net");
    if (payroll.adjustmentNotes) write(payroll.adjustmentNotes);
    write(`${copy["payroll.unpaid"]}: ${payroll.snapshot.unpaidTrips}`);
    write(`${copy["payroll.undated"]}: ${payroll.snapshot.undatedTrips}`);
    write(copy["payroll.sources"], true);
    for (const source of payroll.snapshot.sources) {
      write(`${source.reference}: ${money(source.amountCents)}`);
      if (source.payments.some((payment) => payment.historicalDate)) write(copy["payroll.legacy"]);
    }
    write(copy["payroll.manual"]);
    const pages = doc.bufferedPageRange();
    for (let page = 0; page < pages.count; page++) {
      doc.switchToPage(page);
      drawPdfBrand(doc, 48, 30);
      doc.font("latin").fontSize(8).fillColor("#64748b").text(`${page + 1} / ${pages.count}`, 48, doc.page.height - 40, { lineBreak: false });
    }
    doc.end();
    return new Response(new Uint8Array(await output), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="SAIWAY-payroll-${payroll.month}.pdf"`, "Cache-Control": "no-store" } });
  } catch (error) { return payrollFailure(error); }
}
