import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import {
  MENU_PATHS,
  MenuIllustration,
  StoredMenuRecipe,
} from '../../app/core/ai/ai-recipe';
import { VenueMenuDrink } from '../../app/featured/products/data/venue-menu/venue-menu.data';
import {
  IMAGE_TYPES,
  IllustrationMeta,
  MenuStorage,
  checkStoredRecipe,
  sameList,
} from './venue-menu';

/** The files for each drink. Ids come from the menu data only, never from a request. */
export class MenuStore implements MenuStorage {
  constructor(readonly dir: string) {}

  private recipeFile(drink: VenueMenuDrink): string {
    return join(this.dir, 'recipes', `${drink.id}.json`);
  }
  imageFile(drink: VenueMenuDrink): string {
    return join(this.dir, 'illustrations', `${drink.id}.image`);
  }
  private imageMetaFile(drink: VenueMenuDrink): string {
    return join(this.dir, 'illustrations', `${drink.id}.json`);
  }

  /**
   * The stored recipe, checked again as if it had just been generated. One made for a
   * different ingredient list (the listing changed) is set aside, not shown or deleted.
   */
  async readRecipe(drink: VenueMenuDrink): Promise<StoredMenuRecipe | null> {
    const stored = await readJson<StoredMenuRecipe>(this.recipeFile(drink));
    if (!stored) return null;
    if (!sameList(stored.menuIngredients ?? [], drink.ingredients)) {
      await this.setAside(this.recipeFile(drink), 'the menu listing changed');
      return null;
    }
    const checked = checkStoredRecipe(drink, stored);
    // One that no longer passes the checks is set aside (kept), so it can be made again.
    if (!checked)
      await this.setAside(
        this.recipeFile(drink),
        'it no longer passes the checks'
      );
    return checked;
  }

  /** False when a recipe is already stored (it is never replaced). */
  async writeRecipe(
    drink: VenueMenuDrink,
    data: StoredMenuRecipe
  ): Promise<boolean> {
    return writeNew(
      this.recipeFile(drink),
      JSON.stringify(data, null, 2) + '\n'
    );
  }

  /** The stored image's type, for serving it. */
  async illustrationType(drink: VenueMenuDrink): Promise<string | null> {
    const meta = await readJson<{ mimeType?: string }>(
      this.imageMetaFile(drink)
    );
    return meta?.mimeType && IMAGE_TYPES.includes(meta.mimeType)
      ? meta.mimeType
      : null;
  }

  async readIllustration(
    drink: VenueMenuDrink
  ): Promise<MenuIllustration | null> {
    const meta = await readJson<{ model: string; createdAt: string }>(
      this.imageMetaFile(drink)
    );
    const exists = await fs
      .stat(this.imageFile(drink))
      .then(s => s.isFile() && s.size > 0)
      .catch(() => false);
    if (!meta || !exists) return null;
    return {
      url: MENU_PATHS.illustration(drink.id),
      model: meta.model,
      createdAt: meta.createdAt,
    };
  }

  async writeIllustration(
    drink: VenueMenuDrink,
    image: Uint8Array,
    meta: IllustrationMeta
  ): Promise<boolean> {
    if (await this.readIllustration(drink)) return false;
    // An image left without its description by an interrupted write is set aside.
    if (!(await writeNew(this.imageFile(drink), image))) {
      await this.setAside(
        this.imageFile(drink),
        'it was left without its description'
      );
      if (!(await writeNew(this.imageFile(drink), image))) return false;
    }
    // Served only once its description exists.
    return writeNew(
      this.imageMetaFile(drink),
      JSON.stringify(meta, null, 2) + '\n'
    );
  }

  /** Renames a file so it's kept but no longer used; nothing is deleted. */
  private async setAside(file: string, reason: string): Promise<void> {
    const aside = file.replace(/(\.\w+)$/, `.stale-${Date.now()}$1`);
    await fs.rename(file, aside).catch(() => undefined);
    console.warn(`Set aside ${file} (${reason}).`);
  }
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Writes a file only if it doesn't exist yet: via a temporary file and a hard link. */
async function writeNew(
  file: string,
  data: string | Uint8Array
): Promise<boolean> {
  await fs.mkdir(join(file, '..'), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, data, { flag: 'wx' });
  try {
    await fs.link(temp, file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  } finally {
    await fs.unlink(temp).catch(() => undefined);
  }
}
