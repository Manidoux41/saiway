import { readTripLocation } from "@/lib/trip-location";

export const runtime = "nodejs";
type Context = { params: Promise<{ bookingId: string }> };

export async function GET(request: Request, { params }: Context) {
  const { bookingId } = await params;
  return readTripLocation(request, bookingId);
}
