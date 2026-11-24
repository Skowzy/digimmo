# Digimmo

Application web gratuite qui aide un **particulier qui fait construire sa maison** à l'agencer en 2D sur son terrain : terrain, pièces de plain-pied ou sur deux niveaux, portes, fenêtres, escalier et meubles. Les règles de base (maison dans le terrain, reculs, emprise au sol, surfaces minimales, chevauchements…) sont vérifiées en direct.

> ⚠️ Digimmo ne remplace ni un architecte ni un constructeur. Les plans produits sont **indicatifs** et ne valent pas conformité au PLU de votre commune.

Projet personnel, présenté pour le titre professionnel **Concepteur Développeur d'Applications** (RNCP niveau 6).

## Fonctionnalités prévues (V1)

- Comptes utilisateurs : inscription, connexion, mot de passe oublié, export et suppression des données (RGPD), rôle administrateur.
- Plusieurs projets par utilisateur.
- Terrain et paramètres d'urbanisme (reculs, emprise maximale) saisis par l'utilisateur.
- Éditeur 2D : pièces, étage optionnel, portes, fenêtres, escalier, catalogue de meubles, aimantation, annuler/rétablir.
- Validation automatique des règles, en direct dans le navigateur et faisant foi côté serveur.
- Export du plan en PDF et en image.

## Stack technique

| Couche | Technologies |
|---|---|
| Front | React 19, Vite, TypeScript, rendu du plan en SVG |
| Back | NestJS 11, API REST |
| Données | PostgreSQL (comptes, projets, catalogue) · MongoDB (documents de plan) |
| Métier partagé | Bibliothèque TypeScript `domain` (géométrie et règles), utilisée par le front et le back |
| Qualité | Développement piloté par les tests (TDD), Jest / Vitest, tests e2e de l'API |
| Livraison | Docker, GitHub Actions (CI/CD) |

## Structure du dépôt

Monorepo npm workspaces :

```
packages/domain/   géométrie et règles métier, partagées (à venir)
apps/back/         API NestJS
apps/front/        application React + Vite
docs/              conception et plans
```

## Démarrer en local

Prérequis : Node.js 22.12+, npm et Docker (PostgreSQL, MongoDB, Mailpit).

```bash
# Une seule installation, à la racine
npm install

# Variables d'environnement (valeurs de développement)
cp .env.example .env

# Bases de données et serveur de courriel de test
docker compose up -d

# Migrations : à venir (Task 3)

# API (http://localhost:3000)
npm run start:dev -w @digimmo/back

# Front (http://localhost:5173)
npm run dev -w @digimmo/front
```

Qualité, depuis la racine :

```bash
npm test            # tests unitaires de tous les workspaces
npm run lint
npm run typecheck
npm run build
```

Les courriers envoyés en local sont consultables dans Mailpit : http://localhost:8025.
Les tests e2e de l'API (`npm run test:e2e -w @digimmo/back`) utilisent les bases de `docker compose` (base `digimmo_test`).

## Documentation

- [Document de conception](docs/superpowers/specs/2026-11-23-digimmo-design.md) : intention, règles métier, architecture, design system, jalons.

## Méthode de travail

Développement en **TDD** : chaque comportement commence par un test qui échoue, puis le code minimal pour le faire passer, puis le refactoring. Les règles métier de `domain` servent aussi de jeux d'essai pour le dossier.
