import { driverLocationAccess, shareDriverLocation } from "@/lib/driver-location";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return driverLocationAccess(request);
}

export async function PUT(request: Request) {
  return shareDriverLocation(request);
}
