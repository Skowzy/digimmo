# Digimmo — Document de conception

Date : 2026-11-23 · Échéance projet (rendu / soutenance CDA) : ~2027-01-30

## 1. Intention

Digimmo est une application web gratuite, non lucrative, qui permet à un **particulier préparant la construction de sa maison** d'agencer celle-ci en 2D sur son terrain : terrain, pièces de plain-pied ou sur deux niveaux, portes, fenêtres, escalier, meubles. L'objectif est de se faire une idée concrète et d'arriver chez l'architecte ou le constructeur avec un plan de travail. **Ce n'est pas un outil d'architecte** : pas de plans cotés de permis de construire, pas de prétention technique ou réglementaire. Un avertissement le rappelle dans l'application.

Référence : archifacile.fr. On s'inspire de ce qui y fonctionne (éditeur simple, pièces à la souris), mais on vise une interface nettement plus soignée : l'UI d'archifacile est jugée trop « vide ».

Double usage :
- **outil réel** : l'auteur s'en servira pour son propre projet de maison à étage ;
- **projet support du titre professionnel Concepteur Développeur d'Applications** (RNCP niv. 6). Il doit donc démontrer les trois blocs du référentiel : interfaces (maquettes, composants, accessibilité), application en couches (BDD SQL et NoSQL, accès aux données, logique métier, sécurité), déploiement (tests, CI/CD, mise en production).

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs (V1)**
- Comptes utilisateurs : inscription, connexion, déconnexion, **mot de passe oublié** (lien par e-mail), **suppression du compte et export des données** (RGPD), **rôle administrateur** (gestion du catalogue de meubles).
- Plusieurs projets par utilisateur, sauvegardés en base.
- Terrain rectangulaire (polygone si le temps le permet), paramètres PLU saisis par l'utilisateur.
- Maison **de plain-pied ou à étage** (au plus RDC + R+1), au choix de l'utilisateur ; pièces rectangulaires, portes, fenêtres, escalier (si étage), meubles.
- Validation automatique et visible en direct de toutes les règles métier (§5), revalidée côté serveur à l'enregistrement.
- Export PDF/image du plan.
- Interface soignée et cohérente, appuyée sur un mini design system (§7).

**Non-objectifs**
- Génération automatique de plans à partir de critères.
- 3D (une vue Three.js simple est un bonus possible tout à la fin, jamais avant).
- Rotation libre (seulement les quarts de tour), pièces non rectangulaires, plus de deux niveaux.
- Partage d'un projet entre plusieurs comptes (bonus éventuel).
- Règles d'urbanisme codées en dur par commune.

**Anti-objectifs** (échec même si « ça marche »)
- Un outil qui semble professionnel et laisse croire qu'un plan validé est conforme au PLU ou constructible.
- Une interface aussi vide ou générique qu'archifacile.
- Des règles vérifiées seulement dans le navigateur : le serveur reste juge.
- Un périmètre qui déborde l'échéance : mieux vaut une V1 complète, testée et déployée qu'un éditeur riche à moitié fini.

## 3. Contraintes

- Échéance ~2027-01-30 (≈ 9 semaines), un seul développeur, sur son temps libre.
- Stack existante (squelettes vierges) : NestJS 11 (`digimmo-back`), React 19 + Vite + TypeScript (`digimmo-front`).
- Doit produire les livrables du dossier CDA : maquettes, MCD/MLD, jeux d'essai, tests, documentation de déploiement.
- Langue de l'interface : français.

## 4. Approches envisagées

| | Base de données | Rendu du plan | Bilan |
|---|---|---|---|
| **1 (retenue)** | PostgreSQL (comptes, projets, catalogue, PLU) + MongoDB (documents de plan, versions) | SVG dans React | Chaque base a un rôle naturel ; démontre SQL **et** NoSQL comme le référentiel l'attend ; le SVG réutilise les variables CSS du design system, s'exporte proprement et se teste comme du DOM. Coût : deux bases à opérer. |
| 2 | Tout dans PostgreSQL (plan en JSONB) | SVG | Plus simple à déployer, mais ne démontre pas le NoSQL. |
| 3 | Comme 1 | Canvas via Konva | Glisser/transformer fournis, performant à grande échelle ; mais style hors CSS (design system dupliqué en JS), tests UI plus durs, et l'échelle (quelques centaines d'objets) ne le justifie pas. |

