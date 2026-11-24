import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email: email.trim().toLowerCase() });
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  /** Le rôle n'est jamais fourni par l'appelant : la base applique 'user'. */
  async create(email: string, passwordHash: string): Promise<User> {
    const user = this.repo.create({
      email: email.trim().toLowerCase(),
      passwordHash,
    });
    return this.repo.save(user);
  }
}
