import { deleteDriverContactQr, driverContactQrImage, uploadDriverContactQr } from "@/lib/driver-contact-qr";

export const runtime = "nodejs";
type Context = { params: Promise<{ driverId: string; channel: string }> };

export async function GET(request: Request, { params }: Context) {
  const { driverId, channel } = await params;
  return driverContactQrImage(request, driverId, channel);
}

export async function PUT(request: Request, { params }: Context) {
  const { driverId, channel } = await params;
  return uploadDriverContactQr(request, driverId, channel);
}

export async function DELETE(request: Request, { params }: Context) {
  const { driverId, channel } = await params;
  return deleteDriverContactQr(request, driverId, channel);
}
