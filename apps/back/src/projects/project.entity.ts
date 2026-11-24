import type { Point, RoomType } from '@digimmo/domain';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('project')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  owner!: User;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'jsonb' })
  terrainPolygon!: Point[];

  @Column({ type: 'int' })
  streetEdge!: number;

  @Column({ type: 'int' })
  setbackStreetCm!: number;

  @Column({ type: 'int' })
  setbackSidesCm!: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: {
      to: (v: number) => v,
      from: (v: string | null) => (v === null ? v : Number(v)),
    },
  })
  maxFootprintPct!: number;

  @Column({ type: 'jsonb', default: {} })
  minAreasM2!: Partial<Record<RoomType, number>>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
