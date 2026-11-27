# Plan 4 — Éditeur 2D : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Livrer l'éditeur de plan dans le front : terrain, pièces sur un ou deux niveaux, escalier, portes et fenêtres, meubles du catalogue, aimantation, zoom, annuler/rétablir, propriétés, règles en direct, sauvegarde explicite et automatique.

**Architecture :** Un état d'éditeur unique géré par un **réducteur pur** (`useReducer`) avec historique (passé / futur), testé sans React. Le rendu est un **SVG** dont le `viewBox` est en centimètres (le zoom et le déplacement changent le `viewBox`, jamais les données). Les gestes souris produisent un **aperçu** non historisé puis une seule action à la fin du geste. La validation `validatePlan` de `@digimmo/domain` est recalculée sur chaque plan validé (pas pendant l'aperçu). La sauvegarde passe par `PUT /api/projects/:id/plan`.

**Tech Stack :** React 19, TypeScript, SVG, TanStack Query (déjà en place), `@digimmo/domain`, Vitest + Testing Library + MSW (déjà en place). Aucune bibliothèque de dessin.

**Spec :** `docs/superpowers/specs/2026-11-23-digimmo-design.md` (§5 Domaine et règles, §6 Front — Éditeur, §7 Interface).

## Global Constraints

- Éditeur : SVG piloté par un état local, **annuler/rétablir**, **aimantation sur grille (10 cm)** et sur bords des pièces, **zoom/déplacement de la vue**, **onglets RDC / R+1 affichés seulement si un étage existe (l'autre niveau visible en transparence)**, panneau des propriétés de l'objet sélectionné, panneau des règles (pastilles), **validation `domain` relancée à chaque modification**, **sauvegarde explicite + sauvegarde automatique temporisée**.
- Un projet démarre **de plain-pied** ; « + Étage » ajoute le R+1 ; retirer l'étage supprime son contenu **et l'escalier, après confirmation**.
- Pièces, meubles, escalier : rectangles alignés ; rotation des meubles ∈ {0, 90, 180, 270} ; **déplacer une pièce déplace ses meubles**.
- Unités : centimètres entiers dans le plan ; affichage `formatMeters` / `formatArea` ; saisie en mètres via `parseMeters` (`src/lib/units.ts`).
- Le plan envoyé doit passer `parsePlan` (`@digimmo/domain`) : ids uniques, jamais `stairs`, ≤ 64 caractères ; ≤ 100 pièces, 200 ouvertures, 500 meubles par niveau ; coordonnées 0..100 000.
- Cible **ordinateur** (souris + clavier). Le canvas est exclu de l'exigence de navigation clavier complète, mais **tout objet doit être modifiable au clavier via le panneau des propriétés**.
- Design system uniquement (tokens, composants `src/ui`), aucune couleur en dur ; textes en français ; **la couleur n'est jamais seule porteuse d'information**.
- Toutes les requêtes passent par `api()` ; TDD (tests d'abord) — en priorité **le réducteur, l'aimantation, annuler/rétablir** ; pour le pur rendu SVG, un test léger suffit.

## Review Focus

1. **Aller-retour serveur** : un plan à deux niveaux avec escalier, portes, fenêtres et meubles, enregistré puis rechargé, est identique (mêmes ids, mêmes coordonnées). Test : Task 10.
2. **Geste interrompu** (pointeur relâché hors du canvas, `pointercancel`, perte de capture) → le geste est annulé proprement, aucun objet ne reste « collé » au curseur, aucune entrée d'historique fantôme. Test : Task 5.
3. **Annuler après une sauvegarde automatique** → le plan redevient « non enregistré » et repart à la sauvegarde ; l'historique survit aux sauvegardes. Test : Task 10.
4. **Limites du schéma** : ajouter la 101ᵉ pièce ou le 501ᵉ meuble d'un niveau est refusé avec un message, sans envoyer de plan invalide. Test : Tasks 5 et 9.
5. **Retirer l'étage** qui contient des pièces et l'escalier → confirmation obligatoire ; après confirmation, `stairs` vaut `null` et le plan passe `parsePlan`. Test : Task 7.

---

## Structure des fichiers (apps/front/src/features/editor)

```
EditorPage.tsx (+ .module.css, + test)     page /projets/:id : chargement, mise en page, sauvegarde
state/types.ts                              EditorState, Selection, Tool, Action
state/reducer.ts (+ test)                   réducteur pur + historique
state/EditorContext.tsx                     contexte (state, dispatch)
geometry/snap.ts (+ test)                   aimantation grille + bords
geometry/ids.ts (+ test)                    génération d'ids
geometry/svgPoint.ts                        écran → plan (centimètres)
canvas/PlanCanvas.tsx (+ test)              SVG : vue, grille, terrain, calques
canvas/RoomShape.tsx  canvas/OpeningShape.tsx  canvas/FurnitureShape.tsx  canvas/StairsShape.tsx
canvas/useGesture.ts (+ test)               glisser / redimensionner / dessiner, aperçu, annulation
panels/Toolbar.tsx  panels/LevelTabs.tsx  panels/PropertiesPanel.tsx  panels/RulesPanel.tsx
panels/CatalogPalette.tsx  panels/SaveStatus.tsx  panels/ShortcutsDialog.tsx   (+ tests)
save/useAutosave.ts (+ test)                sauvegarde explicite + automatique, sérialisée
```

`ProjectPage` (paramètres + violations) devient `ProjectSettingsPage` sur `/projets/:id/parametres`.

---

### Task 1: Page de l'éditeur et déplacement des paramètres

**Files :**
- Create : `src/features/editor/EditorPage.tsx` (+ css, + test), `src/features/editor/state/types.ts`
- Move : `src/pages/ProjectPage.tsx` → `src/pages/ProjectSettingsPage.tsx` (et son test, son css)
- Modify : `src/app/routes.tsx`, `src/ui/ProjectCard.tsx` (lien), `src/test/setup.ts`

**Interfaces — Produces :**
- Routes : `/projets/:id` → `EditorPage` ; `/projets/:id/parametres` → `ProjectSettingsPage` (contenu actuel inchangé, titre « Paramètres du projet »). La carte du tableau de bord pointe vers l'éditeur.
- `EditorPage` : charge `useProject(id)` et `usePlan(id)` ; chargement → « Chargement du plan… » (`role="status"`) ; 404 → « Projet introuvable. » + lien tableau de bord ; sinon mise en page en 3 zones : barre d'outils à gauche, canvas au centre, panneaux à droite (propriétés, règles), en-tête avec le nom du projet, un lien « Paramètres du projet » et l'emplacement de l'état de sauvegarde. Sous 900 px de large : message « L'éditeur est prévu pour un écran d'ordinateur. » au-dessus du canvas (l'éditeur reste utilisable).
- `types.ts` :
  ```ts
  export type Tool = 'select' | 'room' | 'door' | 'window' | 'furniture' | 'stairs'
  export type Selection = { kind: 'room' | 'opening' | 'furniture' | 'stairs'; id: string } | null
  export interface View { x: number; y: number; width: number; height: number }   // viewBox en cm
  export interface EditorState {
    plan: Plan; levelId: LevelId; tool: Tool; selection: Selection; view: View
    past: Plan[]; future: Plan[]; savedPlan: Plan; pendingFurniture: string | null   // catalogId à poser
  }
  ```
- `setup.ts` : polyfill jsdom de `SVGSVGElement.prototype.createSVGPoint` et `getScreenCTM` (matrice identité, `inverse()` identité) pour que les tests d'interaction tournent.

- [ ] **Step 1 : Tests qui échouent** — `/projets/p1` affiche le nom du projet et le canvas (`getByRole('img', { name: 'Plan du projet' })`) ; lien « Paramètres du projet » vers `/projets/p1/parametres` qui affiche le formulaire existant ; 404 → « Projet introuvable. » ; la carte du tableau de bord pointe vers `/projets/:id` ; tous les tests de l'ancienne `ProjectPage` passent sur la nouvelle route.
- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier le succès** (suite front complète).
- [ ] **Step 5 : Commit** — `feat(front): page de l'éditeur, paramètres du projet sur leur propre page`.

---

### Task 2: État de l'éditeur et historique

**Files :** Create `src/features/editor/state/reducer.ts` (+ test), `src/features/editor/state/EditorContext.tsx`

**Interfaces :**
- Consumes : `EditorState`, `Tool`, `Selection` (Task 1) ; types `Plan`, `Level`, `Room`, `Opening`, `Furniture`, `Rect` de `@digimmo/domain`.
- Produces :
  - `initEditor(plan: Plan, site: Site): EditorState` — `levelId: 'rdc'`, `tool: 'select'`, `selection: null`, vue = boîte du terrain + marge de 10 % ; `savedPlan = plan`.
  - `editorReducer(state: EditorState, action: Action): EditorState` avec `Action` =
    `{ type: 'setTool'; tool }` · `{ type: 'select'; selection }` · `{ type: 'setLevel'; levelId }` · `{ type: 'setView'; view }` ·
    `{ type: 'addRoom'; room }` · `{ type: 'updateRoom'; id; changes: Partial<Room> }` (déplacer une pièce translate aussi ses meubles et les ouvertures portées par ses seuls murs extérieurs — voir Task 5) ·
    `{ type: 'addOpening'; opening }` · `{ type: 'updateOpening'; id; changes }` ·
    `{ type: 'addFurniture'; furniture }` · `{ type: 'updateFurniture'; id; changes }` · `{ type: 'rotateFurniture'; id }` (rotation + 90 modulo 360) ·
    `{ type: 'setStairs'; rect: Rect | null }` · `{ type: 'addUpperLevel' }` · `{ type: 'removeUpperLevel' }` ·
    `{ type: 'deleteSelection' }` · `{ type: 'undo' }` · `{ type: 'redo' }` · `{ type: 'markSaved'; plan: Plan }` · `{ type: 'armFurniture'; catalogId: string | null }`.
  - Toute action qui modifie `plan` empile l'ancien plan dans `past` (max **100**, les plus anciens sont perdus) et vide `future` ; `undo`/`redo` ne touchent ni `savedPlan` ni la vue ; une action sans effet réel (même plan) n'empile rien.
  - `isDirty(state): boolean` — vrai si `plan` diffère structurellement de `savedPlan`.
  - `currentLevel(state): Level`.
  - `EditorProvider({ initial, children })`, `useEditor(): { state, dispatch }`.
  - `deleteSelection` : pièce → supprime aussi ses meubles ; `removeUpperLevel` → supprime le niveau `r1` et met `stairs` à `null`, `levelId` revient à `'rdc'` ; `addUpperLevel` sans effet si `r1` existe déjà.

- [ ] **Step 1 : Tests qui échouent (`reducer.test.ts`)** — ajout d'une pièce puis `undo` → plan initial et `redo` → pièce revenue ; 101 actions → `past.length === 100` ; `select` et `setView` n'empilent rien ; `updateRoom` avec les mêmes valeurs n'empile rien ; déplacer une pièce de (+100, +50) déplace son meuble d'autant ; `deleteSelection` sur une pièce supprime ses meubles ; `addUpperLevel` puis `removeUpperLevel` avec un escalier → `levels.length === 1`, `stairs === null`, `levelId === 'rdc'` ; `isDirty` faux après `markSaved`, vrai après une modification, faux après `undo` revenant au plan enregistré ; `rotateFurniture` 270 → 0.
- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter** (fonctions pures, immutables ; égalité structurelle par comparaison JSON suffisante à cette échelle).
- [ ] **Step 4 : Vérifier le succès.**
- [ ] **Step 5 : Commit** — `feat(front): état de l'éditeur avec annuler/rétablir`.

---

### Task 3: Aimantation, coordonnées et identifiants

**Files :** Create `src/features/editor/geometry/snap.ts` (+ test), `src/features/editor/geometry/ids.ts` (+ test), `src/features/editor/geometry/svgPoint.ts`

**Interfaces — Produces :**
- `GRID_CM = 10`.
- `snapValue(v: number): number` — arrondi au multiple de 10 cm le plus proche.
- `snapRect(rect: Rect, others: Rect[], thresholdCm: number): Rect` — aligne chaque bord du rectangle déplacé sur le bord parallèle le plus proche d'un autre rectangle (gauche/droite/haut/bas, bord à bord ou alignés) si la distance ≤ `thresholdCm`, sinon sur la grille ; conserve largeur et hauteur ; renvoie des entiers.
- `snapResize(rect: Rect, edge: 'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw', point: Point, others: Rect[], thresholdCm: number, minCm = 50): Rect` — déplace le ou les bords tirés ; taille ≥ `minCm`.
- `screenThreshold(view: View, svgWidthPx: number, px = 8): number` — 8 pixels écran convertis en cm selon le zoom.
- `svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point` — via `getScreenCTM().inverse()`, arrondi au cm.
- `newId(prefix: 'r' | 'o' | 'f', existing: Set<string>): string` — `prefix + 8 caractères base36` aléatoires, jamais `stairs`, unique dans `existing`.
- `nextRoomName(rooms: Room[]): string` — « Pièce 1 », « Pièce 2 »… (premier numéro libre).

- [ ] **Step 1 : Tests qui échouent** — `snapValue(14)` = 10, `(15)` = 20, `(-4)` = 0 ; rectangle à 6 cm à droite d'un voisin avec seuil 8 → collé bord à bord ; à 12 cm → aligné sur la grille ; largeur conservée ; `snapResize` côté `e` vers un point à 3 cm du bord gauche d'un voisin → collé ; taille minimale 50 respectée ; `newId` sur 1 000 tirages : aucun doublon, jamais `stairs`, longueur ≤ 64 ; `nextRoomName` avec « Pièce 1 » et « Pièce 3 » → « Pièce 2 ».
- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier le succès.**
- [ ] **Step 5 : Commit** — `feat(front): aimantation sur grille et sur bords, identifiants de l'éditeur`.

---

### Task 4: Canvas : vue, terrain, pièces, zoom et déplacement

**Files :** Create `src/features/editor/canvas/PlanCanvas.tsx` (+ css, + test), `canvas/RoomShape.tsx`

**Interfaces :**
- Consumes : `useEditor`, `currentLevel` (Task 2), `View` ; `Site`, `RuleParams`, `Violation`, `formatArea`.
- Produces :
  - `PlanCanvas({ site, rules, violations })` : `<svg role="img" aria-label="Plan du projet" viewBox={view}>` avec, dans l'ordre : quadrillage (motif 10 cm, plus marqué tous les 1 m), contour du terrain (trait pointillé), lignes de recul (voie et limites séparatives, pointillé plus fin) **avec légende textuelle** « Recul voie 5,00 m », pièces de l'autre niveau à 30 % d'opacité (non cliquables), pièces du niveau courant (`RoomShape` : rectangle, nom, surface en Plex Mono), contour de sélection.
  - Les objets cités dans une violation d'erreur ont la classe `.enErreur` (trait `--sanguine`, motif hachuré pour ne pas reposer sur la seule couleur).
  - Zoom : molette (facteur 1,2 par cran, centré sur le curseur), boutons « Zoom avant », « Zoom arrière », « Ajuster au terrain » ; bornes : de 25 % à 800 % de la vue « ajustée ». Déplacement : glisser avec le bouton du milieu ou espace + glisser.

- [ ] **Step 1 : Tests légers** — rend une pièce du RDC avec son nom et « 24,00 m² » ; une pièce en erreur porte `.enErreur` ; avec un R+1, les pièces du RDC apparaissent atténuées quand `levelId === 'r1'` ; « Zoom avant » réduit `view.width` d'un facteur 1,2 ; impossible de dépasser 800 % ; « Ajuster au terrain » revient à la vue initiale.
- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier le succès** + contrôle visuel dans le navigateur (port 5174, serveurs arrêtés ensuite).
- [ ] **Step 5 : Commit** — `feat(front): canvas SVG du plan avec zoom et déplacement`.

---

### Task 5: Dessiner, sélectionner, déplacer et redimensionner les pièces

**Files :** Create `src/features/editor/canvas/useGesture.ts` (+ test), `panels/Toolbar.tsx` (+ test) ; Modify `PlanCanvas.tsx`, `RoomShape.tsx`, `state/reducer.ts`

**Interfaces :**
- Consumes : `snapRect`, `snapResize`, `screenThreshold`, `svgPoint`, `newId`, `nextRoomName` (Task 3) ; actions du réducteur (Task 2).
- Produces :
  - `Toolbar` : `ToolButton` pour Sélection (V), Pièce (P), Porte (D), Fenêtre (F), Meuble (M), Escalier (E, désactivé sans étage), Annuler, Rétablir ; `role="toolbar"`, `aria-label="Outils"`.
  - Outil Pièce : glisser dessine un rectangle aimanté (aperçu en pointillé) ; un simple clic crée une pièce 300 × 300 centrée ; à la fin : `addRoom` (type `autre`, nom `nextRoomName`) et sélection de la nouvelle pièce ; retour à l'outil Sélection.
  - Outil Sélection : clic sur une pièce → sélection ; glisser → déplacement aimanté ; 8 poignées de redimensionnement sur la pièce sélectionnée ; clic dans le vide → désélection. **Un geste = une entrée d'historique.**
  - Déplacer une pièce translate ses meubles et les ouvertures situées sur ses murs **extérieurs** (segments dont `roomIds` ne contient qu'elle) ; les portes intérieures restent en place (la règle `OPENING_NOT_ON_WALL` les signalera).
  - `pointercancel`, `lostpointercapture` ou touche Échap pendant un geste → **annulation** (aperçu effacé, aucune action envoyée).
  - Au-delà de **100 pièces** sur le niveau : la création est refusée avec `Alert` « Limite de 100 pièces par niveau atteinte. ».

- [ ] **Step 1 : Tests qui échouent** — glisser de (100,100) à (412,307) avec l'outil Pièce → une pièce `{ x: 100, y: 100, w: 310, h: 210 }` (aimantée), sélectionnée, nommée « Pièce 1 » ; un clic simple → 300 × 300 ; déplacer une pièce par glisser → nouvelles coordonnées aimantées et `past.length` augmenté de 1 seulement ; poignée `e` tirée → largeur modifiée ; **`pointercancel` au milieu d'un déplacement → pièce inchangée, `past` inchangé** ; Échap pendant le dessin → aucune pièce ; 101ᵉ pièce → message de limite et toujours 100 pièces.
- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter** (capture du pointeur sur le SVG ; l'aperçu vit dans un état local du hook, pas dans le réducteur).
- [ ] **Step 4 : Vérifier le succès.**
- [ ] **Step 5 : Commit** — `feat(front): dessin, sélection, déplacement et redimensionnement des pièces`.

---

### Task 6: Panneau des propriétés et panneau des règles

**Files :** Create `src/features/editor/panels/PropertiesPanel.tsx` (+ css, + test), `panels/RulesPanel.tsx` (+ test) ; Modify `EditorPage.tsx`

**Interfaces :**
- Consumes : `useEditor`, `currentLevel`, `validatePlan`, `parseMeters`, `formatMeters`, `formatArea`, composants `Field`, `Select`, `Button`, `RuleBadge`.
- Produces :
  - Validation : `EditorPage` calcule `violations = useMemo(() => validatePlan(site, rules, state.plan), [state.plan, …])` et les passe au canvas et au panneau.
  - `PropertiesPanel` : rien de sélectionné → « Sélectionnez un élément du plan. » ; pièce → nom, type (`Select` : Séjour, Cuisine, Chambre, Salle de bain, WC, Entrée, Dégagement, Garage, Autre), X, Y, largeur, profondeur (mètres, `mono`), surface affichée, bouton « Supprimer la pièce » (danger). Chaque champ applique la valeur à la perte de focus ou sur Entrée (une entrée d'historique), valeur invalide → erreur sur le champ, rien d'envoyé. Le panneau est la **voie clavier** de l'édition.
  - `RulesPanel` : titre « Règles » ; liste des violations (erreurs puis alertes) en `RuleBadge` avec le message serveur/domaine ; « Aucun problème détecté » sinon ; chaque ligne est un bouton qui **sélectionne le premier objet référencé** (et bascule de niveau si besoin).

- [ ] **Step 1 : Tests qui échouent** — sélectionner une pièce affiche ses valeurs en mètres ; saisir « 4,5 » en largeur puis Tab → `w: 450` et une seule entrée d'historique ; « abc » → erreur, plan inchangé ; changer le type en Chambre d'une pièce de 8 m² fait apparaître « « … » fait 8,00 m² : minimum 9,00 m² … » dans le panneau Règles ; cliquer cette violation sélectionne la pièce ; `axe` sans violation sur les deux panneaux.
- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier le succès.**
- [ ] **Step 5 : Commit** — `feat(front): panneaux des propriétés et des règles, validation en direct`.

---

### Task 7: Niveaux et escalier

**Files :** Create `panels/LevelTabs.tsx` (+ test), `canvas/StairsShape.tsx` ; Modify `PlanCanvas.tsx`, `useGesture.ts`, `PropertiesPanel.tsx`, `Toolbar.tsx`

**Interfaces :**
- Produces :
  - `LevelTabs` : plain-pied → seulement un bouton « + Étage » ; avec étage → onglets « Rez-de-chaussée » / « Étage » (`role="tablist"`, flèches gauche/droite entre onglets) + bouton « Retirer l'étage » (danger) qui ouvre une `Modal` « Retirer l'étage ? Ses pièces, ses ouvertures, ses meubles et l'escalier seront supprimés. » → `removeUpperLevel`.
  - Outil Escalier (actif seulement avec un étage) : glisser dessine le rectangle aimanté → `setStairs` ; l'escalier est dessiné sur les deux niveaux (rectangle + marches tous les 25 cm + flèche de montée) ; sélectionnable, déplaçable, redimensionnable comme une pièce ; propriétés X, Y, largeur, longueur ; « Supprimer l'escalier ».

- [ ] **Step 1 : Tests qui échouent** — plain-pied : pas d'onglets, « + Étage » les fait apparaître et passe sur l'étage ; « Retirer l'étage » sans confirmer → rien ; après confirmation → onglets disparus, `stairs === null`, `parsePlan(state.plan).ok === true` ; l'outil Escalier est désactivé sans étage ; dessiner un escalier au RDC le montre aussi sur l'étage ; un étage sans escalier fait apparaître l'alerte « Il y a un étage mais pas d'escalier. ».
- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier le succès.**
- [ ] **Step 5 : Commit** — `feat(front): étage optionnel et escalier dans l'éditeur`.

---

### Task 8: Portes et fenêtres

**Files :** Create `canvas/OpeningShape.tsx` (+ test) ; Modify `packages/domain/src/index.ts` (export `findSegmentFor`), `useGesture.ts`, `PlanCanvas.tsx`, `PropertiesPanel.tsx`

**Interfaces :**
- Consumes : `computeWallSegments`, `findSegmentFor`, `doorSwingRect`, `doorHinge` de `@digimmo/domain`.
- Produces :
  - Outils Porte / Fenêtre : au survol, le segment de mur le plus proche (≤ seuil écran) est surligné ; clic → ouverture **centrée sur le point cliqué**, alignée sur le segment, largeur par défaut **90 cm** (porte) / **120 cm** (fenêtre), ramenée à la longueur du segment si plus court, aimantée à 10 cm ; porte : `swing: { hinge: 'start', side }` avec `side` vers l'intérieur de la pièce cliquée.
  - Fenêtre sur mur intérieur : posée quand même (la règle `WINDOW_ON_INTERIOR_WALL` la signale) — l'éditeur n'interdit pas, il signale.
  - Rendu : porte = trait d'ouverture + arc d'un quart de cercle (rayon = largeur) du côté `side`, depuis la charnière ; fenêtre = double trait fin sur le mur.
  - Sélection d'une ouverture : glisser la déplace **le long de son mur** ; propriétés : largeur, position, pour une porte « Charnière » (début / fin) et « Ouverture » (côté A / côté B), « Supprimer ».
  - Limite **200 ouvertures** par niveau, même message que pour les pièces.

- [ ] **Step 1 : Tests qui échouent** — clic sur le mur commun séjour/chambre avec l'outil Porte → `{ kind: 'door', orientation: 'h', fixed: 900, width: 90, start: <aimanté> }` et aucune violation ; clic sur un mur de 60 cm → largeur 60 ; fenêtre sur un mur intérieur → violation « Une fenêtre doit être sur un mur extérieur. » listée ; glisser une ouverture la déplace sans changer `fixed` ; inverser l'ouverture change `side` ; le rendu d'une porte contient un `path` d'arc.
- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier le succès** (+ tests du domaine après l'export).
- [ ] **Step 5 : Commit** — `feat(front): portes et fenêtres dans l'éditeur`.

---

### Task 9: Meubles du catalogue

**Files :** Create `panels/CatalogPalette.tsx` (+ test), `canvas/FurnitureShape.tsx` ; Modify `useGesture.ts`, `PlanCanvas.tsx`, `PropertiesPanel.tsx`

**Interfaces :**
- Consumes : `useCatalog()` (`src/lib/queries.ts`), `furnitureFootprint`, `snapRect`, `newId`.
- Produces :
  - `CatalogPalette` (outil Meuble actif) : liste groupée par catégorie (Chambre, Cuisine, Salle de bain, Séjour, Autre), un bouton par meuble avec nom et dimensions (`1,60 × 2,00 m`) ; choisir un meuble → `armFurniture(catalogId)` ; clic sur le plan → meuble centré sur le point, aimanté (grille + bords des autres meubles et des murs de la pièce), `label` = nom du catalogue, `rotation: 0` ; il reste armé pour en poser plusieurs ; Échap le désarme.
  - Rendu : empreinte (`furnitureFootprint`) en trait fin, libellé abrégé centré ; sélectionnable, déplaçable (aimanté), touche **R** ou bouton « Tourner d'un quart de tour ».
  - Propriétés : libellé, X, Y, largeur, profondeur, rotation (affichée en degrés), « Supprimer ».
  - Limite **500 meubles** par niveau.
  - Catalogue en erreur → message dans la palette, le reste de l'éditeur fonctionne.

- [ ] **Step 1 : Tests qui échouent** — choisir « Lit double » (140 × 190) puis cliquer en (300, 300) → meuble `{ x: 230, y: 210, w: 140, d: 190, rotation: 0, label: 'Lit double', catalogId }` ; R sur le meuble sélectionné → rotation 90 et empreinte 190 × 140 ; meuble à cheval sur deux pièces → violation « « Lit double » doit être entièrement dans une pièce. » ; 501ᵉ meuble refusé avec message ; catalogue en 500 → message dans la palette.
- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier le succès.**
- [ ] **Step 5 : Commit** — `feat(front): meubles du catalogue dans l'éditeur`.

---

### Task 10: Sauvegarde explicite et automatique

**Files :** Create `save/useAutosave.ts` (+ test), `panels/SaveStatus.tsx` (+ test) ; Modify `EditorPage.tsx`

**Interfaces :**
- Consumes : `isDirty`, action `markSaved` (Task 2) ; `api` ; clé de requête `['projects', id, 'plan']`.
- Produces :
  - `useAutosave({ projectId, state, dispatch, delayMs = 3000 })` → `{ status: 'saved' | 'dirty' | 'saving' | 'error'; saveNow(): Promise<void>; lastError?: ApiError }`.
    - Sauvegarde automatique **3 s** après la dernière modification si le plan est modifié ; « Enregistrer » (Ctrl+S) sauvegarde tout de suite.
    - **Une seule requête à la fois** : une modification pendant un envoi déclenche un nouvel envoi après la fin avec la dernière version ; `markSaved(planEnvoyé)` seulement si le plan courant n'a pas changé depuis l'envoi (sinon il reste modifié).
    - Après succès, met à jour le cache `['projects', id, 'plan']` avec la validation renvoyée.
    - 400 → statut `error` avec les `issues` affichées ; erreur réseau / 500 → `error` et nouvel essai automatique au bout de **10 s**.
  - `SaveStatus` : « Enregistré » / « Modifications non enregistrées » / « Enregistrement… » / « Échec de l'enregistrement » + bouton « Réessayer » ; `role="status"` ; bouton « Enregistrer » à côté (désactivé si rien à enregistrer).
  - Quitter l'éditeur avec des modifications non enregistrées : `beforeunload` (fermeture d'onglet) et `useBlocker` de react-router (navigation interne) → `Modal` « Des modifications ne sont pas enregistrées. » avec « Enregistrer et quitter » / « Quitter sans enregistrer » / « Rester ».

- [ ] **Step 1 : Tests qui échouent** (minuteurs simulés) — modification → statut « Modifications non enregistrées » puis, 3 s plus tard, un `PUT` et « Enregistré » ; deux modifications à 1 s d'écart → un seul `PUT` ; modification pendant un envoi → second `PUT` avec la dernière version, statut final « Enregistré » ; **`undo` après une sauvegarde automatique → « Modifications non enregistrées » puis nouveau `PUT`** ; 400 avec issues → « Échec de l'enregistrement » et message ; 500 → nouvel essai après 10 s ; **aller-retour** : plan à deux niveaux avec escalier, porte, fenêtre et meuble enregistré, page démontée puis rechargée (MSW renvoie le corps reçu) → plan identique ; navigation vers le tableau de bord avec des modifications → modale ; « Rester » garde la page.
- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier le succès.**
- [ ] **Step 5 : Commit** — `feat(front): sauvegarde explicite et automatique du plan`.

---

### Task 11: Raccourcis clavier et aide

**Files :** Create `panels/ShortcutsDialog.tsx` (+ test), `src/features/editor/useShortcuts.ts` (+ test) ; Modify `EditorPage.tsx`, `Toolbar.tsx`

**Interfaces — Produces :**
- `useShortcuts(dispatch, state, { saveNow })` actif seulement quand le focus n'est pas dans un champ de saisie : `Ctrl/Cmd+Z` annuler, `Ctrl/Cmd+Maj+Z` et `Ctrl/Cmd+Y` rétablir, `Ctrl/Cmd+S` enregistrer (empêche la boîte du navigateur), `Suppr` / `Retour arrière` supprimer la sélection, `Échap` désélectionner / annuler le geste / désarmer le meuble, flèches = déplacer la sélection de **10 cm** (Maj + flèche : **1 cm**), `R` tourner le meuble sélectionné, lettres d'outils (V, P, D, F, M, E), `?` ouvre l'aide.
- `ShortcutsDialog` : `Modal` « Raccourcis clavier » listant tous les raccourcis (tableau à deux colonnes) ; bouton « Raccourcis » (icône ?) dans la barre d'outils ; les infobulles des outils indiquent leur lettre (« Pièce (P) »).

- [ ] **Step 1 : Tests qui échouent** — Ctrl+Z annule ; Ctrl+Maj+Z et Ctrl+Y rétablissent ; flèche droite → x + 10, Maj + flèche → x + 1, une entrée d'historique par appui ; Suppr supprime la pièce sélectionnée ; les raccourcis sont ignorés quand le focus est dans un champ du panneau des propriétés ; Ctrl+S appelle `saveNow` et `preventDefault` ; `?` ouvre la boîte d'aide, `axe` sans violation dessus.
- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier le succès.**
- [ ] **Step 5 : Commit** — `feat(front): raccourcis clavier de l'éditeur et aide`.

---

### Task 12: Parcours complet, documentation et vérification globale

**Files :** Modify `README.md`, `apps/front/README.md` ; Create `src/features/editor/EditorPage.flow.test.tsx`

**Interfaces — Produces :**
- `EditorPage.flow.test.tsx` : scénario de bout en bout dans jsdom (MSW) — dessiner trois pièces collées (séjour, cuisine, chambre), poser une porte entre séjour et chambre, poser un lit dans la chambre, ajouter un étage avec une chambre au-dessus du séjour et un escalier, attendre la sauvegarde automatique ; vérifier qu'aucune violation d'erreur ne reste et que le corps du `PUT` passe `parsePlan`.
- README : section « Éditeur » (outils, raccourcis, sauvegarde automatique, limites).

- [ ] **Step 1 : Test de parcours qui échoue** (avant les éventuels ajustements) puis le faire passer.
- [ ] **Step 2 : Parcours manuel réel** (API + Docker + front sur le port 5174, jamais 5173) : créer un compte jetable, un projet, dessiner la maison du scénario au clavier et à la souris, recharger la page (plan identique), annuler/rétablir, retirer l'étage (confirmation), quitter avec des modifications (modale), supprimer le compte. Noter chaque étape et tout écart dans le rapport.
- [ ] **Step 3 : Vérification globale** (identique à la CI) : `npm ci && npm run build -w @digimmo/domain && npm run lint && npm run typecheck && npm test && npm run test:e2e -w @digimmo/back && npm run build`.
- [ ] **Step 4 : Commit** — `docs: éditeur dans le README et parcours de bout en bout`.
