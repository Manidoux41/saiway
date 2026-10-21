import { shareTripLocation } from "@/lib/trip-location";

export const runtime = "nodejs";
type Context = { params: Promise<{ bookingId: string }> };

export async function PUT(request: Request, { params }: Context) {
  const { bookingId } = await params;
  return shareTripLocation(request, bookingId);
}
