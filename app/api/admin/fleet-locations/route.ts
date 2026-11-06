import { adminFleetLocations } from "@/lib/driver-location";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return adminFleetLocations(request);
}
