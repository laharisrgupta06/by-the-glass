## Eliq WLA Assignment

A white-label drinks application built as a frontend assignment for Eliq.  
The project displays a list of alcoholic drinks and a detailed recipe page for each item using data from **TheCocktailDB API**.

The application follows a **WLA (White-Label App)** approach, meaning UI structure, branding, and page behavior can be configured through external JSON files. This makes the project reusable as a template for differently branded drink applications with minimal code changes.

---

## Built With

![Angular](https://img.shields.io/badge/angular-%23DD0031.svg?style=for-the-badge&logo=angular&logoColor=white)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NgRx](https://img.shields.io/badge/NgRx-SignalStore-BA2BD2?style=for-the-badge&logo=ngrx&logoColor=white)](https://ngrx.io/)
![RxJS](https://img.shields.io/badge/rxjs-%23B7178C.svg?style=for-the-badge&logo=reactivex&logoColor=white)
![Angular Material](https://img.shields.io/badge/Angular%20Material-UI-009688?style=for-the-badge&logo=angular&logoColor=white)
[![ESLint](https://img.shields.io/badge/ESLint-4B3263?style=for-the-badge&logo=eslint&logoColor=white)](https://eslint.org/)
![Jasmine](https://img.shields.io/badge/Jasmine-%238A4182.svg?style=for-the-badge&logo=jasmine&logoColor=white)
![Karma](https://img.shields.io/badge/Karma-%2358C4DC.svg?style=for-the-badge&logo=karma&logoColor=white)

---

## Features

### **Assignment Requirements**

- Drinks list screen  
  Displays a list of alcoholic drinks with:
  - Drink image
  - Drink name

- Drink details screen  
  Displays a selected drink with:
  - Drink image
  - Drink name
  - Ingredients
  - Instructions in multiple supported languages

- API-driven content  
  All drink information is fetched from TheCocktailDB API.

- White-Label App approach  
  The application supports configurable branding and UI behavior through JSON configuration files.

---

### **All Functionality**

- Angular 17 application generated with Angular CLI  
- TypeScript 5.3 for strongly typed development  
- NgRx Signal Store for modern state management  
- RxJS for reactive programming  
- Angular Material + SCSS for UI styling  
- Jasmine + Karma for unit testing  
- ESLint + Prettier for code quality and formatting  
- SSR-ready structure using Angular SSR  
- JSON-based branding system for flexible UI customization  

---

## API Specification

- API URL  
  https://www.thecocktaildb.com/api.php

- Filter drinks  
  https://www.thecocktaildb.com/api/json/v1/1/filter.php?a=Alcoholic

- Get drink by ID  
  https://www.thecocktaildb.com/api/json/v1/1/lookup.php?i={drinkId}

---

## API Reference

| API Name | Method | Reference |
| :------- | :----- | :-------- |
| `Alcoholic Drinks List` | `GET` | [Ref](https://www.thecocktaildb.com/api/json/v1/1/filter.php?a=Alcoholic) |
| `Drink Details by ID` | `GET` | [Ref](https://www.thecocktaildb.com/api/json/v1/1/lookup.php?i={drinkId}) |
| `TheCocktailDB Documentation` | `GET` | [Ref](https://www.thecocktaildb.com/api.php) |

---

## Run Locally

| Function | Description |
| :------- | :---------- |
| `npm install` | Install dependencies |
| `ng serve` | Run the app locally at `http://localhost:4200/` |
| `ng build` | Build the project |
| `ng test` | Run unit tests |
| `ng lint` | Run ESLint |
| `npm run lint:fix` | Fix lint issues automatically |
| `npm run prettier` | Format source files |

---

## Development Server

After starting the project:

```bash
ng serve
```
Navigate to:

bash
http://localhost:4200/

---

## White-Label App (WLA) Approach

This project was designed as a simple example of a **White-Label App**.

The goal is to make the application reusable and brandable through configuration instead of hardcoding UI behavior.  
Branding and layout customization are controlled through JSON files located in the `branding` folder.

### **Branding Configuration Files**

- `general.config.json`  
  Used for global application settings such as:
  - App title
  - Logo
  - Navbar layout
  - General layout behavior

- `product-list.config.json`  
  Used for configuring the drinks list page, such as:
  - Layout structure
  - Styling behavior
  - Card presentation

- `product-detail.config.json`  
  Used for configuring the drink details page, such as:
  - Ordering of sections/components
  - Visibility of UI blocks
  - Layout customization

---

## How the Branding System Works

- Requirements are defined in JSON configuration files inside the `branding` folder
- JSON files are imported using TypeScript path mapping
- `resolveJsonModule` is used to enable reading JSON modules in TypeScript
- Angular `InjectionToken` is used to provide configuration objects across the app through dependency injection

### **Implementation Details**

The config files are injected where needed, including:

- `app.config`
- `app.routes`
- Core components such as:
  - `navbar`
- Feature components such as:
  - `product-list`
  - `product-details`
  - `product-card`
- Services such as:
  - `product.service`

The configuration is then consumed in templates using Angular control flow syntax such as:

- `@if`
- `@for`

This allows the UI to dynamically render elements based on JSON-driven instructions.  
For example, the product details page can display components in a custom order based on the configuration file.

---

## Example WLA Capabilities

Using the branding JSON files, you can easily:

- Change the application title
- Replace the logo
- Update the navbar layout
- Reorder detail page sections
- Hide or show specific UI blocks
- Adjust the look and structure of list and detail pages

This makes the project suitable as a reusable **WL app template** rather than a single hardcoded implementation.

---

## Project Structure

bash
src
├── app
│   ├── core
│   │   ├── components
│   │   │   └── navbar
│   │   ├── config
│   │   ├── models
│   │   └── services
│   └── featured
│       └── products
│           ├── components
│           │   ├── product-card
│           │   ├── product-description
│           │   ├── product-image
│           │   ├── product-ingredients
│           │   ├── product-instructions
│           │   └── product-tags
│           ├── config
│           ├── models
│           ├── pages
│           │   ├── product-details
│           │   └── product-list
│           ├── services
│           └── store
├── assets
├── branding
└── styles

---

## Design Decisions

- **Angular 17** was chosen for a modern standalone-friendly architecture
- **NgRx Signal Store** was used to keep state management lightweight and reactive
- **RxJS** was used for API streams and asynchronous data handling
- **Angular Material** was used to accelerate UI development with a consistent design system
- **WLA architecture** was implemented to demonstrate reusability, configurability, and separation of branding from business logic

---

## Trade-Offs

- A JSON-driven WLA structure improves flexibility, but adds some complexity compared to a hardcoded UI
- The project focuses on assignment requirements and branding architecture, so it intentionally remains lightweight
- The current implementation is a practical example of white-labeling rather than a fully enterprise-ready theming engine

---

## Testing

| Tool | Purpose |
| :--- | :------ |
| `Jasmine` | Unit testing framework |
| `Karma` | Test runner |

Run tests with:

bash
ng test

---

* Assignment for [eliq](https://www.thecocktaildb.com/api/json/v1/1/filter.php?a=Alcoholic)](https://www.eliq.com/)