**Choix de l'utilisateur : approche 1.** Le NoSQL n'est pas obligatoire pour le titre, mais c'est un plus. L'auteur accepte le surcoût en temps.

Socle commun : **monorepo** avec une bibliothèque `domain` partagée (géométrie + règles), consommée par le front (feedback en direct) et par le back (validation faisant foi).

## 5. Domaine et règles métier

### 5.1 Modèle géométrique
- Unité interne : **centimètre entier** (aucun flottant dans les coordonnées → pas d'erreurs d'arrondi dans les comparaisons). Affichage en mètres avec virgule (`4,20 m`), surfaces en m².
- Repère : origine en haut à gauche du terrain, x vers la droite, y vers le bas.
- **Terrain** : rectangle `largeur × profondeur` en V1 (le modèle stocke un polygone pour que le passage aux polygones ne casse pas le format). Un côté est désigné « côté voie » (rue).
- **Niveau** : `RDC` ou `R+1`. Chaque niveau contient des pièces, ouvertures, meubles. Un projet démarre **de plain-pied** (RDC seul). L'utilisateur peut ajouter un étage (bouton « + Étage ») ou le retirer : le retrait supprime son contenu et l'escalier, après confirmation.
- **Pièce** : rectangle aligné sur les axes (`x, y, largeur, hauteur`), un type (séjour, cuisine, chambre, SdB, WC, entrée, dégagement, garage, autre) et un nom.
- **Murs** : dérivés des côtés des pièces, ils ne sont pas dessinés à la main. Un côté commun à deux pièces est un mur intérieur ; un côté qui ne touche aucune autre pièce du niveau est un mur extérieur. Épaisseur purement graphique en V1.
- **Segment de mur** *(choix du concepteur)* : les côtés des pièces sont découpés aux points où un voisin commence ou s'arrête. Ex. un côté de 6 m dont 3 m touchent une autre pièce donne un segment intérieur de 3 m et un segment extérieur de 3 m. Les segments sont **calculés**, jamais stockés.
- **Ouverture** : porte ou fenêtre, stockée par sa **géométrie** et non par sa pièce : `{ niveau, orientation (h|v), coordonnée fixe, début, largeur }`. La pièce ou le segment qui la porte est retrouvé au calcul ; une porte intérieure appartient donc aux deux pièces. Si une pièce bouge et que l'ouverture n'est plus sur aucun segment, c'est une violation (règle 9), pas une suppression silencieuse. Une porte a un sens d'ouverture (gauche/droite, intérieur/extérieur) qui détermine son arc.
- **Escalier** : n'existe que si le projet a un étage. Objet rectangulaire présent **à la même position sur les deux niveaux** (une seule entité, dessinée sur chaque niveau).
- **Meuble** : instance d'un élément du catalogue, rectangle (`x, y, largeur, profondeur`) avec rotation ∈ {0, 90, 180, 270}. Rattaché à la pièce qui le contient ; déplacer une pièce déplace ses meubles.

### 5.2 Règles (bibliothèque `domain`, fonctions pures)
Chaque règle renvoie une liste de violations `{ code, gravité: erreur|alerte, message, objets concernés }`.

Terrain et implantation (RDC) :
1. **Dans le terrain** : l'emprise de la maison est entièrement dans le terrain.
2. **Recul sur voie** ≥ paramètre PLU.
3. **Recul sur limites séparatives** ≥ paramètre PLU (les trois autres côtés).
4. **Emprise au sol** ≤ % max du terrain (paramètre PLU) ; alerte à partir de 90 % du max.

