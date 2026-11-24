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
