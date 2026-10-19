import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { recipePhotosAvailable } from 'src/app/core/firebase/firebase';
import { preparePhoto } from 'src/app/core/my-recipes/recipe-photo';
import {
  ImageChange,
  MY_RECIPE_LIMITS,
  MyRecipeDraft,
  MyRecipeIngredient,
  RECIPE_UNITS,
  RecipeUnit,
  UNITS_WITHOUT_QUANTITY,
  draftProblems,
  newRecipeId,
  stepsFromText,
  toDisplayRecipe,
} from 'src/app/core/my-recipes/my-recipe.model';
import { MyRecipesService } from 'src/app/core/my-recipes/my-recipes.service';
import { ProductDescriptionComponent } from '../../../products/components/product-description/product-description.component';
import { ProductImageComponent } from '../../../products/components/product-image/product-image.component';
import { ProductIngredientsComponent } from '../../../products/components/product-ingredients/product-ingredients.component';
import { ProductInstructionsComponent } from '../../../products/components/product-instructions/product-instructions.component';

type IngredientForm = FormGroup<{
  name: FormControl<string>;
  quantity: FormControl<string>;
  unit: FormControl<string>;
}>;

/**
 * Create a recipe, or edit one of your own (/personal/recipes/new and
 * /personal/recipes/:id/edit). Written by hand: nothing here involves AI.
 */
@Component({
  selector: 'app-recipe-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ProductDescriptionComponent,
    ProductImageComponent,
    ProductIngredientsComponent,
    ProductInstructionsComponent,
  ],
  templateUrl: './recipe-editor.component.html',
  styleUrl: './recipe-editor.component.scss',
})
export class RecipeEditorComponent {
  private fb = inject(FormBuilder).nonNullable;
  private router = inject(Router);
  private host: ElementRef<HTMLElement> = inject(ElementRef);
  readonly auth = inject(AuthService);
  readonly recipes = inject(MyRecipesService);

  readonly units = RECIPE_UNITS;
  readonly limits = MY_RECIPE_LIMITS;

