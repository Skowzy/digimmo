import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type FurnitureCategory =
  'chambre' | 'cuisine' | 'sdb' | 'sejour' | 'autre';

@Entity('furniture_item')
export class FurnitureItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  category!: FurnitureCategory;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  @Column({ type: 'int' })
  widthCm!: number;

  @Column({ type: 'int' })
  depthCm!: number;

  /** Identifiant de pictogramme dessiné par le front. */
  @Column({ type: 'varchar' })
  symbol!: string;
}
