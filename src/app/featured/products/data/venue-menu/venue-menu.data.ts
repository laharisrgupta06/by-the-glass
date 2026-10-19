/**
 * Drinks from a venue menu, transcribed from user-supplied menu photos on 2026-10-14
 * (dataset "By the Glass — Venue Menu Starter Dataset (No Prices)", schema 1.0.0).
 * Published with the owner's confirmed permission (2026-10-20): these drinks are part
 * of the public site, in development and production alike.
 *
 * These are MENU DESCRIPTIONS, not recipes: the menu lists ingredients without
 * quantities, method, glass, garnish or servings, and there are no photos. Never add
 * any of those here, and never add prices: By the Glass is not a shop.
 *
 * IDs are fixed. They were derived from the names once, at import, and must never be
 * regenerated or changed: favourites and links depend on them. A drink can be renamed
 * by editing `name` only. To add a drink, append it to the end of the list with a new
 * id (see "Publishing the venue menu" in the README).
 */

export type VenueMenuKind = 'cocktail' | 'mocktail' | 'zero_proof';

export interface VenueMenuDrink {
  /** Fixed forever; see above. */
  id: string;
  name: string;
  /** The menu section it's listed under, e.g. "Desi Cocktails". */
  section: string;
  kind: VenueMenuKind;
  /** As written on the menu, in order. */
  ingredients: string[];
  /** As written on the menu, e.g. "sweet", "smoky". */
  flavourNotes: string[];
}

export const VENUE_MENU_TRANSCRIBED_ON = '2026-10-14';

