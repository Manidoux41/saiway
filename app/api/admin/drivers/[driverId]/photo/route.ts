import { adminDeleteDriverPhoto, adminDriverPhoto, adminUploadDriverPhoto } from "@/lib/driver-photo";

export const runtime = "nodejs";
type Context = { params: Promise<{ driverId: string }> };

export async function GET(request: Request, { params }: Context) {
  return adminDriverPhoto(request, (await params).driverId);
}

export async function PUT(request: Request, { params }: Context) {
  return adminUploadDriverPhoto(request, (await params).driverId);
}

export async function DELETE(request: Request, { params }: Context) {
  return adminDeleteDriverPhoto(request, (await params).driverId);
}
