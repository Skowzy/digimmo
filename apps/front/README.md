# Digimmo — front

Application React 19 + Vite + TypeScript. Le tracé du plan est rendu en SVG, les règles métier viennent de `@digimmo/domain`.

## Démarrer

Depuis la racine du dépôt (API et bases lancées, voir le `README.md` racine) :

```bash
npm run dev -w @digimmo/front   # http://localhost:5173
```

Vite redirige (proxy) toutes les requêtes `/api` vers l'API NestJS sur `http://localhost:3000` : le navigateur ne parle qu'à une seule origine, les cookies de session fonctionnent sans configuration CORS. L'origine du front doit correspondre à `FRONT_ORIGIN` dans `.env` (`http://localhost:5173`).

## Tests

```bash
npm test -w @digimmo/front        # Vitest + Testing Library + MSW + vitest-axe
npm run lint -w @digimmo/front
npm run typecheck -w @digimmo/front
```

Les appels réseau sont simulés par MSW (`src/test/server.ts`) ; `renderApp(chemin)` (`src/test/render.tsx`) monte l'application complète sur une route donnée. Chaque page est aussi vérifiée avec `axe` (accessibilité). `src/app/responsive.test.tsx` contrôle par lecture des feuilles de style qu'aucune largeur fixe supérieure à 360 px n'est déclarée ; le rendu réel à 360 px se vérifie à la main.

## Design system

Les composants (`src/ui/`) et les jetons (`src/styles/tokens.css`) sont présentés sur la page **`/design-system`** (http://localhost:5173/design-system) : boutons, champs, pastilles de règles, alertes, modale, cartes de projet, etc.

## Structure

- `src/app/` : routeur, coque d'application, gardes d'accès
- `src/pages/` : une page par route (accueil, authentification, projets, compte, catalogue admin)
- `src/ui/` : composants du design system
- `src/lib/` : client d'API et hooks de données (TanStack Query)
- `src/styles/` : jetons de design et styles globaux
