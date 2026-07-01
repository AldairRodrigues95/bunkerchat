const STORAGE_PREFIX = "storage://chat-uploads/";
const MAX_DATA_URL_BYTES = 900_000;
const MAX_IMAGE_DIMENSION = 1280;
const JPEG_QUALITY = 0.82;

export function isStoragePath(value: string): boolean {
  return value.startsWith(STORAGE_PREFIX);
}

export function isDataImageUrl(value: string): boolean {
  return value.startsWith("data:image/");
}

export function toStoragePath(bucketPath: string): string {
  return `${STORAGE_PREFIX}${bucketPath}`;
}

export function fromStoragePath(value: string): string | null {
  if (!isStoragePath(value)) return null;
  return value.slice(STORAGE_PREFIX.length);
}

export async function resolveImageUrl(
  imageUrl: string | null,
  createSignedUrl: (path: string) => Promise<string | null>,
): Promise<string | null> {
  if (!imageUrl) return null;
  if (isDataImageUrl(imageUrl)) return imageUrl;

  const storagePath = fromStoragePath(imageUrl);
  if (storagePath) {
    return createSignedUrl(storagePath);
  }

  return imageUrl;
}

export async function compressImageFile(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Não foi possível processar a imagem");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Falha ao comprimir imagem"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  return blob;
}

export async function fileToDataUrl(file: File): Promise<string> {
  const compressed = await compressImageFile(file);
  if (compressed.size > MAX_DATA_URL_BYTES) {
    throw new Error("Imagem muito grande. Escolha uma foto menor.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Falha ao ler imagem"));
    };
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.readAsDataURL(compressed);
  });
}
