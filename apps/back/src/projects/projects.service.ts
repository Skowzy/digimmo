import {
  type RuleParams,
  type Site,
  DEFAULT_RULE_PARAMS,
  rectangularSite,
  siteSchema,
} from '@digimmo/domain';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { PlansService } from '../plans/plans.service';
import type { User } from '../users/user.entity';
import { Project } from './project.entity';
import type { CreateProjectDto, UpdateProjectDto } from './projects.schemas';

export interface ProjectDto {
  id: string;
  name: string;
  site: Site;
  rules: RuleParams;
  createdAt: Date;
  updatedAt: Date;
}

export function toProjectDto(p: Project): ProjectDto {
  return {
    id: p.id,
    name: p.name,
    site: { boundary: p.terrainPolygon, streetEdge: p.streetEdge },
    rules: {
      setbackStreetCm: p.setbackStreetCm,
      setbackSidesCm: p.setbackSidesCm,
      maxFootprintPct: p.maxFootprintPct,
      minAreasM2: p.minAreasM2,
    },
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function buildSite(t: NonNullable<CreateProjectDto['terrain']>): Site {
  const site = rectangularSite(t.widthCm, t.depthCm, t.street);
  const check = siteSchema.safeParse(site);
  if (!check.success)
    throw new BadRequestException({ message: 'Données invalides' });
  return site;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly repo: Repository<Project>,
    private readonly plans: PlansService,
  ) {}

  list(userId: string): Promise<Project[]> {
    return this.repo.find({
      where: { owner: { id: userId } },
      order: { updatedAt: 'DESC', id: 'ASC' },
    });
  }

  /** Filtre par propriétaire dans la requête : absent ou à autrui => 404. */
  async findOwned(userId: string, projectId: string): Promise<Project> {
    const project = await this.repo.findOne({
      where: { id: projectId, owner: { id: userId } },
    });
    if (!project)
      throw new NotFoundException({ message: 'Projet introuvable.' });
    return project;
  }

  create(owner: User, dto: CreateProjectDto): Promise<Project> {
    const site = buildSite(dto.terrain);
    const rules = dto.rules ?? DEFAULT_RULE_PARAMS;
    return this.repo.save(
      this.repo.create({
        owner,
        name: dto.name,
        terrainPolygon: site.boundary,
        streetEdge: site.streetEdge,
        ...rules,
      }),
    );
  }

  async update(
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.findOwned(userId, projectId);
    if (dto.name !== undefined) project.name = dto.name;
    if (dto.terrain) {
      const site = buildSite(dto.terrain);
      project.terrainPolygon = site.boundary;
      project.streetEdge = site.streetEdge;
    }
    if (dto.rules) Object.assign(project, dto.rules);
    const saved = await this.repo.save(project);
    if (dto.terrain || dto.rules) await this.plans.revalidate(saved);
    return saved;
  }

  async remove(userId: string, projectId: string): Promise<void> {
    const project = await this.findOwned(userId, projectId);
    // Plan Mongo d'abord : en cas d'échec, un nouvel essai termine le travail (l'inverse laisserait un plan orphelin).
    await this.plans.deleteForProjects([project.id]);
    await this.repo.remove(project);
  }
}