Pièces :
5. **Pas de chevauchement** entre pièces d'un même niveau (contact bord à bord autorisé).
6. **Surface minimale** par type (valeurs par défaut modifiables, ex. chambre ≥ 9 m²).
7. **Étage au-dessus du RDC** : chaque pièce du R+1 est entièrement au-dessus de l'emprise du RDC.

Ouvertures :
8. Une **fenêtre** n'est posée que sur un mur extérieur ; une **porte** sur n'importe quel mur.
9. Une ouverture tient entièrement dans **un seul** segment de mur et ne chevauche pas une autre ouverture du même mur.
10. L'**arc d'ouverture d'une porte** n'est intersecté par aucun meuble.

Meubles et escalier :
11. Un meuble est **entièrement dans une pièce**.
12. **Pas de chevauchement** entre meubles, ni entre meuble et escalier.
13. L'escalier est dans l'emprise du RDC et dans une pièce (ou un dégagement) aux deux niveaux.
14. *(Alerte)* Un projet avec étage mais sans escalier est signalé.

Les règles 7, 13 et 14 ne s'appliquent qu'aux projets avec étage.

Les seuils (reculs, emprise, surfaces mini) sont des **paramètres du projet**, préremplis avec des valeurs courantes et modifiables. L'application ne prétend jamais connaître le PLU de la commune.

### 5.3 Jeux d'essai (exemples à reprendre dans le dossier)
- Terrain 20 × 30 m, recul voie 5 m, maison à 3 m de la voie → erreur règle 2.
- Deux pièces 400 × 300 se touchant bord à bord → valide ; décalées de 1 cm en recouvrement → erreur règle 5.
- Lit 160 × 200 tourné à 90° débordant de 10 cm d'une chambre 300 × 300 → erreur règle 11.
- Armoire dans l'arc d'une porte de 80 cm → erreur règle 10.

## 6. Architecture

```
digimmo/                      (monorepo, npm workspaces)
  packages/domain/            TS pur : types du plan, géométrie, règles, schéma de validation (zod)
  apps/back/                  NestJS (ex-digimmo-back)
  apps/front/                 React + Vite (ex-digimmo-front)
  docker-compose.yml          postgres + mongo (+ back/front en prod)
  .github/workflows/          CI
```

