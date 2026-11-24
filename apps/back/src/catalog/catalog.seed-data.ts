import type { FurnitureCategory } from './furniture-item.entity';

export interface CatalogSeedItem {
  category: FurnitureCategory;
  name: string;
  widthCm: number;
  depthCm: number;
  /** Identifiant de pictogramme dessiné par le front. */
  symbol: string;
}

export const CATALOG_SEED: CatalogSeedItem[] = [
  {
    category: 'chambre',
    name: 'Lit simple',
    widthCm: 90,
    depthCm: 190,
    symbol: 'bed-single',
  },
  {
    category: 'chambre',
    name: 'Lit double',
    widthCm: 140,
    depthCm: 190,
    symbol: 'bed-double',
  },
  {
    category: 'chambre',
    name: 'Lit',
    widthCm: 160,
    depthCm: 200,
    symbol: 'bed-queen',
  },
  {
    category: 'chambre',
    name: 'Armoire',
    widthCm: 100,
    depthCm: 60,
    symbol: 'wardrobe',
  },
  {
    category: 'chambre',
    name: 'Bureau',
    widthCm: 120,
    depthCm: 60,
    symbol: 'desk',
  },
  {
    category: 'chambre',
    name: 'Chevet',
    widthCm: 45,
    depthCm: 40,
    symbol: 'nightstand',
  },

  {
    category: 'cuisine',
    name: 'Évier',
    widthCm: 120,
    depthCm: 60,
    symbol: 'sink',
  },
  {
    category: 'cuisine',
    name: 'Plaque de cuisson',
    widthCm: 60,
    depthCm: 60,
    symbol: 'hob',
  },
  {
    category: 'cuisine',
    name: 'Réfrigérateur',
    widthCm: 60,
    depthCm: 65,
    symbol: 'fridge',
  },
  {
    category: 'cuisine',
    name: 'Lave-vaisselle',
    widthCm: 60,
    depthCm: 60,
    symbol: 'dishwasher',
  },
  {
    category: 'cuisine',
    name: 'Îlot',
    widthCm: 180,
    depthCm: 90,
    symbol: 'kitchen-island',
  },
  {
    category: 'cuisine',
    name: 'Table',
    widthCm: 160,
    depthCm: 90,
    symbol: 'table',
  },

  { category: 'sdb', name: 'WC', widthCm: 40, depthCm: 65, symbol: 'toilet' },
  {
    category: 'sdb',
    name: 'Lavabo',
    widthCm: 60,
    depthCm: 45,
    symbol: 'washbasin',
  },
  {
    category: 'sdb',
    name: 'Douche',
    widthCm: 90,
    depthCm: 90,
    symbol: 'shower',
  },
  {
    category: 'sdb',
    name: 'Baignoire',
    widthCm: 170,
    depthCm: 75,
    symbol: 'bathtub',
  },

  {
    category: 'sejour',
    name: 'Canapé',
    widthCm: 220,
    depthCm: 95,
    symbol: 'sofa',
  },
  {
    category: 'sejour',
    name: 'Table basse',
    widthCm: 110,
    depthCm: 60,
    symbol: 'coffee-table',
  },
  {
    category: 'sejour',
    name: 'Table à manger',
    widthCm: 180,
    depthCm: 90,
    symbol: 'dining-table',
  },
  {
    category: 'sejour',
    name: 'Meuble TV',
    widthCm: 160,
    depthCm: 45,
    symbol: 'tv-unit',
  },
];
