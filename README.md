# By the Glass

By the Glass is a drink discovery application for exploring cocktail and mocktail recipes, discovering drinks through ingredients, and viewing detailed preparation instructions.

The project builds on an existing white-label drinks application and extends its foundation with additional functionality and improvements.

## Features

- Browse drink recipes
- Explore detailed drink information and preparation instructions
- Discover drinks using ingredients
- Support configurable branding and application settings
- Explore additional drink discovery features as development progresses

## Tech Stack

- Angular
- TypeScript
- NgRx
- RxJS
- Angular Material
- TheCocktailDB API
- Firebase and Firestore

## Project Development

This repository builds on an existing application originally developed by Zara Sarlak.

The original codebase provided the foundation for further development. Subsequent changes and additions are being developed and maintained in the `by-the-glass-dev` branch.

For the latest development work, select the `by-the-glass-dev` branch from the branch selector at the top of this repository.

## Repository Structure

- `master` — Original project branch
- `by-the-glass-dev` — Branch containing subsequent development work

## Publishing the venue menu

The restaurant's drinks (published with the owner's permission) live in one file: `src/app/featured/products/data/venue-menu/venue-menu.data.ts`. The Drinks page, search, filters, drink pages, What Can I Make? and the `/api/venue-menu` endpoint all read it, in development and production alike.

To add a drink:

1. Append it to the end of `VENUE_MENU_DRINKS`, with a new `id` starting `bg-menu-` (lowercase letters, digits and hyphens).
2. Never change or remove an existing `id`: saved drinks and links depend on it. To rename a drink, change only its `name`.
3. List ingredients and flavour notes as the menu writes them. Don't add quantities, methods or prices.
4. Run `npm test`. If a new ingredient lands on the "Everything else" shelf, give it a shelf in `src/app/featured/what-can-i-make/data/ingredient-categories.ts`.
5. Commit and push to `by-the-glass-dev`; the deployed site updates on its next build.

## Recipe photos

Photos on personal recipes are shrunk in the browser (at most 1024 px and 150 KB) and saved inside the recipe's own Firestore document, so they need no Cloud Storage and work on Firebase's free Spark plan. `firestore.rules` checks their type and size; deploy it whenever it changes.

## Acknowledgment

Credit to Zara Sarlak for the original project foundation.

This repository documents the continued development and extension of that application.
