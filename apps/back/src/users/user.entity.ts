import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type UserRole = 'user' | 'admin';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Toujours stocké en minuscules (normalisé par le service). */
  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ type: 'varchar' })
  passwordHash!: string;

  @Column({ type: 'varchar', default: 'user' })
  role!: UserRole;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
