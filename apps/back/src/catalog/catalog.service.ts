import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type {
  FurnitureItemDto,
  FurnitureItemPatchDto,
} from './catalog.schemas';
import { FurnitureCategory, FurnitureItem } from './furniture-item.entity';

const CATEGORY_ORDER: FurnitureCategory[] = [
  'chambre',
  'cuisine',
  'sdb',
  'sejour',
  'autre',
];

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(FurnitureItem)
    private readonly repo: Repository<FurnitureItem>,
  ) {}

  /**
   * Tri en mémoire (catalogue réduit) : ordre des catégories de l'énumération,
   * puis nom avec collation française (l'ordre SQL dépend de la locale de la base).
   */
  async list(): Promise<FurnitureItem[]> {
    const items = await this.repo.find();
    return items.sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) -
          CATEGORY_ORDER.indexOf(b.category) ||
        a.name.localeCompare(b.name, 'fr'),
    );
  }

  create(dto: FurnitureItemDto): Promise<FurnitureItem> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: FurnitureItemPatchDto): Promise<FurnitureItem> {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw this.notFound();
    return this.repo.save(Object.assign(item, dto));
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete({ id });
    if (!res.affected) throw this.notFound();
  }

  private notFound() {
    return new NotFoundException({ message: 'Meuble introuvable.' });
  }
}
