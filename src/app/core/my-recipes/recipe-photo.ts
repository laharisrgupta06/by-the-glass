import { MAX_STORED_PHOTO_BYTES, photoProblem } from './my-recipe.model';

/**
 * Long edge after resizing: sharp on a recipe page and its card, and small enough to
 * keep inside the recipe's own Firestore document (see MAX_STORED_PHOTO_BYTES).
 */
const MAX_EDGE = 1024;
/** Never shrink below this while looking for a small enough file. */
const MIN_EDGE = 480;
const QUALITIES = [0.82, 0.72, 0.62, 0.52];

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

function draw(bitmap: ImageBitmap, edge: number): HTMLCanvasElement {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Checks a chosen photo, then shrinks it in the browser (at most 1024 px on its long
 * edge) and re-encodes it as WebP, or JPEG where WebP can't be written, lowering the
 * quality and then the size until it's under MAX_STORED_PHOTO_BYTES. Throws an Error
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
  try {
    // Browsers that can't write WebP hand back a PNG instead, so check once.
    const probe = await encode(draw(bitmap, 16), 'image/webp', 0.8);
    const type = probe?.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    for (let edge = MAX_EDGE; edge >= MIN_EDGE; edge = Math.round(edge * 0.8)) {
      const canvas = draw(bitmap, edge);
      for (const quality of QUALITIES) {
        const blob = await encode(canvas, type, quality);
        if (blob && blob.size <= MAX_STORED_PHOTO_BYTES)
          return {
            blob,
            contentType: blob.type,
            previewUrl: URL.createObjectURL(blob),
          };
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error('That photo is too detailed to save. Try a smaller one.');
}
