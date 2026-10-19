import { MAX_STORED_PHOTO_BYTES, photoProblem } from './my-recipe.model';
import { preparePhoto } from './recipe-photo';

/** A real PNG drawn in the test browser. */
function pngFile(width: number, height: number): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e9b872';
  ctx.fillRect(0, 0, width, height);
  return new Promise(resolve =>
    canvas.toBlob(
      b => resolve(new File([b!], 'drink.png', { type: 'image/png' })),
      'image/png'
    )
  );
}

/** A real, detailed photo-like PNG: random noise compresses badly, like a busy photo. */
function noisyPngFile(width: number, height: number): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.createImageData(width, height);
  let seed = 7;
  for (let i = 0; i < pixels.data.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    pixels.data[i] = i % 4 === 3 ? 255 : seed & 0xff;
  }
  ctx.putImageData(pixels, 0, 0);
  return new Promise(resolve =>
    canvas.toBlob(
      b => resolve(new File([b!], 'busy.png', { type: 'image/png' })),
      'image/png'
    )
  );
}

describe('recipe photos', () => {
  it('accepts JPEG, PNG and WebP under 10 MB, and nothing else', () => {
    expect(photoProblem({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(photoProblem({ type: 'image/webp', size: 1000 })).toBeNull();
    expect(photoProblem({ type: 'image/gif', size: 1000 })).toBe(
      'Choose a JPEG, PNG or WebP photo.'
    );
    expect(photoProblem({ type: 'image/svg+xml', size: 1000 })).not.toBeNull();
    expect(photoProblem({ type: 'image/png', size: 11 * 1024 * 1024 })).toBe(
      'Choose a photo under 10 MB.'
    );
  });

  it('shrinks a large photo to 1024 px on its long edge, small enough to store', async () => {
    const photo = await preparePhoto(await pngFile(3200, 1800));
    expect(['image/webp', 'image/jpeg']).toContain(photo.contentType);
    expect(photo.blob.size).toBeLessThanOrEqual(MAX_STORED_PHOTO_BYTES);
    const bitmap = await createImageBitmap(photo.blob);
    expect([bitmap.width, bitmap.height]).toEqual([1024, 576]);
    expect(photo.previewUrl).toMatch(/^blob:/);
    URL.revokeObjectURL(photo.previewUrl);
  });

  it('lowers quality, then size, until even a very detailed photo fits in 150 KB', async () => {
    const photo = await preparePhoto(await noisyPngFile(2400, 1600));
    expect(photo.blob.size).toBeLessThanOrEqual(MAX_STORED_PHOTO_BYTES);
    const bitmap = await createImageBitmap(photo.blob);
    expect(Math.max(bitmap.width, bitmap.height)).toBeGreaterThanOrEqual(480);
    URL.revokeObjectURL(photo.previewUrl);
  });

  it('refuses a file that isn’t a usable photo, with a message to act on', async () => {
    const text = new File(['not an image'], 'notes.txt', {
      type: 'text/plain',
    });
    await expectAsync(preparePhoto(text)).toBeRejectedWithError(
      'Choose a JPEG, PNG or WebP photo.'
    );
    const broken = new File(['garbage'], 'broken.png', { type: 'image/png' });
    await expectAsync(preparePhoto(broken)).toBeRejectedWithError(
      'That photo couldn’t be read. Try another one.'
    );
  });
});
