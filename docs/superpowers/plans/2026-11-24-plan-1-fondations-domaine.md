# Plan 1 — Fondations et domaine : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Passer le dépôt en monorepo avec CI, et livrer la bibliothèque `@digimmo/domain` : types du plan, géométrie, calcul des murs, les 14 règles métier et le schéma de validation du format, entièrement en TDD.

**Architecture :** npm workspaces (`apps/back`, `apps/front`, `packages/domain`). `domain` est du TypeScript pur, sans dépendance au framework, compilé par tsup en ESM + CJS (le back NestJS est en CommonJS, le front en ESM). Toutes les règles sont des fonctions pures `(entrées) => Violation[]`, agrégées par `validatePlan`.

**Tech Stack :** Node ≥ 22.12, npm workspaces, TypeScript, tsup, Vitest, Zod 4, GitHub Actions.

**Spec :** `docs/superpowers/specs/2026-11-23-digimmo-design.md` (§5 Domaine et règles, §6 Architecture, §8 Qualité).

**Plans suivants (hors de ce plan) :** 2 · API (Docker dev, PostgreSQL, MongoDB, comptes, projets, plans, catalogue) — 3 · Design system et front — 4 · Éditeur 2D — 5 · Export et déploiement.

## Global Constraints

- Unités : **centimètres entiers** partout dans `domain` ; surfaces en cm² entiers. Affichage : `4,20 m`, `15,12 m²` (virgule décimale, deux décimales, espace avant l'unité).
- Repère : origine en haut à gauche, x vers la droite, y vers le bas.
- Pièces, meubles, escalier : rectangles alignés sur les axes. Rotation des meubles ∈ {0, 90, 180, 270}.
- Contact bord à bord **autorisé** partout ; seul un recouvrement de surface > 0 est un chevauchement.
- Les seuils (reculs, emprise, surfaces minimales) sont des **paramètres** passés aux règles, jamais codés en dur dans une règle.
- Les messages de violation sont en **français**, au texte exact donné dans chaque tâche.
- `domain` n'importe rien d'autre que `zod`.
- TDD : chaque comportement commence par un test qui échoue ; un commit par tâche au minimum.

## Review Focus

1. **Coordonnées non entières ou négatives, dimensions nulles** (ex. `w: 420.5`, `w: 0`) envoyées par un client → le schéma les rejette avant toute règle. Test : Tâche 10.
2. **Distance exactement égale au recul minimal** (maison à 5,00 m pour 5,00 m exigés) → valide (`≥`). Test : Tâche 6.
3. **Meuble à cheval sur deux pièces qui se touchent** (lit moitié chambre, moitié dégagement) → `FURNITURE_OUTSIDE_ROOM`, même si l'union des deux pièces le contient. Test : Tâche 9.
4. **Ouverture orpheline après déplacement d'une pièce** (plus aucun mur à cet endroit) → `OPENING_NOT_ON_WALL`, sans exception levée. Test : Tâche 8.
5. **Identifiants dupliqués dans un plan** (deux pièces `id: "r1"`) → le schéma rejette. Test : Tâche 10.

---

## Structure des fichiers

```
package.json                      racine : workspaces, scripts globaux, engines
.nvmrc                            22
.github/workflows/ci.yml          lint, typecheck, test, build
apps/back/                        (déplacé depuis digimmo-back/, renommé @digimmo/back)
apps/front/                       (déplacé depuis digimmo-front/, renommé @digimmo/front)
packages/domain/
  package.json  tsconfig.json  tsup.config.ts  vitest.config.ts
  src/
    index.ts            exports publics
    types.ts            types du plan, du terrain, des paramètres, des violations
    units.ts            formatage m / m²
    geometry.ts         rectangles, polygones, distances, recouvrement
    walls.ts            segments de mur calculés depuis les pièces
    defaults.ts         paramètres par défaut
    rules/site.ts       règles 1-4
    rules/rooms.ts      règles 5-7
    rules/openings.ts   règles 8-10
    rules/furniture.ts  règles 11-14
    validate.ts         validatePlan (agrégateur)
    schema.ts           schémas Zod (format du plan et des paramètres)
  (tests colocalisés : *.test.ts)
```

---

### Tâche 1 : Monorepo npm workspaces

**Files :**
- Move : `digimmo-back/` → `apps/back/`, `digimmo-front/` → `apps/front/`
- Create : `package.json`, `.nvmrc`
- Modify : `apps/back/package.json` (name), `apps/front/package.json` (name), `README.md` (structure + commandes)
- Delete : `apps/back/package-lock.json`, `apps/front/package-lock.json` (remplacés par le lock racine)

**Interfaces :**
- Produces : scripts racine `npm run build | test | lint | typecheck`, chacun délégué aux workspaces via `--workspaces --if-present` ; `build` construit `@digimmo/domain` en premier.

- [ ] **Step 1 : Déplacer avec l'historique**

```bash
mkdir -p apps packages
git mv digimmo-back apps/back
git mv digimmo-front apps/front
git rm apps/back/package-lock.json apps/front/package-lock.json
rm -rf apps/back/node_modules apps/front/node_modules
```

- [ ] **Step 2 : Créer `package.json` racine**

```json
{
  "name": "digimmo",
  "private": true,
  "engines": { "node": ">=22.12" },
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "build": "npm run build -w @digimmo/domain && npm run build -w @digimmo/back -w @digimmo/front",
    "test": "npm run test --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  }
}
```

Renommer `apps/back/package.json` → `"name": "@digimmo/back"`, `apps/front/package.json` → `"name": "@digimmo/front"`. Ajouter dans le back `"typecheck": "tsc --noEmit"` et dans le front `"typecheck": "tsc -b --noEmit"`. Remplacer le script `lint` du back par `eslint "{src,test}/**/*.ts"` (sans `--fix`, pour la CI). Garder `test` = `jest` (tests unitaires seulement ; les e2e restent dans `test:e2e`). `.nvmrc` contient `22`.

- [ ] **Step 3 : Installer et vérifier que rien n'a cassé**

Run : `npm install && npm run test -w @digimmo/back && npm run build -w @digimmo/back -w @digimmo/front`
Expected : 1 test du back PASS, les deux builds réussissent, un seul `package-lock.json` à la racine.

- [ ] **Step 4 : Mettre à jour le README**

Sections « Structure du dépôt » (structure cible devient l'actuelle) et « Démarrer en local » : `npm install` à la racine, `npm run start:dev -w @digimmo/back`, `npm run dev -w @digimmo/front`, `npm test`.

- [ ] **Step 5 : Commit**

```bash
git add -A && git commit -m "chore: passage en monorepo npm workspaces (apps/back, apps/front)"
```

---

### Tâche 2 : Package `@digimmo/domain` (squelette testable) + CI

**Files :**
- Create : `packages/domain/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts,src/index.ts,src/units.ts,src/units.test.ts}`
- Create : `.github/workflows/ci.yml`

**Interfaces :**
- Produces : `formatMeters(cm: number): string`, `formatArea(cm2: number): string` ; package importable par `@digimmo/domain` en ESM et CJS.

- [ ] **Step 1 : Configurer le package**

`package.json` : `"name": "@digimmo/domain"`, `"type": "module"`, `"main": "./dist/index.cjs"`, `"module": "./dist/index.js"`, `"types": "./dist/index.d.ts"`, `exports` avec `import` / `require` / `types` ; scripts `build: tsup`, `test: vitest run`, `test:watch: vitest`, `typecheck: tsc --noEmit`. Dépendance `zod@^4` ; dev : `tsup`, `vitest`, `typescript`. `tsconfig.json` : `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `noUncheckedIndexedAccess: true`. `tsup.config.ts` : entry `src/index.ts`, formats `['esm','cjs']`, `dts: true`, `clean: true`.

- [ ] **Step 2 : Écrire les tests qui échouent (`src/units.test.ts`)**

```ts
describe('formatMeters', () => {
  it('formate en mètres avec virgule et 2 décimales', () => {
    expect(formatMeters(420)).toBe('4,20 m');
    expect(formatMeters(0)).toBe('0,00 m');
    expect(formatMeters(2005)).toBe('20,05 m');
  });
});
describe('formatArea', () => {
  it('formate des cm² en m²', () => {
    expect(formatArea(420 * 360)).toBe('15,12 m²');
    expect(formatArea(90_000)).toBe('9,00 m²');
  });
});
```

- [ ] **Step 3 : Vérifier l'échec**

Run : `npm test -w @digimmo/domain` → FAIL (`formatMeters` introuvable).

- [ ] **Step 4 : Implémenter `units.ts` et l'exporter depuis `index.ts`**

`(cm / 100).toFixed(2).replace('.', ',') + ' m'` ; idem pour les m² avec `/ 10_000`.

- [ ] **Step 5 : Vérifier le succès et le build**

Run : `npm test -w @digimmo/domain && npm run build -w @digimmo/domain`
Expected : PASS ; `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` présents.

- [ ] **Step 6 : CI GitHub Actions (`.github/workflows/ci.yml`)**

Déclenchement `push` et `pull_request`. Job unique `ubuntu-latest` : `actions/checkout@v4`, `actions/setup-node@v4` avec `node-version-file: .nvmrc` et `cache: npm`, puis `npm ci`, `npm run build -w @digimmo/domain`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

- [ ] **Step 7 : Vérifier la CI en local**

Run : `npm ci && npm run build -w @digimmo/domain && npm run lint && npm run typecheck && npm test && npm run build`
Expected : tout passe (corriger les erreurs de lint préexistantes du squelette si besoin).

- [ ] **Step 8 : Commit**

```bash
git add -A && git commit -m "feat(domain): package domain, formatage des unités, CI"
```

---

### Tâche 3 : Types du domaine et paramètres par défaut

**Files :**
- Create : `packages/domain/src/types.ts`, `packages/domain/src/defaults.ts`, `packages/domain/src/defaults.test.ts`

**Interfaces — Produces (utilisés par toutes les tâches suivantes) :**

```ts
export type Cm = number;
export interface Point { x: Cm; y: Cm }
export interface Rect { x: Cm; y: Cm; w: Cm; h: Cm }
export type RoomType = 'sejour' | 'cuisine' | 'chambre' | 'sdb' | 'wc' | 'entree' | 'degagement' | 'garage' | 'autre';
export interface Room { id: string; type: RoomType; name: string; rect: Rect }
export type Orientation = 'h' | 'v';           // h : mur horizontal (y fixe) ; v : mur vertical (x fixe)
export interface Opening {
  id: string; kind: 'door' | 'window';
  orientation: Orientation; fixed: Cm;          // y du mur si 'h', x du mur si 'v'
  start: Cm; width: Cm;                         // position de début le long du mur, largeur
  swing?: { hinge: 'start' | 'end'; side: 'neg' | 'pos' }; // portes uniquement ; side = sens d'ouverture vers -axe ou +axe perpendiculaire
}
export type Rotation = 0 | 90 | 180 | 270;
export interface Furniture { id: string; catalogId: string; label: string; x: Cm; y: Cm; w: Cm; d: Cm; rotation: Rotation }
export type LevelId = 'rdc' | 'r1';
export interface Level { id: LevelId; rooms: Room[]; openings: Opening[]; furniture: Furniture[] }
export interface Plan { levels: Level[]; stairs: { rect: Rect } | null }
export interface Site { boundary: Point[]; streetEdge: number } // polygone convexe, sens horaire ; arête i = boundary[i] → boundary[(i+1)%n]
export interface RuleParams { setbackStreetCm: Cm; setbackSidesCm: Cm; maxFootprintPct: number; minAreasM2: Partial<Record<RoomType, number>> }
export type RuleCode =
  | 'HOUSE_OUTSIDE_SITE' | 'SETBACK_STREET' | 'SETBACK_SIDES' | 'FOOTPRINT_MAX' | 'FOOTPRINT_NEAR_MAX'
  | 'ROOM_OVERLAP' | 'ROOM_MIN_AREA' | 'UPPER_NOT_SUPPORTED'
  | 'WINDOW_ON_INTERIOR_WALL' | 'OPENING_NOT_ON_WALL' | 'OPENING_OVERLAP' | 'DOOR_BLOCKED'
  | 'FURNITURE_OUTSIDE_ROOM' | 'FURNITURE_OVERLAP' | 'STAIRS_PLACEMENT' | 'STAIRS_MISSING';
export interface Violation { code: RuleCode; severity: 'error' | 'warning'; message: string; refs: string[]; level?: LevelId }
```

`defaults.ts` exporte :
- `DEFAULT_RULE_PARAMS: RuleParams` = `{ setbackStreetCm: 500, setbackSidesCm: 300, maxFootprintPct: 40, minAreasM2: { chambre: 9, sejour: 16, cuisine: 6, sdb: 3, wc: 1 } }` *(valeurs indicatives, choix du concepteur)*.
- `rectangularSite(widthCm: Cm, depthCm: Cm, street: 'north' | 'south' | 'east' | 'west'): Site` : 4 sommets horaires à partir de (0,0) ; `streetEdge` = 0 nord, 1 est, 2 sud, 3 ouest.

- [ ] **Step 1 : Test qui échoue (`defaults.test.ts`)**

```ts
it('rectangularSite construit un rectangle horaire et choisit l’arête de voie', () => {
  const s = rectangularSite(2000, 3000, 'south');
  expect(s.boundary).toEqual([{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 3000 }, { x: 0, y: 3000 }]);
  expect(s.streetEdge).toBe(2);
});
```

- [ ] **Step 2 : Vérifier l'échec** — `npm test -w @digimmo/domain` → FAIL.
- [ ] **Step 3 : Écrire `types.ts` et `defaults.ts`, exporter depuis `index.ts`.**
- [ ] **Step 4 : Vérifier le succès** — PASS, et `npm run typecheck -w @digimmo/domain` sans erreur.
- [ ] **Step 5 : Commit** — `git commit -am "feat(domain): types du plan et paramètres par défaut"` (ajouter les nouveaux fichiers).

---

### Tâche 4 : Géométrie

**Files :** Create `packages/domain/src/geometry.ts`, `packages/domain/src/geometry.test.ts`

**Interfaces — Produces :**

```ts
area(r: Rect): number                                   // cm²
intersection(a: Rect, b: Rect): Rect | null             // null si surface commune = 0
overlaps(a: Rect, b: Rect): boolean                     // recouvrement de surface > 0 (contact bord à bord = false)
containsRect(outer: Rect, inner: Rect): boolean         // bords inclus
furnitureFootprint(f: Furniture): Rect                  // rotation 90/270 échange w et d ; h = d (ou w)
corners(r: Rect): Point[]                               // 4 coins
pointInPolygon(p: Point, poly: Point[]): boolean        // bord inclus
rectInPolygon(r: Rect, poly: Point[]): boolean          // les 4 coins dans le polygone (polygone convexe)
distancePointToSegment(p: Point, a: Point, b: Point): number
distanceRectToSegment(r: Rect, a: Point, b: Point): number // 0 si contact/intersection
distancePointToRect(p: Point, r: Rect): number
coveredByUnion(r: Rect, rects: Rect[]): boolean         // r entièrement couvert par l'union de rects
```

- [ ] **Step 1 : Tests qui échouent**

```ts
const A = { x: 0, y: 0, w: 400, h: 300 };
it('area', () => expect(area(A)).toBe(120_000));
it('bord à bord ne chevauche pas', () => expect(overlaps(A, { x: 400, y: 0, w: 400, h: 300 })).toBe(false));
it('1 cm de recouvrement chevauche', () => expect(overlaps(A, { x: 399, y: 0, w: 400, h: 300 })).toBe(true));
it('intersection', () => expect(intersection(A, { x: 300, y: 200, w: 400, h: 400 })).toEqual({ x: 300, y: 200, w: 100, h: 100 }));
it('containsRect bords inclus', () => expect(containsRect(A, A)).toBe(true));
it('furnitureFootprint tourne de 90°', () =>
  expect(furnitureFootprint({ id: 'f', catalogId: 'lit', label: 'Lit', x: 10, y: 20, w: 160, d: 200, rotation: 90 }))
    .toEqual({ x: 10, y: 20, w: 200, h: 160 }));
const sq = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
it('rectInPolygon', () => {
  expect(rectInPolygon({ x: 0, y: 0, w: 1000, h: 1000 }, sq)).toBe(true);
  expect(rectInPolygon({ x: 900, y: 0, w: 101, h: 10 }, sq)).toBe(false);
});
it('distanceRectToSegment', () =>
  expect(distanceRectToSegment({ x: 100, y: 300, w: 50, h: 50 }, { x: 0, y: 0 }, { x: 1000, y: 0 })).toBe(300));
it('coveredByUnion : couvert par deux rectangles adjacents', () => {
  expect(coveredByUnion({ x: 100, y: 0, w: 600, h: 100 }, [{ x: 0, y: 0, w: 400, h: 300 }, { x: 400, y: 0, w: 400, h: 300 }])).toBe(true);
  expect(coveredByUnion({ x: 100, y: 0, w: 800, h: 100 }, [{ x: 0, y: 0, w: 400, h: 300 }, { x: 400, y: 0, w: 400, h: 300 }])).toBe(false);
});
```

- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter `geometry.ts`.** `coveredByUnion` par compression de coordonnées : collecter les x et y de `r` et des `rects` découpés à `r`, puis vérifier que chaque cellule de la grille obtenue (via son centre) est dans au moins un rectangle. `distanceRectToSegment` : 0 si un coin est de part et d'autre du segment avec intersection, sinon le min entre les distances des 4 coins au segment et des 2 extrémités au rectangle.
- [ ] **Step 4 : Vérifier le succès.**
- [ ] **Step 5 : Commit** — `feat(domain): géométrie (rectangles, polygones, distances, couverture)`.

---

### Tâche 5 : Segments de mur

**Files :** Create `packages/domain/src/walls.ts`, `packages/domain/src/walls.test.ts`

**Interfaces — Produces :**

```ts
export interface WallSegment { orientation: Orientation; fixed: Cm; start: Cm; end: Cm; roomIds: string[]; exterior: boolean }
computeWallSegments(rooms: Room[]): WallSegment[]
findSegmentFor(opening: Opening, segments: WallSegment[]): WallSegment | null // segment de même orientation et même `fixed` contenant [start, start+width]
```

Règle : chaque côté de pièce est découpé aux bornes des côtés coïncidents d'autres pièces (bas de B sur la même ligne que le haut de A, etc.). Un sous-intervalle partagé par deux pièces donne **un seul** segment `exterior: false` avec les deux `roomIds` ; sinon `exterior: true` avec un seul id. Les segments sont triés par `(orientation, fixed, start)`.

- [ ] **Step 1 : Tests qui échouent**

```ts
const a = { id: 'a', type: 'sejour', name: 'Séjour', rect: { x: 0, y: 0, w: 600, h: 400 } } as Room;
const b = { id: 'b', type: 'chambre', name: 'Ch. 1', rect: { x: 0, y: 400, w: 300, h: 300 } } as Room;
it('pièce seule : 4 segments extérieurs', () => {
  const s = computeWallSegments([a]);
  expect(s).toHaveLength(4);
  expect(s.every(x => x.exterior)).toBe(true);
});
it('côté de 6 m dont 3 m partagés : un intérieur de 3 m et un extérieur de 3 m', () => {
  const bottom = computeWallSegments([a, b]).filter(s => s.orientation === 'h' && s.fixed === 400);
  expect(bottom).toEqual([
    { orientation: 'h', fixed: 400, start: 0, end: 300, roomIds: ['a', 'b'], exterior: false },
    { orientation: 'h', fixed: 400, start: 300, end: 600, roomIds: ['a'], exterior: true },
  ]);
});
it('findSegmentFor trouve le segment qui contient l’ouverture', () => {
  const segs = computeWallSegments([a, b]);
  const door = { id: 'd', kind: 'door', orientation: 'h', fixed: 400, start: 100, width: 90 } as Opening;
  expect(findSegmentFor(door, segs)?.exterior).toBe(false);
  expect(findSegmentFor({ ...door, start: 250 }, segs)).toBeNull(); // à cheval sur deux segments
});
```

- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter `walls.ts`.**
- [ ] **Step 4 : Vérifier le succès.**
- [ ] **Step 5 : Commit** — `feat(domain): calcul des segments de mur`.

---

### Tâche 6 : Règles terrain (1 à 4)

**Files :** Create `packages/domain/src/rules/site.ts`, `packages/domain/src/rules/site.test.ts`

**Interfaces — Produces :**
`checkSite(site: Site, params: RuleParams, rdcRooms: Room[]): Violation[]`

Comportement et messages exacts (`d`, `min` formatés par `formatMeters`, pourcentages avec 1 décimale et virgule) :
1. Pièce non contenue (`rectInPolygon`) → `HOUSE_OUTSIDE_SITE`, error, `La pièce « {name} » dépasse du terrain.`, refs `[room.id]`.
2. Distance à l'arête `streetEdge` `< setbackStreetCm` → `SETBACK_STREET`, error, `« {name} » est à {d} de la voie (minimum {min}).`
3. Distance à toute autre arête `< setbackSidesCm` → `SETBACK_SIDES`, error, `« {name} » est à {d} d'une limite séparative (minimum {min}).` (une violation par pièce, avec la plus petite distance).
4. `pct = somme des surfaces des pièces RDC / surface du terrain × 100`. `pct > max` → `FOOTPRINT_MAX`, error, `Emprise au sol de {pct} % : le maximum est {max} %.` ; sinon `pct ≥ 0,9 × max` → `FOOTPRINT_NEAR_MAX`, warning, `Emprise au sol à {pct} % : proche du maximum de {max} %.` (refs vides). Surface du polygone par la formule du lacet.

- [ ] **Step 1 : Tests qui échouent** (terrain `rectangularSite(2000, 3000, 'north')`, `DEFAULT_RULE_PARAMS`)

```ts
const room = (x: number, y: number, w = 1000, h = 1000): Room => ({ id: 'r', type: 'sejour', name: 'Séjour', rect: { x, y, w, h } });
it('maison à 3 m de la voie pour 5 m exigés → refus (jeu d’essai du dossier)', () => {
  const v = checkSite(site, DEFAULT_RULE_PARAMS, [room(500, 300)]);
  expect(v).toContainEqual(expect.objectContaining({ code: 'SETBACK_STREET', message: '« Séjour » est à 3,00 m de la voie (minimum 5,00 m).' }));
});
it('distance exactement égale au recul → valide', () => {
  expect(checkSite(site, DEFAULT_RULE_PARAMS, [room(500, 500)]).filter(v => v.code === 'SETBACK_STREET')).toEqual([]);
});
it('trop près d’une limite séparative', () =>
  expect(checkSite(site, DEFAULT_RULE_PARAMS, [room(100, 600)]).map(v => v.code)).toContain('SETBACK_SIDES'));
it('pièce hors terrain', () =>
  expect(checkSite(site, DEFAULT_RULE_PARAMS, [room(1500, 600)]).map(v => v.code)).toContain('HOUSE_OUTSIDE_SITE'));
it('emprise : 40 % max', () => {
  // terrain 600 m² ; pièce 1000×2500 = 250 m² = 41,7 %
  expect(checkSite(site, DEFAULT_RULE_PARAMS, [room(500, 500, 1000, 2500)])).toContainEqual(
    expect.objectContaining({ code: 'FOOTPRINT_MAX', message: 'Emprise au sol de 41,7 % : le maximum est 40 %.' }));
  // 1000×2200 = 220 m² = 36,7 % ≥ 36 % → alerte
  expect(checkSite(site, DEFAULT_RULE_PARAMS, [room(500, 500, 1000, 2200)]).map(v => v.code)).toContain('FOOTPRINT_NEAR_MAX');
});
it('aucune pièce → aucune violation', () => expect(checkSite(site, DEFAULT_RULE_PARAMS, [])).toEqual([]));
```

- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter `checkSite`.**
- [ ] **Step 4 : Vérifier le succès.**
- [ ] **Step 5 : Commit** — `feat(domain): règles d'implantation sur le terrain (1-4)`.

---

### Tâche 7 : Règles pièces (5 à 7)

**Files :** Create `packages/domain/src/rules/rooms.ts`, `packages/domain/src/rules/rooms.test.ts`

**Interfaces — Produces :**
- `checkRoomOverlaps(level: Level): Violation[]` → `ROOM_OVERLAP`, error, `« {a} » et « {b} » se chevauchent.`, refs `[a.id, b.id]`, `level: level.id`. Une violation par paire.
- `checkRoomAreas(level: Level, params: RuleParams): Violation[]` → `ROOM_MIN_AREA`, error, `« {name} » fait {area} : minimum {min} pour ce type de pièce.` (`area` via `formatArea`, `min` au format `9,00 m²`). Aucun contrôle si le type n'a pas de minimum.
- `checkUpperSupported(rdc: Level, r1: Level): Violation[]` → `UPPER_NOT_SUPPORTED`, error, `« {name} » (étage) n'est pas au-dessus du rez-de-chaussée.` pour chaque pièce du R+1 non couverte (`coveredByUnion`) par les pièces du RDC.

- [ ] **Step 1 : Tests qui échouent**

```ts
it('deux pièces 400×300 bord à bord → valide ; 1 cm de recouvrement → erreur (jeu d’essai)', () => {
  const lvl = (dx: number): Level => ({ id: 'rdc', openings: [], furniture: [], rooms: [
    { id: 'a', type: 'sejour', name: 'Séjour', rect: { x: 0, y: 0, w: 400, h: 300 } },
    { id: 'b', type: 'cuisine', name: 'Cuisine', rect: { x: 400 - dx, y: 0, w: 400, h: 300 } }] });
  expect(checkRoomOverlaps(lvl(0))).toEqual([]);
  expect(checkRoomOverlaps(lvl(1))[0]).toMatchObject({ code: 'ROOM_OVERLAP', message: '« Séjour » et « Cuisine » se chevauchent.', refs: ['a', 'b'] });
});
it('chambre de 8,97 m² refusée, 9 m² acceptée', () => {
  const lvl = (w: number): Level => ({ id: 'rdc', openings: [], furniture: [],
    rooms: [{ id: 'c', type: 'chambre', name: 'Ch. 1', rect: { x: 0, y: 0, w, h: 300 } }] });
  expect(checkRoomAreas(lvl(300), DEFAULT_RULE_PARAMS)).toEqual([]);
  expect(checkRoomAreas(lvl(299), DEFAULT_RULE_PARAMS)[0]).toMatchObject({ code: 'ROOM_MIN_AREA', message: '« Ch. 1 » fait 8,97 m² : minimum 9,00 m² pour ce type de pièce.' });
});
it('pièce d’étage qui déborde du RDC', () => {
  const rdc: Level = { id: 'rdc', openings: [], furniture: [], rooms: [{ id: 'a', type: 'sejour', name: 'Séjour', rect: { x: 0, y: 0, w: 800, h: 600 } }] };
  const r1 = (w: number): Level => ({ id: 'r1', openings: [], furniture: [], rooms: [{ id: 'u', type: 'chambre', name: 'Ch. 2', rect: { x: 0, y: 0, w, h: 300 } }] });
  expect(checkUpperSupported(rdc, r1(800))).toEqual([]);
  expect(checkUpperSupported(rdc, r1(900))[0]?.code).toBe('UPPER_NOT_SUPPORTED');
});
```

- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter `rules/rooms.ts`.**
- [ ] **Step 4 : Vérifier le succès.**
- [ ] **Step 5 : Commit** — `feat(domain): règles des pièces (5-7)`.

---

### Tâche 8 : Règles des ouvertures (8 à 10)

**Files :** Create `packages/domain/src/rules/openings.ts`, `packages/domain/src/rules/openings.test.ts`

**Interfaces :**
- Consumes : `computeWallSegments`, `findSegmentFor` (Tâche 5), `intersection`, `distancePointToRect`, `furnitureFootprint` (Tâche 4).
- Produces :
  - `doorHinge(o: Opening): Point` : point du mur à `start` (hinge `'start'`) ou `start + width` (hinge `'end'`).
  - `doorSwingRect(o: Opening): Rect` : carré `width × width` collé au mur, du côté `side` (`'pos'` = vers +y pour un mur `h`, vers +x pour un mur `v`).
  - `checkOpenings(level: Level): Violation[]`.

Comportement et messages (tous `level: level.id`, refs `[opening.id]` sauf mention) :
- Pas de segment trouvé → `OPENING_NOT_ON_WALL`, error, `Une ouverture n'est sur aucun mur.` (et aucune autre règle pour cette ouverture).
- Fenêtre sur segment intérieur → `WINDOW_ON_INTERIOR_WALL`, error, `Une fenêtre doit être sur un mur extérieur.`
- Deux ouvertures sur la même ligne (`orientation`, `fixed`) dont les intervalles se recouvrent (longueur > 0) → `OPENING_OVERLAP`, error, `Deux ouvertures se chevauchent sur le même mur.`, refs `[o1.id, o2.id]`.
- Porte : pour chaque meuble du niveau, `I = intersection(footprint, doorSwingRect)` ; si `I` existe et `distancePointToRect(doorHinge, I) < width` → `DOOR_BLOCKED`, error, `« {label} » gêne l'ouverture d'une porte.`, refs `[opening.id, furniture.id]`. (Arc réel = quart de disque : le carré seul serait trop strict dans l'angle opposé à la charnière.)

- [ ] **Step 1 : Tests qui échouent** (niveau : séjour `a` 600×400 en (0,0) et chambre `b` 300×300 en (0,400) comme en Tâche 5)

```ts
it('porte sur mur intérieur → valide', ...);              // door h, fixed 400, start 100, width 90 → []
it('fenêtre sur mur intérieur → erreur', ...);            // window même position → code WINDOW_ON_INTERIOR_WALL
it('fenêtre sur mur extérieur → valide', ...);            // window h, fixed 0, start 100, width 120 → []
it('ouverture orpheline après déplacement de la pièce → OPENING_NOT_ON_WALL sans exception', ...); // fixed 450
it('deux ouvertures qui se recouvrent', ...);             // fenêtres h fixed 0, start 100 w 120 et start 200 w 120 → OPENING_OVERLAP
it('armoire dans l’arc d’une porte de 80 cm → DOOR_BLOCKED (jeu d’essai)', ...);
  // porte h, fixed 400, start 100, width 80, swing { hinge: 'start', side: 'pos' } (ouvre vers la chambre)
  // armoire { x: 110, y: 410, w: 60, d: 60, rotation: 0, label: 'Armoire' } → message '« Armoire » gêne l'ouverture d'une porte.'
it('meuble dans le coin du carré hors de l’arc → valide', ...);
  // même porte ; meuble { x: 175, y: 475, w: 5, d: 5 } : distance au gond (100,400) ≈ 106 > 80 → []
```

Chaque `...` est un `it` avec l'entrée décrite et l'assertion `expect(checkOpenings(level).map(v => v.code)).toEqual([...])` (ou `toEqual([])`).

- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter `rules/openings.ts`.**
- [ ] **Step 4 : Vérifier le succès.**
- [ ] **Step 5 : Commit** — `feat(domain): règles des portes et fenêtres (8-10)`.

---

### Tâche 9 : Règles meubles et escalier (11 à 14)

**Files :** Create `packages/domain/src/rules/furniture.ts`, `packages/domain/src/rules/furniture.test.ts`

**Interfaces — Produces :**
- `checkFurniture(level: Level, stairs: Rect | null): Violation[]`
  - Meuble non contenu (`containsRect`) dans **une seule** pièce → `FURNITURE_OUTSIDE_ROOM`, error, `« {label} » doit être entièrement dans une pièce.`, refs `[f.id]`.
  - Deux meubles qui se chevauchent → `FURNITURE_OVERLAP`, error, `Chevauchement : {labelA} / {labelB}.`, refs `[a.id, b.id]`.
  - Meuble qui chevauche l'escalier → `FURNITURE_OVERLAP`, error, `Chevauchement : {label} / escalier.`, refs `[f.id, 'stairs']`.
- `checkStairs(plan: Plan): Violation[]`
  - Niveau `r1` présent et `stairs === null` → `STAIRS_MISSING`, warning, `Il y a un étage mais pas d'escalier.`, refs `[]`.
  - `stairs` présent et pas contenu dans une seule pièce du RDC **et** dans une seule pièce du R+1 → `STAIRS_PLACEMENT`, error, `L'escalier doit être dans une pièce, au rez-de-chaussée comme à l'étage.`, refs `['stairs']`.
  - Pas de niveau `r1` → aucune violation (l'escalier est ignoré ; le schéma l'interdit de toute façon, Tâche 10).

- [ ] **Step 1 : Tests qui échouent**

```ts
it('lit 160×200 tourné à 90° qui déborde de 10 cm d’une chambre 300×300 → erreur (jeu d’essai)', ...);
  // chambre (0,0,300,300) ; lit { x: 110, y: 0, w: 160, d: 200, rotation: 90 } → empreinte 200×160 de x=110 à 310 → FURNITURE_OUTSIDE_ROOM
it('meuble à cheval sur deux pièces adjacentes → FURNITURE_OUTSIDE_ROOM', ...);
  // pièces (0,0,300,300) et (300,0,300,300) ; meuble { x: 250, y: 50, w: 100, d: 50, rotation: 0 }
it('lit et armoire qui se chevauchent → message exact', ...);
  // → 'Chevauchement : Lit / Armoire.'
it('meuble sur l’escalier → FURNITURE_OVERLAP', ...);
it('étage sans escalier → alerte STAIRS_MISSING', ...);
it('escalier hors pièce à l’étage → STAIRS_PLACEMENT', ...);
it('plain-pied sans escalier → aucune violation', ...);
```

Chaque `...` est un `it` avec l'entrée décrite et l'assertion sur les `code` (et le `message` quand il est indiqué).

- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter `rules/furniture.ts`.**
- [ ] **Step 4 : Vérifier le succès.**
- [ ] **Step 5 : Commit** — `feat(domain): règles des meubles et de l'escalier (11-14)`.

---

### Tâche 10 : Schéma Zod du format

**Files :** Create `packages/domain/src/schema.ts`, `packages/domain/src/schema.test.ts`

**Interfaces — Produces :**
- `planSchema` (Zod) dont `z.infer` est compatible avec `Plan` ; `ruleParamsSchema` ; `siteSchema`.
- `parsePlan(input: unknown): { ok: true; plan: Plan } | { ok: false; issues: string[] }`.

Contraintes du schéma :
- Objets **stricts** (`z.strictObject`) : tout champ inconnu est rejeté.
- Coordonnées `x, y, fixed, start` : entiers ≥ 0 ; dimensions `w, h, d, width` : entiers > 0 ; maximum 100 000 cm (1 km) pour toute valeur.
- `levels` : 1 ou 2 éléments ; le premier a `id: 'rdc'`, le second (optionnel) `id: 'r1'`.
- `stairs` non nul seulement si un niveau `r1` existe.
- `swing` obligatoire pour `kind: 'door'`, interdit pour `kind: 'window'`.
- `id` uniques sur tout le plan (pièces, ouvertures, meubles confondus) ; `name`, `label` : 1 à 60 caractères.
- Limites : 100 pièces, 200 ouvertures et 500 meubles par niveau au maximum.
- `ruleParamsSchema` : reculs entiers 0 à 5 000 ; `maxFootprintPct` 1 à 100 ; `minAreasM2` valeurs 0 à 100.
- `siteSchema` : 3 à 50 sommets, `streetEdge` entier dans `[0, n-1]`.

- [ ] **Step 1 : Tests qui échouent**

```ts
const valid = { levels: [{ id: 'rdc', rooms: [{ id: 'a', type: 'sejour', name: 'Séjour', rect: { x: 0, y: 0, w: 400, h: 300 } }], openings: [], furniture: [] }], stairs: null };
it('accepte un plan valide', () => expect(parsePlan(valid).ok).toBe(true));
it('refuse une coordonnée non entière', () => expect(parsePlan(set(valid, 'levels.0.rooms.0.rect.w', 420.5)).ok).toBe(false));
it('refuse une dimension nulle', () => expect(parsePlan(set(valid, 'levels.0.rooms.0.rect.w', 0)).ok).toBe(false));
it('refuse une coordonnée négative', () => expect(parsePlan(set(valid, 'levels.0.rooms.0.rect.x', -1)).ok).toBe(false));
it('refuse un champ inconnu', () => expect(parsePlan({ ...valid, admin: true }).ok).toBe(false));
it('refuse des identifiants dupliqués', ...);   // deux pièces id 'a'
it('refuse un escalier sans étage', ...);        // stairs non nul, un seul niveau
it('refuse une porte sans swing', ...);
```

(`set` : petit helper de test local qui clone en profondeur et remplace une valeur par chemin.)

- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter `schema.ts`.** Unicité des ids et cohérence escalier/étage via `superRefine` ; `issues` = messages Zod avec leur chemin (`levels.0.rooms.0.rect.w: …`).
- [ ] **Step 4 : Vérifier le succès.**
- [ ] **Step 5 : Commit** — `feat(domain): schéma de validation du format du plan`.

---

### Tâche 11 : `validatePlan` et API publique

**Files :** Create `packages/domain/src/validate.ts`, `packages/domain/src/validate.test.ts` ; Modify `packages/domain/src/index.ts`

**Interfaces :**
- Consumes : `checkSite`, `checkRoomOverlaps`, `checkRoomAreas`, `checkUpperSupported`, `checkOpenings`, `checkFurniture`, `checkStairs`.
- Produces : `validatePlan(site: Site, params: RuleParams, plan: Plan): Violation[]`. Ordre : site (pièces RDC) → par niveau (chevauchements, surfaces, ouvertures, meubles avec `stairs?.rect` seulement si un `r1` existe) → étage supporté → escalier. Les erreurs précèdent les alertes (tri stable par `severity`).
- `index.ts` exporte : tous les types, `formatMeters`, `formatArea`, `DEFAULT_RULE_PARAMS`, `rectangularSite`, `computeWallSegments`, `furnitureFootprint`, `doorSwingRect`, `doorHinge`, `validatePlan`, `parsePlan`, `planSchema`, `ruleParamsSchema`, `siteSchema`. Les fonctions `check*` ne sont **pas** exportées.

- [ ] **Step 1 : Tests qui échouent**

```ts
it('plan vide → aucune violation', () =>
  expect(validatePlan(rectangularSite(2000, 3000, 'north'), DEFAULT_RULE_PARAMS, { levels: [{ id: 'rdc', rooms: [], openings: [], furniture: [] }], stairs: null })).toEqual([]));
it('maison de démonstration valide', ...);  // séjour + cuisine + chambre à 5 m de la voie, une porte, un lit → []
it('cumule les violations de plusieurs règles, erreurs avant alertes', ...); // étage sans escalier + recul non respecté → ['SETBACK_STREET', 'STAIRS_MISSING']
it('import CJS fonctionne', ...); // dans un test séparé : après build, `require('../dist/index.cjs').validatePlan` est une fonction
```

- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémenter `validate.ts` et compléter `index.ts`.**
- [ ] **Step 4 : Vérifier le succès et la couverture**

Run : `npm run build -w @digimmo/domain && npx -w @digimmo/domain vitest run --coverage`
Expected : tout PASS ; couverture des lignes de `src/` ≥ 90 % (ajouter `@vitest/coverage-v8` en dev).

- [ ] **Step 5 : Vérification globale (identique à la CI)**

Run : `npm ci && npm run build -w @digimmo/domain && npm run lint && npm run typecheck && npm test && npm run build`
Expected : tout passe.

- [ ] **Step 6 : Commit** — `feat(domain): validatePlan et API publique du package`.
