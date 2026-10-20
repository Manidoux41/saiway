import { customerPayment } from "@/lib/payments";

export const runtime = "nodejs";
export const POST = (request: Request) => customerPayment(request, "verify");