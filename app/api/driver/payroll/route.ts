import { payrollRequest } from "@/lib/payroll";
export const runtime = "nodejs";
export const GET = (request: Request) => payrollRequest(request, "DRIVER");