**Back (NestJS)** — API REST en couches (contrôleur → service → dépôt) :
- `auth` : inscription, connexion, déconnexion ; mot de passe haché (argon2) ; session par JWT dans un cookie `httpOnly`, `Secure`, `SameSite=Lax` ; limitation de débit sur la connexion et sur la demande de réinitialisation.
- **Mot de passe oublié** : jeton aléatoire à usage unique, stocké haché, valable 1 h, envoyé par e-mail. La réponse est identique, que l'adresse existe ou non. Fournisseur d'e-mail au choix du constructeur (gratuit ; en développement, un serveur SMTP de test comme Mailpit dans docker compose).
- **Compte (RGPD)** : export JSON de toutes les données de l'utilisateur (compte, projets, plans) ; suppression du compte avec confirmation par mot de passe, qui supprime en cascade projets (PostgreSQL) et plans (MongoDB).
- **Rôles** : `user` (défaut) et `admin`. Un guard NestJS par rôle. L'admin gère le catalogue de meubles (CRUD) depuis une page dédiée ; il n'a **pas** accès aux projets des autres. Le premier admin est créé par un script de seed, jamais via l'API publique.
- `projects` : CRUD des projets (PostgreSQL) avec contrôle d'appartenance : un utilisateur n'accède qu'à ses projets.
- `plans` : lecture/écriture du document de plan (MongoDB). À l'écriture : validation du **format** (schéma zod partagé, rejet de tout champ inconnu) puis des **règles** via `domain`. Le plan est enregistré même s'il viole des règles métier (c'est un brouillon), mais le résultat de validation est stocké et renvoyé ; un plan au format invalide est refusé (400).
- `catalog` : lecture du catalogue de meubles (PostgreSQL).
- Accès aux données : TypeORM ou Prisma pour PostgreSQL, Mongoose pour MongoDB (choix laissé au constructeur).

**Données**
- PostgreSQL : `user(id, email unique, password_hash, role, password_changed_at, created_at)`, `password_reset(id, user_id → user, token_hash, expires_at, used_at)`, `project(id, owner_id → user, name, terrain_polygon jsonb, street_edge int, setback_street_cm, setback_sides_cm, max_footprint_pct, min_areas_m2 jsonb, created_at, updated_at)`, `furniture_item(id, category, name, width_cm, depth_cm, symbol)`. `password_changed_at` sert à invalider les sessions émises avant un changement de mot de passe.
- MongoDB : collection `plans` (un document par projet, `projectId` unique) : `{ _id, projectId, levels: [{ name, rooms[], openings[], furniture[] }], stairs, validation: { violations[], checkedAt }, updatedAt }` ; `validation` est stockée dans le document de plan.
- *(Choix du concepteur)* **Répartition** : le terrain (polygone, un rectangle en V1) et les paramètres PLU vivent dans PostgreSQL, car ils sont saisis par formulaire et **modifiables après création**. Le plan vit dans MongoDB. Le **résultat de validation est stocké dans le document de plan**, ce qui évite d'écrire dans deux bases à chaque sauvegarde. Le serveur revalide en chargeant `project` (PostgreSQL) et `plan` (MongoDB) : à chaque sauvegarde du plan et à chaque modification du terrain ou du PLU.
- *(Choix du concepteur)* **Pas d'historique de versions en V1** : seul l'état courant est stocké. L'historique avec écran de restauration est un bonus.

**Front (React)**
- *(Choix du concepteur)* Cible : **ordinateur** (souris et clavier). Les pages hors éditeur sont responsives ; l'éditeur sur tablette ou téléphone n'est pas visé en V1.
- Routes : accueil, inscription/connexion, mot de passe oublié / réinitialisation, mon compte (export, suppression), tableau de bord (cartes projets), création de projet (assistant terrain + PLU), éditeur, administration du catalogue (admin), page catalogue du design system.
- Éditeur : SVG piloté par un état local (store unique, ex. Zustand ou `useReducer`) avec **annuler/rétablir**, aimantation sur grille (10 cm) et sur bords des pièces, zoom/déplacement de la vue, onglets RDC / R+1 affichés seulement si un étage existe (l'autre niveau visible en transparence), panneau des propriétés de l'objet sélectionné, panneau des règles (pastilles). Validation `domain` relancée à chaque modification ; sauvegarde explicite + sauvegarde automatique temporisée.
- Export : SVG du plan → PDF (ex. via `jspdf` + `svg2pdf`) et PNG, avec cartouche (nom du projet, niveau, surfaces, date, avertissement « document indicatif »).

## 7. Interface et design system

Direction visuelle **« Calque d'architecte »** (validée sur maquette) : fond papier crème, quadrillage léger, traits encre bleu nuit ; doit évoquer un vrai plan tout en restant une interface moderne.

- **Tokens couleurs** (variables CSS) : `papier #f4efe4`, `papier-2 #ebe4d4`, `trait #c9bfa8`, `encre #2b3a55`, `encre-2 #5a6680`, `sanguine #a33a2f` (erreur), `sauge #3f6b41` (valide), `ocre #845a10` (alerte), `blanc #fbf8f1` (surfaces de saisie). Sauge et ocre sont plus foncées que sur la maquette pour atteindre un contraste WCAG AA (≥ 4,5:1) sur papier, papier-2 et blanc.
- **Typographie** (famille IBM Plex, choix validé) : Plex Serif pour les titres seulement, Plex Sans pour toute l'interface, Plex Mono pour les cotes, dimensions et surfaces.
- **Composants** (React, avec variantes) : `Button` (primary / secondary / ghost / danger × md / sm), `Field` (style « ligne de cote », état erreur + message), `RuleBadge` (ok / alerte / erreur), `ToolButton` (barre d'outils, état actif), `ProjectCard`. On en ajoute au besoin (Modal, Tabs, Panel…), toujours dans le même système, jamais de style ad hoc.
- Page **catalogue** listant tous les composants et tokens (référence pendant le développement, capture pour le dossier).
- Accessibilité : contrastes vérifiés (WCAG AA) sur les tokens, navigation clavier hors canvas, couleur jamais seule porteuse d'information (pastilles avec icône ✓ / ! / ✗ et texte).
- Maquettes de référence : `.superpowers/brainstorm/…/direction-visuelle.html` et `design-system-v1.html`. Les maquettes écran par écran du dossier restent à produire.

## 8. Qualité, CI/CD, déploiement

- **Méthode : TDD** (choix de l'utilisateur). Chaque comportement suit le cycle test qui échoue → code minimal → refactoring, en priorité sur `domain` (règles et géométrie), les services et les contrôleurs NestJS (droits d'accès inclus) et la logique de l'éditeur (store, aimantation, annuler/rétablir). Pour le rendu visuel pur (SVG, styles), un test léger après coup suffit. L'historique git doit montrer le cycle, c'est un argument pour le dossier.
- Tests unitaires de `domain` (cœur du dossier, couverture élevée), tests unitaires des services NestJS, tests e2e API (supertest) sur auth + droits d'accès aux projets, quelques tests de composants front.
- CI (GitHub Actions) : lint, typecheck, tests, build à chaque push ; déploiement sur la branche principale.
- **Docker dès la semaine 1** :
  - `docker-compose.yml` pour le **développement** : PostgreSQL, MongoDB, Mailpit (e-mails de test). Une seule commande pour tout lancer ; le back et le front tournent en local en mode watch.
  - **Images de production** multi-étapes : `back` (build TypeScript puis image Node allégée, utilisateur non-root) et `front` (build Vite puis fichiers statiques servis par Nginx, qui fait aussi proxy vers l'API).
  - `docker-compose.prod.yml` : les deux images + les bases avec volumes persistants, secrets via variables d'environnement (`.env.example` documenté).
  - CI : build des images à chaque push, publication sur GitHub Container Registry depuis la branche principale, déploiement sur l'hébergeur.
- Hébergement laissé au constructeur (VPS avec docker compose, ou images sur un service gérant les conteneurs avec bases managées). Contrainte : gratuit ou quasi gratuit.
- Sécurité : validation stricte des entrées (DTO + schéma zod), contrôle d'appartenance sur chaque ressource, cookies sécurisés, CORS restreint, en-têtes de sécurité (helmet), secrets hors dépôt.

## 9. Jalons indicatifs (9 semaines)

1. S1 : monorepo, Docker, CI, design system + page catalogue, maquettes écrans.
2. S2 : `domain` : modèle, géométrie, règles 1–7 + tests.
3. S3 : back : auth (dont mot de passe oublié, rôles, RGPD), projets, plans, catalogue + tests e2e. Semaine chargée : l'écran admin du catalogue peut glisser en S7.
4. S4–S5 : éditeur : terrain, pièces, niveaux, aimantation, annuler/rétablir, panneau des règles.
5. S6 : ouvertures, escalier, meubles + règles 8–13.
6. S7 : tableau de bord, création de projet, export PDF/PNG, sauvegarde auto.
7. S8 : déploiement, sécurité, accessibilité, corrections.
8. S9 : marge + dossier (bonus seulement si tout le reste est fini).

## 10. Laissé au constructeur

- ORM PostgreSQL (TypeORM ou Prisma), gestion d'état front, bibliothèque d'export PDF, hébergeur.
- Liste exacte du catalogue initial (~20 meubles : chambre, cuisine, SdB/WC, séjour) et symboles SVG.
- Valeurs par défaut des paramètres PLU et surfaces minimales.
- Détail des interactions de l'éditeur (raccourcis clavier, poignées de redimensionnement).
