import { deleteVehicleIcon, saveVehicleIcon } from "@/lib/vehicle-icon";

export const runtime = "nodejs";
type Context = { params: Promise<{ vehicleId: string }> };

export async function PUT(request: Request, { params }: Context) {
  return saveVehicleIcon(request, (await params).vehicleId);
}

export async function DELETE(request: Request, { params }: Context) {
  return deleteVehicleIcon(request, (await params).vehicleId);
}
