import { bookingRequest } from "@/lib/bookings";
export const runtime = "nodejs";
export const GET = (request: Request) => bookingRequest(request, "CUSTOMER");
export const POST = (request: Request) => bookingRequest(request, "CUSTOMER");
export const DELETE = (request: Request) => bookingRequest(request, "CUSTOMER");
