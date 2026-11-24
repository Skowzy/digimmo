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

État actuel (squelettes) :

```
digimmo-back/    API NestJS
digimmo-front/   Application React + Vite
docs/            Conception et plans
```

Structure cible (monorepo, voir la conception) :

```
packages/domain/   géométrie et règles métier, partagées
apps/back/         API NestJS
apps/front/        application React
```

## Démarrer en local

Prérequis : Node.js 22+ et npm. (Docker sera nécessaire dès l'arrivée des bases de données.)

```bash
# API (http://localhost:3000)
cd digimmo-back
npm install
npm run start:dev

# Front (http://localhost:5173)
cd digimmo-front
npm install
npm run dev
```

Tests de l'API :

```bash
cd digimmo-back
npm test
```

Cette section sera mise à jour avec le passage en monorepo, docker compose et les variables d'environnement (`.env.example`).

## Documentation

- [Document de conception](docs/superpowers/specs/2026-11-23-digimmo-design.md) : intention, règles métier, architecture, design system, jalons.

## Méthode de travail

Développement en **TDD** : chaque comportement commence par un test qui échoue, puis le code minimal pour le faire passer, puis le refactoring. Les règles métier de `domain` servent aussi de jeux d'essai pour le dossier.
