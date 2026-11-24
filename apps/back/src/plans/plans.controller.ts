import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProjectsService } from '../projects/projects.service';
import type { User } from '../users/user.entity';
import { type PlanValidation, PlansService } from './plans.service';

const uuid = () =>
  new ParseUUIDPipe({
    exceptionFactory: () =>
      new BadRequestException({ message: 'Identifiant invalide.' }),
  });

@Controller('projects/:id/plan')
export class PlansController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly plans: PlansService,
  ) {}

  @Get()
  async get(@CurrentUser() user: User, @Param('id', uuid()) id: string) {
    return this.plans.get(await this.projects.findOwned(user.id, id));
  }

  @Put()
  async put(
    @CurrentUser() user: User,
    @Param('id', uuid()) id: string,
    @Body() body: unknown,
  ): Promise<{ validation: PlanValidation }> {
    const project = await this.projects.findOwned(user.id, id);
    const res = await this.plans.save(project, body);
    if (!res.ok)
      throw new BadRequestException({
        message: 'Format de plan invalide.',
        issues: res.issues,
      });
    return { validation: res.validation };
  }
}
