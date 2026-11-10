const maxUploadBytes = 3 * 1024 * 1024;
export const maxBlogOriginalBytes = 20 * 1024 * 1024;

export async function prepareBlogImage(file: File): Promise<File> {
  if (!file.size || file.size > maxBlogOriginalBytes) throw new Error("INVALID_IMAGE");
  const image = await createImageBitmap(file);
  try {
    if (file.size <= maxUploadBytes && Math.max(image.width, image.height) <= 2000) return file;
    const scale = Math.min(1, 2000 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("INVALID_IMAGE");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    if (!blob || blob.size > maxUploadBytes) throw new Error("INVALID_IMAGE");
    return new File([blob], "blog-photo.webp", { type: blob.type });
  } finally { image.close(); }
}
