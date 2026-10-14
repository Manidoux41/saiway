import { bookingRequest } from "@/lib/bookings";
export const runtime = "nodejs";
export const GET = (request: Request) => bookingRequest(request, "DRIVER");
export const PATCH = (request: Request) => bookingRequest(request, "DRIVER");
