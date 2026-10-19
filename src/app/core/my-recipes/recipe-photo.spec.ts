import { photoProblem } from './my-recipe.model';
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

  it('shrinks a large photo to 1600 px on its long edge before upload', async () => {
    const photo = await preparePhoto(await pngFile(3200, 1800));
    expect(['image/webp', 'image/jpeg']).toContain(photo.contentType);
    expect(photo.blob.size).toBeLessThan(2 * 1024 * 1024);
    const bitmap = await createImageBitmap(photo.blob);
    expect([bitmap.width, bitmap.height]).toEqual([1600, 900]);
    expect(photo.previewUrl).toMatch(/^blob:/);
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
