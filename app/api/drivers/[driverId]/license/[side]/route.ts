import { adminDeleteDriverLicense, adminUploadDriverLicense, driverLicenseImage } from "@/lib/driver-license";

export const runtime = "nodejs";
type Context = { params: Promise<{ driverId: string; side: string }> };

export async function GET(request: Request, { params }: Context) {
  const { driverId, side } = await params;
  return driverLicenseImage(request, driverId, side);
}

export async function PUT(request: Request, { params }: Context) {
  const { driverId, side } = await params;
  return adminUploadDriverLicense(request, driverId, side);
}

export async function DELETE(request: Request, { params }: Context) {
  const { driverId, side } = await params;
  return adminDeleteDriverLicense(request, driverId, side);
}