  /** Set when editing an existing recipe. */
  readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map(p => p.get('id'))),
    { initialValue: null }
  );

  readonly form = this.fb.group({
    name: '',
    description: '',
    kind: 'cocktail' as 'cocktail' | 'mocktail',
    ingredients: this.fb.array<IngredientForm>([this.ingredientRow()]),
    method: '',
    glass: '',
    ice: '',
    garnish: '',
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** The form as a recipe, exactly as it would be saved. */
  readonly draft = computed<MyRecipeDraft>(() => {
    this.value();
    const v = this.form.getRawValue();
    return {
      name: v.name,
      description: v.description,
      kind: v.kind,
      ingredients: v.ingredients.map(i => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit as RecipeUnit,
      })),
      steps: stepsFromText(v.method),
      glass: v.glass,
      ice: v.ice,
      garnish: v.garnish,
    };
  });

  readonly problems = computed(() => draftProblems(this.draft()));
  /** Errors show after a save attempt, so a half-typed form isn't shouted at. */
  readonly attempted = signal(false);
  readonly previewing = signal(false);
  readonly photosAvailable = recipePhotosAvailable;
  /** The photo shown: the saved one, or one just chosen (not uploaded until Save). */
  readonly photo = signal<{ url: string; isNew: boolean } | null>(null);
  readonly photoError = signal('');
  readonly preparingPhoto = signal(false);
  private imageChange: ImageChange = { kind: 'keep' };
  private savedPhoto = false;

  readonly preview = computed(() =>
    toDisplayRecipe({ ...this.draft(), image: this.photo() })
  );
  readonly problemCount = computed(() => {
    const p = this.problems();
    const fieldCount = Object.keys(p).filter(k => k !== 'ingredient').length;
    const ingredientCount = Object.values(p.ingredient ?? {}).reduce(
      (n, i) => n + (i.name ? 1 : 0) + (i.quantity ? 1 : 0),
      0
    );
    return fieldCount + ingredientCount;
  });

  /** Editing: the recipe isn't one of this person's (or doesn't exist). */
  readonly notFound = computed(
    () =>
      !!this.id() &&
      this.recipes.status() === 'ready' &&
      !this.recipes.byId(this.id()!)
  );
  private loadedId: string | null = null;
  /** A new recipe keeps this id across retries, so a retry can't make a duplicate. */
  private readonly newId = newRecipeId();

  constructor() {
    // A message from an earlier visit to the editor doesn't apply here.
    this.recipes.saveError.set('');
    // Fill the form once the recipe being edited has loaded.
    effect(
      () => {
        const id = this.id();
        const recipe = id ? this.recipes.byId(id) : undefined;
        if (!recipe || this.loadedId === id) return;
        this.loadedId = id;
        this.fill(recipe);
        // Filling the form updates its value signal.
      },
      { allowSignalWrites: true }
    );
  }

  get ingredients(): FormArray<IngredientForm> {
    return this.form.controls.ingredients;
  }

  addIngredient(): void {
    if (this.ingredients.length >= MY_RECIPE_LIMITS.ingredients) return;
    this.ingredients.push(this.ingredientRow());
    // Straight to the new row's name.
    setTimeout(() =>
      this.host.nativeElement
        .querySelector<HTMLInputElement>('.ingredient:last-of-type input')
        ?.focus()
    );
  }

  removeIngredient(index: number): void {
    if (this.ingredients.length > 1) this.ingredients.removeAt(index);
  }

  needsQuantity(index: number): boolean {
    const unit = this.ingredients.at(index).controls.unit.value as RecipeUnit;
    return !UNITS_WITHOUT_QUANTITY.includes(unit);
  }

  error(
    field:
      | 'name'
      | 'description'
      | 'kind'
      | 'ingredients'
      | 'steps'
      | 'glass'
      | 'ice'
      | 'garnish'
  ): string {
    return this.attempted() ? this.problems()[field] ?? '' : '';
  }

  ingredientError(index: number, part: 'name' | 'quantity'): string {
    return this.attempted()
      ? this.problems().ingredient?.[index]?.[part] ?? ''
      : '';
  }

  togglePreview(): void {
    this.previewing.update(on => !on);
  }

  async choosePhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so choosing the same file again still counts
    if (!file) return;
    this.photoError.set('');
    this.preparingPhoto.set(true);
    try {
      const photo = await preparePhoto(file);
      this.revokePreview();
      this.photo.set({ url: photo.previewUrl, isNew: true });
      this.imageChange = {
        kind: 'set',
        blob: photo.blob,
        contentType: photo.contentType,
      };
    } catch (error) {
      this.photoError.set((error as Error).message);
    } finally {
      this.preparingPhoto.set(false);
    }
  }

  removePhoto(): void {
    this.revokePreview();
    this.photo.set(null);
    this.photoError.set('');
    // Removing a photo that was only chosen, never saved, leaves the recipe as it was.
    this.imageChange = this.savedPhoto ? { kind: 'remove' } : { kind: 'keep' };
  }

  async save(): Promise<void> {
    this.attempted.set(true);
    if (this.problemCount()) {
      setTimeout(() =>
        this.host.nativeElement.querySelector<HTMLElement>('.summary')?.focus()
      );
      return;
    }
    const id = await this.recipes.save(
      this.draft(),
      this.id() ?? undefined,
      this.imageChange,
      this.newId
    );
    if (id) this.router.navigate(['/personal/recipes', id]);
  }

  private ingredientRow(item?: MyRecipeIngredient): IngredientForm {
    return this.fb.group({
      name: item?.name ?? '',
      quantity: item?.quantity ?? '',
      unit: (item?.unit ?? 'ml') as string,
    }) as IngredientForm;
  }

  private revokePreview(): void {
    const photo = this.photo();
    if (photo?.isNew) URL.revokeObjectURL(photo.url);
  }

  private fill(
    recipe: MyRecipeDraft & { image?: { url: string } | null }
  ): void {
    this.savedPhoto = !!recipe.image;
    this.photo.set(
      recipe.image ? { url: recipe.image.url, isNew: false } : null
    );
    this.imageChange = { kind: 'keep' };
    this.ingredients.clear();
    for (const item of recipe.ingredients)
      this.ingredients.push(this.ingredientRow(item));
    this.form.patchValue({
      name: recipe.name,
      description: recipe.description,
      kind: recipe.kind,
      method: recipe.steps.join('\n'),
      glass: recipe.glass,
      ice: recipe.ice,
      garnish: recipe.garnish,
    });
  }
}
