import type { Plan } from '@digimmo/domain';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PlansService } from '../plans/plans.service';
import {
  type ProjectDto,
  ProjectsService,
  toProjectDto,
} from '../projects/projects.service';
import type { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

export interface AccountExport {
  exportedAt: string;
  user: { email: string; role: string; createdAt: Date };
  projects: (ProjectDto & { plan: Plan | null })[];
}

@Injectable()
export class AccountService {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly projects: ProjectsService,
    private readonly plans: PlansService,
  ) {}

  /** Champs choisis un à un : jamais d'entité étalée (hash, jetons). */
  async export(user: User): Promise<AccountExport> {
    const projects = await this.projects.list(user.id);
    const plans = await this.plans.findStoredMany(projects.map((p) => p.id));
    return {
      exportedAt: new Date().toISOString(),
      user: { email: user.email, role: user.role, createdAt: user.createdAt },
      projects: projects.map((p) => ({
        ...toProjectDto(p),
        plan: plans.get(p.id) ?? null,
      })),
    };
  }

  async delete(user: User, password: string): Promise<void> {
    if (!(await this.auth.verifyPassword(user, password))) {
      throw new ForbiddenException({ message: 'Mot de passe incorrect.' });
    }
    // Plans Mongo d'abord : en cas d'échec ensuite, un nouvel essai termine le travail
    // (l'inverse laisserait des plans orphelins).
    const projects = await this.projects.list(user.id);
    await this.plans.deleteForProjects(projects.map((p) => p.id));
    await this.users.remove(user.id);
  }
}
