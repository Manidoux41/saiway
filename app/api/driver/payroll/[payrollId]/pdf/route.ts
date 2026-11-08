import { payrollPdf } from "@/lib/payroll-pdf";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ payrollId: string }> }) {
  return payrollPdf(request, (await params).payrollId, "DRIVER");
}
