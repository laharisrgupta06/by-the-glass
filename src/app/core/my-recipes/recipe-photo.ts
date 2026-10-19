import { photoProblem } from './my-recipe.model';

/** Long edge after resizing: plenty for a recipe page, small enough to upload quickly. */
const MAX_EDGE = 1600;
/** Storage rules refuse anything at or over 2 MB. */
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export interface PreparedPhoto {
  blob: Blob;
  contentType: string;
  /** An object URL for the preview; revoke it when it's no longer shown. */
  previewUrl: string;
}

function encode(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

/**
 * Checks a chosen photo, then shrinks it in the browser (at most 1600 px on its long
 * edge) and re-encodes it as WebP, or JPEG where WebP can't be written. Throws an Error
 * with a message a person can act on.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const problem = photoProblem(file);
  if (problem) throw new Error(problem);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That photo couldn’t be read. Try another one.');
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let blob = await encode(canvas, 'image/webp', 0.85);
  // Browsers that can't write WebP hand back a PNG instead.
  if (!blob || blob.type !== 'image/webp')
    blob = await encode(canvas, 'image/jpeg', 0.85);
  if (blob && blob.size >= MAX_UPLOAD_BYTES)
    blob = await encode(canvas, 'image/jpeg', 0.7);
  if (!blob || blob.size >= MAX_UPLOAD_BYTES)
    throw new Error('That photo is too detailed to upload. Try a smaller one.');
  return {
    blob,
    contentType: blob.type,
    previewUrl: URL.createObjectURL(blob),
  };
}
