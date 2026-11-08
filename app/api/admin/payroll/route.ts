import { payrollRequest } from "@/lib/payroll";
export const runtime = "nodejs";
export const GET = (request: Request) => payrollRequest(request, "ADMIN");
export const POST = GET;
export const PATCH = GET;
