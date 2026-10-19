import {
  INLINE_PHOTO_MAX_URL_LENGTH,
  INLINE_PHOTO_PATH,
} from './my-recipe.model';
import { FirestoreMyRecipesRepository } from './firestore-my-recipes.repository';

describe('FirestoreMyRecipesRepository photos', () => {
  const repository = new FirestoreMyRecipesRepository();
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 128]);

  it('keeps a photo in the recipe document as a data URL, with nothing lost', async () => {
    const image = await repository.uploadImage(
      'user-1',
      'AbCdEfGhIjKlMnOpQrSt',
      new Blob([bytes], { type: 'image/webp' }),
      'image/webp'
    );
    expect(image.path).toBe(INLINE_PHOTO_PATH);
    expect(image.url).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/);
    const decoded = new Uint8Array(
      await (await fetch(image.url)).arrayBuffer()
    );
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  it('only stores the types and sizes firestore.rules accepts', async () => {
    await expectAsync(
      repository.uploadImage(
        'user-1',
        'AbCdEfGhIjKlMnOpQrSt',
        new Blob([bytes], { type: 'image/png' }),
        'image/png'
      )
    ).toBeRejectedWith(jasmine.objectContaining({ code: 'photo/unsupported' }));
    const tooBig = new Blob([new Uint8Array(INLINE_PHOTO_MAX_URL_LENGTH)], {
      type: 'image/jpeg',
    });
    await expectAsync(
      repository.uploadImage(
        'user-1',
        'AbCdEfGhIjKlMnOpQrSt',
        tooBig,
        'image/jpeg'
      )
    ).toBeRejectedWith(jasmine.objectContaining({ code: 'photo/too-large' }));
  });

  it('has nothing to delete for an inline photo: it goes with its recipe', async () => {
    await expectAsync(repository.deleteImage(INLINE_PHOTO_PATH)).toBeResolved();
  });
});
