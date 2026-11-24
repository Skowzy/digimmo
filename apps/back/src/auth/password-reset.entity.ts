import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('password_reset')
export class PasswordReset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  user!: User;

  @Column({ type: 'varchar', unique: true })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt!: Date | null;
}