export const VENUE_MENU_DRINKS: VenueMenuDrink[] = [
  {
    id: 'bg-menu-patiala-balance',
    name: 'Patiala Balance',
    section: 'Pauwa Cocktails',
    kind: 'cocktail',
    ingredients: [
      'gin',
      'passionfruit',
      'teppal extract',
      'orange juice',
      'lime',
    ],
    flavourNotes: ['sweet', 'floral'],
  },
  {
    id: 'bg-menu-bombae-rita',
    name: 'Bombae Rita',
    section: 'Pauwa Cocktails',
    kind: 'cocktail',
    ingredients: ['Camino Blanco', 'watermelon', 'kokum', 'house spice mix'],
    flavourNotes: ['sour', 'fruity'],
  },
  {
    id: 'bg-menu-kokum-kick',
    name: 'Kokum Kick',
    section: 'Pauwa Cocktails',
    kind: 'cocktail',
    ingredients: ['Camino Blanco', 'house-made kokum cordial', 'soda'],
    flavourNotes: ['salty', 'fruity'],
  },
  {
    id: 'bg-menu-spice-route',
    name: 'Spice Route',
    section: 'Pauwa Cocktails',
    kind: 'cocktail',
    ingredients: ['gin', 'house-made spice syrup', 'lime', 'soda'],
    flavourNotes: ['spicy', 'herbal'],
  },
  {
    id: 'bg-menu-coconut-cartel',
    name: 'Coconut Cartel',
    section: 'Pauwa Cocktails',
    kind: 'cocktail',
    ingredients: ['vodka', 'tropical juice blend', 'coconut'],
    flavourNotes: ['sweet', 'fruity'],
  },
  {
    id: 'bg-menu-susegad-sling',
    name: 'Susegad Sling',
    section: 'Pauwa Cocktails',
    kind: 'cocktail',
    ingredients: ['rum', 'sweet lime cordial', 'makrut lime leaf'],
    flavourNotes: ['sour', 'fruity'],
  },
  {
    id: 'bg-menu-mez-and-mace',
    name: 'Mez & Mace',
    section: 'Desi Cocktails',
    kind: 'cocktail',
    ingredients: ['mezcal', 'house-made mace cordial'],
    flavourNotes: ['spicy', 'smoky'],
  },
  {
    id: 'bg-menu-malabar-mood',
    name: 'Malabar Mood',
    section: 'Desi Cocktails',
    kind: 'cocktail',
    ingredients: [
      "Dewar's White Label",
      'curry leaf',
      'orange',
      'pineapple',
      'coconut',
    ],
    flavourNotes: ['fruity', 'earthy'],
  },
  {
    id: 'bg-menu-aamrakhand-old-fashioned',
    name: 'Aamrakhand Old Fashioned',
    section: 'Desi Cocktails',
    kind: 'cocktail',
    ingredients: ["Dewar's White Label", 'aamrakhand', 'nutmeg', 'cardamom'],
    flavourNotes: ['sweet', 'fruity'],
  },
  {
    id: 'bg-menu-bengal-summer',
    name: 'Bengal Summer',
    section: 'Desi Cocktails',
    kind: 'cocktail',
    ingredients: ['gin', 'raw mango', 'panchporan puree'],
    flavourNotes: ['sour', 'spicy'],
  },
  {
    id: 'bg-menu-pandan-pour',
    name: 'Pandan Pour',
    section: 'Desi Cocktails',
    kind: 'cocktail',
    ingredients: ["Dewar's White Label", 'pandan rosoo', 'coconut Campari'],
    flavourNotes: ['umami', 'herbal'],
  },
  {
    id: 'bg-menu-peru-picante',
    name: 'Peru Picante',
    section: 'Desi Cocktails',
    kind: 'cocktail',
    ingredients: [
      'Camino Blanco',
      'pink guava juice',
      'coriander tincture',
      'chilli shrub',
    ],
    flavourNotes: ['spicy', 'fruity'],
  },
  {
    id: 'bg-menu-smoked-murabba',
    name: 'Smoked Murabba',
    section: 'Desi Cocktails',
    kind: 'cocktail',
    ingredients: ['vodka', 'smoked orange marmalade', 'lime'],
    flavourNotes: ['sour', 'smoky'],
  },
  {
    id: 'bg-menu-til-gud-martini',
    name: 'Til Gud Martini',
    section: 'Desi Cocktails',
    kind: 'cocktail',
    ingredients: ['sesame whiskey', 'jaggery syrup', 'coffee'],
    flavourNotes: ['bitter', 'earthy'],
  },
  {
    id: 'bg-menu-kairi-thecha-picante',
    name: 'Kairi Thecha Picante',
    section: 'Desi Cocktails',
    kind: 'cocktail',
    ingredients: ['Camino Blanco', 'kairi thecha cordial'],
    flavourNotes: ['spicy', 'sour'],
  },
  {
    id: 'bg-menu-spiced-imli-margarita',
    name: 'Spiced Imli Margarita',
    section: 'Desi Cocktails',
    kind: 'cocktail',
    ingredients: [
      'Camino Gold',
      'tamarind',
      'jalapeños',
      'cilantro cordial',
      'soda',
    ],
    flavourNotes: ['spicy', 'sour'],
  },
  {
    id: 'bg-menu-memsaabs-favourite-pink-gin',
    name: "Memsaab's Favourite Pink Gin",
    section: 'Desi Cocktails',
    kind: 'cocktail',
    ingredients: ['gin', 'aromatic bitters', 'tonic water'],
    flavourNotes: ['fruity', 'floral'],
  },
  {
    id: 'bg-menu-nutty-port-manhattan',
    name: 'Nutty Port Manhattan',
    section: 'Desi Cocktails',
    kind: 'cocktail',
    ingredients: ["Dewar's White Label", 'hazelnut', 'rosemary', 'spiced foam'],
    flavourNotes: ['herbal', 'smoky'],
  },
  {
    id: 'bg-menu-peach-julep',
    name: 'Peach Julep',
    section: 'Desi Cocktails',
    kind: 'cocktail',
    ingredients: [
      "Dewar's White Label",
      'peach',
      'mint leaves',
      'aromatic bitters',
      'lime',
    ],
    flavourNotes: ['floral', 'fruity'],
  },
  {
    id: 'bg-menu-hibiscus-paloma',
    name: 'Hibiscus Paloma',
    section: 'Angrezi Cocktails',
    kind: 'cocktail',
    ingredients: ['Camino Gold', 'grapefruit', 'hibiscus', 'chilli'],
    flavourNotes: ['spicy', 'floral'],
  },
  {
    id: 'bg-menu-after-hours',
    name: 'After Hours',
    section: 'Angrezi Cocktails',
    kind: 'cocktail',
    ingredients: ['Bacardi Black', 'coffee', 'white chocolate', 'cacao butter'],
    flavourNotes: ['smoky', 'earthy'],
  },
  {
    id: 'bg-menu-pom-sbagliato',
    name: 'Pom Sbagliato',
    section: 'Angrezi Cocktails',
    kind: 'cocktail',
    ingredients: [
      'gin',
      'Aperol',
      'pomegranate cordial',
      'sparkling wine',
      'soda',
    ],
    flavourNotes: ['sweet', 'fruity'],
  },
  {
    id: 'bg-menu-the-slow-sundown',
    name: 'The Slow Sundown',
    section: 'Angrezi Cocktails',
    kind: 'cocktail',
    ingredients: [
      'Bacardi Carta Blanca',
      'Aperol',
      'dark rum',
      'pineapple',
      'brown butter',
    ],
    flavourNotes: ['floral', 'earthy'],
  },
  {
    id: 'bg-menu-grapefruit-g-and-t',
    name: 'Grapefruit G&T',
    section: 'Zero Proof Cocktails',
    kind: 'zero_proof',
    ingredients: ['Sober pink gin', 'grapefruit', 'ginger', 'ginger ale'],
    flavourNotes: ['sweet', 'fruity', 'floral'],
  },
  {
    id: 'bg-menu-jamun-daiquiri',
    name: 'Jamun Daiquiri',
    section: 'Zero Proof Cocktails',
    kind: 'zero_proof',
    ingredients: ['Sober rum', 'jamun spice mix'],
    flavourNotes: ['spicy', 'fruity'],
  },
  {
    id: 'bg-menu-lychee-g-and-t',
    name: 'Lychee G&T',
    section: 'Zero Proof Cocktails',
    kind: 'zero_proof',
    ingredients: ['lychee', 'Sober gin', 'lime and lemon cordial', 'tonic'],
    flavourNotes: ['sour', 'fruity'],
  },
  {
    id: 'bg-menu-amber-highball',
    name: 'Amber Highball',
    section: 'Zero Proof Cocktails',
    kind: 'zero_proof',
    ingredients: ['lemongrass', 'tangerine', 'soda'],
    flavourNotes: ['sour', 'fruity'],
  },
  {
    id: 'bg-menu-pom-and-passion',
    name: 'Pom & Passion',
    section: 'Zero Proof Cocktails',
    kind: 'zero_proof',
    ingredients: ['passion fruit', 'pomegranate', 'curry leaf', 'lime', 'soda'],
    flavourNotes: ['sweet', 'fruity'],
  },
  {
    id: 'bg-menu-sober-bomba-e',
    name: 'Sober Bomba(e)',
    section: 'Pauwa Mocktails',
    kind: 'mocktail',
    ingredients: ['fresh watermelon', 'spiced kokum cordial'],
    flavourNotes: ['sour', 'fruity'],
  },
  {
    id: 'bg-menu-kairi-sherbet-2-0',
    name: 'Kairi Sherbet 2.0',
    section: 'Pauwa Mocktails',
    kind: 'mocktail',
    ingredients: ['kairi sherbet', 'ginger', 'jalapeños', 'soda'],
    flavourNotes: ['sour', 'spicy'],
  },
  {
    id: 'bg-menu-old-town-cooler',
    name: 'Old Town Cooler',
    section: 'Pauwa Mocktails',
    kind: 'mocktail',
    ingredients: ['fresh pineapple', 'house spice mix'],
    flavourNotes: ['sweet', 'fruity'],
  },
  {
    id: 'bg-menu-peru-mary',
    name: 'Peru Mary',
    section: 'Pauwa Mocktails',
    kind: 'mocktail',
    ingredients: [
      'guava juice',
      'Worcestershire sauce',
      'coriander',
      'Tabasco',
    ],
    flavourNotes: ['spicy', 'fruity'],
  },
  {
    id: 'bg-menu-phool-berries',
    name: 'Phool Berries',
    section: 'Desi Mocktails',
    kind: 'mocktail',
    ingredients: ['berry purée', 'hibiscus', 'lime'],
    flavourNotes: ['sour', 'floral'],
  },
  {
    id: 'bg-menu-tropical-ananas',
    name: 'Tropical Ananas',
    section: 'Desi Mocktails',
    kind: 'mocktail',
    ingredients: ['pineapple', 'orange', 'thyme', 'strawberry'],
    flavourNotes: ['sweet', 'fruity'],
  },
  {
    id: 'bg-menu-masala-cola',
    name: 'Masala Cola',
    section: 'Desi Mocktails',
    kind: 'mocktail',
    ingredients: ['house spice mix', 'cola'],
    flavourNotes: ['spicy'],
  },
  {
    id: 'bg-menu-kairi-sherbet',
    name: 'Kairi Sherbet',
    section: 'Desi Mocktails',
    kind: 'mocktail',
    ingredients: ['kairi syrup', 'house spice mix', 'lime', 'soda'],
    flavourNotes: ['sour', 'fruity'],
  },
  {
    id: 'bg-menu-mango-lassi',
    name: 'Mango Lassi',
    section: 'Desi Mocktails',
    kind: 'mocktail',
    ingredients: ['sweetened yoghurt', 'mango pulp'],
    flavourNotes: ['sweet', 'fruity'],
  },
  {
    id: 'bg-menu-buttery-santra-biscuit',
    name: 'Buttery Santra Biscuit',
    section: 'Desi Mocktails',
    kind: 'mocktail',
    ingredients: ['orange juice', 'brown butter syrup', 'lime', 'soda'],
    flavourNotes: ['sweet', 'fruity'],
  },
  {
    id: 'bg-menu-banana-and-kiwi-milkshake',
    name: 'Banana & Kiwi Milkshake',
    section: 'Desi Mocktails',
    kind: 'mocktail',
    ingredients: ['banana purée', 'kiwi', 'milk'],
    flavourNotes: ['sweet', 'fruity'],
  },
];
