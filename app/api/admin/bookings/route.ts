import { bookingRequest } from "@/lib/bookings";
export const runtime = "nodejs";
export const GET = (request: Request) => bookingRequest(request, "ADMIN");
export const POST = (request: Request) => bookingRequest(request, "ADMIN");
export const PATCH = (request: Request) => bookingRequest(request, "ADMIN");
export const DELETE = (request: Request) => bookingRequest(request, "ADMIN");
