import "server-only";
import path from "node:path";
import PDFDocument from "pdfkit";

const fontDir = path.join(process.cwd(), "assets", "fonts");
const fontFiles = {
  latin: "NotoSans-Regular.ttf",
  latinBold: "NotoSans-Bold.ttf",
  khmer: "Battambang-Regular.ttf",
  khmerBold: "Battambang-Bold.ttf",
} as const;

type Value = string | null | undefined;
export type ContractPdfInput = {
  reference: string;
  status: "DRAFT" | "ACTIVE" | "TERMINATED";
  position: string;
  workplace: string;
  startsAt: Date;
  probationMonths: number;
  hoursPerWeek: number;
  monthlySalaryCents: number;
  currency: string;
  annualLeaveDays: number;
  additionalTerms: Value;
  terminatedAt: Date | null;
  employer: { name: Value; registrationNo: Value; address: Value; representative: Value; representativeTitle: Value };
  employee: { name: string; phone: Value; dateOfBirth: Date | null; nationality: Value; idDocumentNo: Value; address: Value; licenseNo: Value; licenseCategory: Value; licenseExpiresAt: Date | null };
  issuedAt: Date;
};

const khmerMonths = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
const khmerChar = /[\u1780-\u17FF\u19E0-\u19FF\u200B-\u200D]/;
const blank = "________________";

export const khmerDigits = (value: number | string) => String(value).replace(/\d/g, (digit) => String.fromCharCode(0x17e0 + Number(digit)));
const text = (value: Value) => value?.trim() || blank;
const dateEn = (value: Date | null) => value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(value) : blank;
const dateKm = (value: Date | null) => value ? `${khmerDigits(value.getUTCDate())} ${khmerMonths[value.getUTCMonth()]} ${khmerDigits(value.getUTCFullYear())}` : blank;
const money = (cents: number, currency: string) => `${currency} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)}`;

/** Splits text into Khmer and non-Khmer runs so each run uses a font that has its glyphs. */
export function scriptRuns(value: string) {
  const runs: Array<{ khmer: boolean; text: string }> = [];
  for (const character of value) {
    const khmer = khmerChar.test(character);
    const last = runs.at(-1);
    if (last && (character === " " || last.khmer === khmer)) last.text += character;
    else runs.push({ khmer, text: character });
  }
  return runs;
}

