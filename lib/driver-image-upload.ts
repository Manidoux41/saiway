import "server-only";
import { licenseImageType, maxLicenseImageBytes } from "@/lib/driver-license";

export async function readDriverImageUpload(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > maxLicenseImageBytes + 64 * 1024) return Response.json({ error: "Image must be 5 MB or smaller" }, { status: 413 });
  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "Invalid upload" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Invalid upload" }, { status: 400 });
  if (file.size === 0 || file.size > maxLicenseImageBytes) return Response.json({ error: "Image must be 5 MB or smaller" }, { status: 413 });
  const data = new Uint8Array(await file.arrayBuffer());
  const mimeType = licenseImageType(data);
  if (!mimeType) return Response.json({ error: "Use a JPEG, PNG or WebP photo" }, { status: 415 });
  return { data, mimeType };
}
