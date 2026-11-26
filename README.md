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
packages/domain/   géométrie et règles métier, partagées (compilée à l'installation)
apps/back/         API NestJS
apps/front/        application React + Vite
docs/              conception et plans
```

## Démarrer en local

Prérequis : Node.js 22.12+, npm et Docker (PostgreSQL, MongoDB, Mailpit).

```bash
# Installation à la racine (compile aussi packages/domain via son script « prepare »)
npm install

# Variables d'environnement (valeurs de développement)
cp .env.example .env

# Bases de données et serveur de courriel de test
docker compose up -d

# Schéma PostgreSQL (migrations) : à refaire après chaque nouvelle migration
npm run migration:run -w @digimmo/back

# Catalogue de meubles + premier administrateur (facultatif : renseigner
# ADMIN_EMAIL et ADMIN_PASSWORD (10 caractères minimum) dans .env ou devant la commande)
ADMIN_EMAIL=moi@exemple.fr ADMIN_PASSWORD='un-mot-de-passe-solide' npm run seed -w @digimmo/back

# API (http://localhost:3000, préfixe /api)
npm run start:dev -w @digimmo/back

# Front (http://localhost:5173)
npm run dev -w @digimmo/front
```

L'API ne crée pas les tables toute seule : sans l'étape de migration, elle démarre mais les requêtes échouent.

Qualité, depuis la racine :

```bash
npm test            # tests unitaires de tous les workspaces
npm run lint
npm run typecheck
npm run build
```

Front : le serveur de développement (`npm run dev -w @digimmo/front`) redirige `/api` vers l'API (proxy Vite) ; `FRONT_ORIGIN` doit valoir `http://localhost:5173`. Les tests du front sont lancés par `npm test` (ou `npm test -w @digimmo/front`) et la page `/design-system` présente les composants. Détails dans [apps/front/README.md](apps/front/README.md).

Les courriers envoyés en local sont consultables dans Mailpit : http://localhost:8025.
Les tests e2e de l'API (`npm run test:e2e -w @digimmo/back`) utilisent les bases de `docker compose` (base `digimmo_test`).

## Éditeur

L'éditeur 2D s'ouvre depuis un projet (`/projets/:id`). Le plan est dessiné en SVG ; les règles du `@digimmo/domain` sont réévaluées à chaque modification.

**Outils** (barre d'outils ou touche) : Sélection (`V`), Pièce (`P`), Porte (`D`), Fenêtre (`F`), Meuble (`M`), Escalier (`E`, disponible dès qu'un étage existe).

**Gestes à la souris**
- Pièce : glisser pour tracer (aimantation à la grille de 10 cm et aux bords des autres pièces) ; un simple clic crée une pièce de 3 × 3 m. L'outil repasse en Sélection.
- Sélection : cliquer pour sélectionner, glisser pour déplacer, tirer une poignée pour redimensionner une pièce ou l'escalier.
- Porte / Fenêtre : cliquer sur un mur (une fenêtre seulement sur un mur extérieur) ; glisser l'ouverture pour la faire coulisser le long du mur.
- Meuble : choisir un meuble dans la palette du catalogue, puis cliquer dans le plan (la palette reste armée pour poser plusieurs meubles, `Échap` la désarme).
- Escalier : glisser sur l'étage ou le rez-de-chaussée ; il doit se trouver dans une pièce aux deux niveaux.
- Vue : boutons Zoom avant / arrière / Ajuster au terrain, `Espace` + glisser pour déplacer la vue.

**Panneaux** : *Propriétés* (nom, type, position et dimensions en mètres, charnière et sens d'ouverture des portes, rotation des meubles ; valeur validée à la perte du focus ou sur `Entrée`, `Échap` restaure), *Règles* (erreurs puis alertes ; cliquer sur une ligne sélectionne l'élément concerné, y compris sur l'autre niveau), *Meubles* (catalogue).

**Niveaux et escalier** : le plan compte le rez-de-chaussée et, au plus, un étage (« + Étage », « Retirer l'étage » avec confirmation). Une pièce d'étage doit reposer sur le rez-de-chaussée ; l'escalier est unique et commun aux deux niveaux. Retirer l'étage est annulable.

**Sauvegarde automatique** : 3 secondes après la dernière modification, le plan est envoyé à l'API (`PUT /api/projects/:id/plan`). L'indicateur d'état affiche « Modifications non enregistrées », « Enregistrement… », « Enregistré » ou l'erreur avec un bouton de nouvel essai (après une erreur réseau ou serveur, un nouvel essai automatique a lieu toutes les 10 secondes) ; `Ctrl/Cmd + S` ou le bouton « Enregistrer » force l'enregistrement. Quitter la page avec des modifications non enregistrées ouvre une modale (Rester, Quitter sans enregistrer, Enregistrer et quitter) et déclenche l'avertissement du navigateur à la fermeture de l'onglet.

**Limites par niveau** : 100 pièces, 200 ouvertures, 500 meubles (un message l'indique à l'atteinte de la limite).

**Raccourcis clavier** : `V P D F M E` choisissent l'outil, `R` tourne le meuble sélectionné, les flèches déplacent la sélection de 10 cm (`Maj` + flèche : 1 cm), `Suppr` / `Retour arrière` supprime, `Échap` annule le geste, désarme le meuble ou désélectionne, `Ctrl/Cmd + Z` annule, `Ctrl/Cmd + Maj + Z` ou `Ctrl/Cmd + Y` rétablit, `Ctrl/Cmd + S` enregistre. La touche `?` (ou le bouton « ? » de la barre d'outils) affiche la liste complète.

Le parcours de bout en bout (trois pièces collées, porte, lit, étage, escalier, sauvegarde automatique) est vérifié par `apps/front/src/features/editor/EditorPage.flow.test.tsx`.

## Documentation

- [Document de conception](docs/superpowers/specs/2026-11-23-digimmo-design.md) : intention, règles métier, architecture, design system, jalons.

## Méthode de travail

Développement en **TDD** : chaque comportement commence par un test qui échoue, puis le code minimal pour le faire passer, puis le refactoring. Les règles métier de `domain` servent aussi de jeux d'essai pour le dossier.