export function renderEmploymentContract(input: ContractPdfInput): Promise<Buffer> {
  const margin = 56;
  const doc = new PDFDocument({ size: "A4", margin, bufferPages: true, font: path.join(fontDir, fontFiles.latin), info: { Title: `Employment contract ${input.reference}`, Author: input.employer.name?.trim() || "SAIWAY", Subject: "Employment contract", Creator: "SAIWAY" } });
  for (const [name, file] of Object.entries(fontFiles)) doc.registerFont(name, path.join(fontDir, file));
  const width = doc.page.width - margin * 2;
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });

  function write(value: string, { bold = false, size = 10, align = "left", color = "#111827", after = 4 }: { bold?: boolean; size?: number; align?: "left" | "center" | "right"; color?: string; after?: number } = {}) {
    const runs = scriptRuns(value);
    if (!runs.length) return;
    if (align === "center" && runs.length > 1) {
      centered(value, margin, doc.y, width, { bold, size, color });
      doc.y += after;
      return;
    }
    doc.x = margin;
    doc.fillColor(color).fontSize(size);
    runs.forEach((run, index) => {
      doc.font(run.khmer ? bold ? "khmerBold" : "khmer" : bold ? "latinBold" : "latin");
      const options = { continued: index < runs.length - 1, align, lineGap: 1.5 };
      if (index === 0) doc.text(run.text, margin, doc.y, { ...options, width });
      else doc.text(run.text, options);
    });
    doc.y += after;
  }
  // pdfkit mis-positions centred text split across fonts with `continued`, so mixed-script lines are measured and placed run by run.
  function centered(value: string, x: number, y: number, boxWidth: number, { bold = false, size = 10, color = "#111827" } = {}) {
    const runs = scriptRuns(value).map((run) => ({ ...run, font: run.khmer ? bold ? "khmerBold" : "khmer" : bold ? "latinBold" : "latin" }));
    doc.fillColor(color).fontSize(size);
    const measured = runs.map((run) => ({ ...run, width: doc.font(run.font).widthOfString(run.text), height: doc.currentLineHeight(true) }));
    let cursor = x + Math.max(0, (boxWidth - measured.reduce((sum, run) => sum + run.width, 0)) / 2);
    const lineHeight = Math.max(...measured.map((run) => run.height));
    for (const run of measured) {
      doc.font(run.font).text(run.text, cursor, y + (lineHeight - run.height) / 2, { lineBreak: false });
      cursor += run.width;
    }
    doc.x = margin;
    doc.y = y + lineHeight + 1.5;
  }
  function ensureSpace(height: number) {
    if (doc.y + height > doc.page.height - margin - 20) doc.addPage();
  }
  function rule() {
    doc.moveTo(margin, doc.y).lineTo(margin + width, doc.y).lineWidth(0.6).strokeColor("#cbd5e1").stroke();
    doc.y += 10;
  }
  let article = 0;
  function section(en: string, km: string, bodyEn: string, bodyKm: string) {
    article += 1;
    ensureSpace(110);
    doc.y += 6;
    write(`Article ${article} – ${en}`, { bold: true, size: 11, after: 0 });
    write(`មាត្រា ${khmerDigits(article)} – ${km}`, { bold: true, size: 11, color: "#1e3a8a", after: 3 });
    write(bodyEn, { after: 3 });
    write(bodyKm, { color: "#1f2937", after: 6 });
  }

  const { employer, employee } = input;
  write("KINGDOM OF CAMBODIA", { bold: true, size: 12, align: "center", after: 0 });
  write("ព្រះរាជាណាចក្រកម្ពុជា", { bold: true, size: 13, align: "center", after: 0 });
  write("Nation  Religion  King", { size: 10, align: "center", after: 0 });
  write("ជាតិ  សាសនា  ព្រះមហាក្សត្រ", { size: 11, align: "center", after: 14 });
  write("EMPLOYMENT CONTRACT", { bold: true, size: 17, align: "center", after: 0 });
  write("កិច្ចសន្យាការងារ", { bold: true, size: 17, align: "center", color: "#1e3a8a", after: 2 });
  write("Contract of undetermined duration · កិច្ចសន្យាការងារមិនកំណត់ថិរវេលា", { size: 10, align: "center", color: "#475569", after: 2 });
  write(`Reference / លេខយោង: ${input.reference}`, { size: 9, align: "center", color: "#475569", after: 6 });
  if (input.status === "TERMINATED") write(`Terminated on ${dateEn(input.terminatedAt)} · បានបញ្ចប់នៅថ្ងៃទី ${dateKm(input.terminatedAt)}`, { bold: true, size: 10, align: "center", color: "#b91c1c", after: 6 });
  rule();

  write("BETWEEN THE UNDERSIGNED · រវាងភាគីខាងក្រោម", { bold: true, size: 11, after: 4 });
  write(`${text(employer.name)}, registration no. ${text(employer.registrationNo)}, located at ${text(employer.address)}, represented by ${text(employer.representative)}, ${text(employer.representativeTitle)}, hereinafter “the Employer”;`, { after: 3 });
  write(`${text(employer.name)} ចុះបញ្ជីលេខ ${text(employer.registrationNo)} មានអាសយដ្ឋាននៅ ${text(employer.address)} តំណាងដោយ ${text(employer.representative)} មុខតំណែង ${text(employer.representativeTitle)} ដែលតទៅនេះហៅថា «និយោជក»។`, { color: "#1f2937", after: 8 });
  write("AND · និង", { bold: true, size: 11, after: 4 });
  write(`${employee.name}, born on ${dateEn(employee.dateOfBirth)}, nationality ${text(employee.nationality)}, ID card or passport no. ${text(employee.idDocumentNo)}, residing at ${text(employee.address)}, telephone ${text(employee.phone)}, holder of driving licence no. ${text(employee.licenseNo)}, category ${text(employee.licenseCategory)}, valid until ${dateEn(employee.licenseExpiresAt)}, hereinafter “the Employee”.`, { after: 3 });
  write(`${employee.name} កើតថ្ងៃទី ${dateKm(employee.dateOfBirth)} សញ្ជាតិ ${text(employee.nationality)} អត្តសញ្ញាណប័ណ្ណ ឬលិខិតឆ្លងដែនលេខ ${text(employee.idDocumentNo)} រស់នៅ ${text(employee.address)} លេខទូរស័ព្ទ ${text(employee.phone)} ជាម្ចាស់ប័ណ្ណបើកបរលេខ ${text(employee.licenseNo)} ប្រភេទ ${text(employee.licenseCategory)} មានសុពលភាពរហូតដល់ថ្ងៃទី ${dateKm(employee.licenseExpiresAt)} ដែលតទៅនេះហៅថា «កម្មករនិយោជិត»។`, { color: "#1f2937", after: 6 });
  write("The parties have agreed as follows · ភាគីទាំងពីរបានព្រមព្រៀងគ្នាដូចខាងក្រោម៖", { bold: true, size: 10, after: 2 });

  section("Position and duties", "មុខតំណែង និងភារកិច្ច",
    `The Employer hires the Employee as ${input.position}. The Employee transports SAIWAY passengers safely and courteously, in particular airport, hotel and private transfers, and performs the related tasks assigned by the Employer. Place of work: ${input.workplace}.`,
    `និយោជកជួលកម្មករនិយោជិតក្នុងមុខតំណែងជា ${input.position}។ កម្មករនិយោជិតមានភារកិច្ចដឹកជញ្ជូនអតិថិជនរបស់ SAIWAY ដោយសុវត្ថិភាព និងដោយគួរសម ជាពិសេសការដឹកជញ្ជូនពីអាកាសយានដ្ឋាន ពីសណ្ឋាគារ និងការដឹកជញ្ជូនឯកជន ព្រមទាំងបំពេញភារកិច្ចពាក់ព័ន្ធផ្សេងទៀត ដែលនិយោជកប្រគល់ឱ្យ។ ទីកន្លែងធ្វើការ៖ ${input.workplace}។`);
  section("Duration and probation", "រយៈពេល និងការសាកល្បងការងារ",
    `This contract is concluded for an undetermined duration and takes effect on ${dateEn(input.startsAt)}. ${input.probationMonths > 0 ? `The first ${input.probationMonths} month${input.probationMonths > 1 ? "s" : ""} constitute a probation period, in accordance with the Labour Law.` : "There is no probation period."}`,
    `កិច្ចសន្យានេះធ្វើឡើងសម្រាប់រយៈពេលមិនកំណត់ ហើយចូលជាធរមានចាប់ពីថ្ងៃទី ${dateKm(input.startsAt)}។ ${input.probationMonths > 0 ? `រយៈពេល ${khmerDigits(input.probationMonths)} ខែដំបូង គឺជារយៈពេលសាកល្បងការងារ ស្របតាមច្បាប់ស្តីពីការងារ។` : "មិនមានរយៈពេលសាកល្បងការងារទេ។"}`);
  section("Working hours", "ម៉ោងធ្វើការ",
    `Normal working time is ${input.hoursPerWeek} hours per week, within the limits set by the Labour Law. Working schedules follow the trips assigned by the Employer. Overtime is paid at the rates set by law.`,
    `ម៉ោងធ្វើការធម្មតាគឺ ${khmerDigits(input.hoursPerWeek)} ម៉ោងក្នុងមួយសប្តាហ៍ ក្នុងដែនកំណត់នៃច្បាប់ស្តីពីការងារ។ កាលវិភាគការងារអនុវត្តតាមការធ្វើដំណើរ ដែលនិយោជកបានចាត់តាំង។ ម៉ោងបន្ថែមត្រូវបានទូទាត់ តាមអត្រាដែលច្បាប់បានកំណត់។`);
  section("Remuneration", "ប្រាក់បៀវត្សរ៍",
    `The Employee receives a gross monthly salary of ${money(input.monthlySalaryCents, input.currency)}, paid in accordance with the Labour Law and the applicable tax and social security (NSSF) rules.`,
    `កម្មករនិយោជិតទទួលបានប្រាក់បៀវត្សរ៍សរុបប្រចាំខែ ចំនួន ${money(input.monthlySalaryCents, input.currency)} ដែលត្រូវបើកផ្តល់ ស្របតាមច្បាប់ស្តីពីការងារ និងបទប្បញ្ញត្តិពន្ធដារ និងរបបសន្តិសុខសង្គម (ប.ស.ស.) ជាធរមាន។`);
  section("Leave", "ការឈប់សម្រាក",
    `The Employee is entitled to ${input.annualLeaveDays} working days of paid annual leave per year, to public holidays and to the other leave provided by law.`,
    `កម្មករនិយោជិតមានសិទ្ធិឈប់សម្រាកប្រចាំឆ្នាំ ដោយទទួលបានប្រាក់ឈ្នួល ចំនួន ${khmerDigits(input.annualLeaveDays)} ថ្ងៃធ្វើការក្នុងមួយឆ្នាំ ព្រមទាំងថ្ងៃបុណ្យសាធារណៈ និងការឈប់សម្រាកផ្សេងទៀត ដែលច្បាប់បានកំណត់។`);
  section("Driving licence and conduct", "ប័ណ្ណបើកបរ និងក្រមសីលធម៌",
    "The Employee must hold a valid driving licence at all times, inform the Employer immediately of any suspension, withdrawal or expiry, respect the traffic law, never drive under the influence of alcohol or drugs, and keep passenger information confidential.",
    "កម្មករនិយោជិតត្រូវមានប័ណ្ណបើកបរ ដែលមានសុពលភាពជានិច្ច ត្រូវជូនដំណឹងដល់និយោជកភ្លាមៗ ក្នុងករណីប័ណ្ណត្រូវបានព្យួរ ដកហូត ឬផុតសុពលភាព ត្រូវគោរពច្បាប់ចរាចរណ៍ផ្លូវគោក មិនត្រូវបើកបរ ក្រោមឥទ្ធិពលគ្រឿងស្រវឹង ឬគ្រឿងញៀន និងត្រូវរក្សាការសម្ងាត់ ព័ត៌មានរបស់អតិថិជន។");
  section("Termination", "ការបញ្ចប់កិច្ចសន្យា",
    "Either party may terminate this contract with the notice and under the conditions set by the Labour Law. Serious misconduct may justify dismissal without notice, as provided by law.",
    "ភាគីណាមួយអាចបញ្ចប់កិច្ចសន្យានេះ ដោយផ្តល់ការជូនដំណឹងជាមុន និងតាមលក្ខខណ្ឌ ដែលច្បាប់ស្តីពីការងារបានកំណត់។ កំហុសធ្ងន់ធ្ងរ អាចជាមូលហេតុនៃការបញ្ឈប់ពីការងារ ដោយគ្មានការជូនដំណឹងជាមុន ស្របតាមច្បាប់។");
  if (input.additionalTerms?.trim()) section("Additional terms", "លក្ខខណ្ឌបន្ថែម", input.additionalTerms.trim(), "");
  section("Applicable law and signature", "ច្បាប់អនុវត្ត និងការចុះហត្ថលេខា",
    `This contract is governed by the Labour Law of the Kingdom of Cambodia. Any dispute shall first be settled amicably, then submitted to the competent labour authorities. The English and Khmer versions are equally authentic; in case of discrepancy, the Khmer version prevails. Made in ${input.workplace} on ${dateEn(input.issuedAt)}, in two originals, one for each party.`,
    `កិច្ចសន្យានេះស្ថិតនៅក្រោមច្បាប់ស្តីពីការងារ នៃព្រះរាជាណាចក្រកម្ពុជា។ វិវាទណាមួយ ត្រូវដោះស្រាយដោយសន្តិវិធីជាមុនសិន បន្ទាប់មកត្រូវដាក់ជូនអាជ្ញាធរការងារ ដែលមានសមត្ថកិច្ច។ អត្ថបទជាភាសាអង់គ្លេស និងភាសាខ្មែរ មានតម្លៃស្មើគ្នា ក្នុងករណីមានភាពខុសគ្នា ត្រូវយកអត្ថបទជាភាសាខ្មែរជាគោល។ ធ្វើនៅ ${input.workplace} ថ្ងៃទី ${dateKm(input.issuedAt)} ជាពីរច្បាប់ដើម សម្រាប់ភាគីនីមួយៗ មួយច្បាប់។`);

  ensureSpace(170);
  doc.y += 18;
  const top = doc.y;
  const column = width / 2;
  const signature = (x: number, en: string, km: string, name: string, noteEn: string, noteKm: string) => {
    doc.fillColor("#111827").font("latinBold").fontSize(10).text(en, x, top, { width: column - 16, align: "center" });
    doc.font("khmerBold").fontSize(10).text(km, x, doc.y, { width: column - 16, align: "center" });
    doc.font("latin").fontSize(9).fillColor("#475569").text(noteEn, x, doc.y + 2, { width: column - 16, align: "center" });
    doc.font("khmer").fontSize(9).text(noteKm, x, doc.y, { width: column - 16, align: "center" });
    doc.rect(x + 20, top + 92, column - 56, 0.6).fill("#94a3b8");
    centered(name, x, top + 98, column - 16);
  };
  signature(margin, "The Employer", "និយោជក", employer.representative?.trim() || blank, "Signature and company seal", "ហត្ថលេខា និងត្រា");
  signature(margin + column, "The Employee", "កម្មករនិយោជិត", employee.name, "Signature or thumbprint", "ហត្ថលេខា ឬស្នាមមេដៃ");

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    if (input.status === "DRAFT") {
      doc.save().rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] }).fillOpacity(0.08).fillColor("#1e3a8a");
      doc.font("latinBold").fontSize(96).text("DRAFT", 0, doc.page.height / 2 - 90, { width: doc.page.width, align: "center", lineBreak: false });
      doc.font("khmerBold").fontSize(54).text("សេចក្តីព្រាង", 0, doc.page.height / 2 + 20, { width: doc.page.width, align: "center", lineBreak: false });
      doc.restore();
    }
    const footer = `SAIWAY · ${input.reference} · Page ${index + 1}/${range.count} · ទំព័រ ${khmerDigits(index + 1)}/${khmerDigits(range.count)}`;
    doc.fillOpacity(1);
    centered(footer, margin, doc.page.height - 38, width, { size: 8, color: "#64748b" });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return done;
}
