import { driverLicenseImage } from "@/lib/driver-license";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ driverId: string; side: string }> }) {
  const { driverId, side } = await params;
  return driverLicenseImage(request, driverId, side);
}
