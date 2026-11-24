import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { User } from '../users/user.entity';
import {
  type CreateProjectDto,
  type UpdateProjectDto,
  createProjectSchema,
  updateProjectSchema,
} from './projects.schemas';
import {
  type ProjectDto,
  ProjectsService,
  toProjectDto,
} from './projects.service';

const uuid = () =>
  new ParseUUIDPipe({
    exceptionFactory: () =>
      new BadRequestException({ message: 'Identifiant invalide.' }),
  });

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  async list(@CurrentUser() user: User): Promise<ProjectDto[]> {
    return (await this.projects.list(user.id)).map(toProjectDto);
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createProjectSchema)) dto: CreateProjectDto,
  ): Promise<ProjectDto> {
    return toProjectDto(await this.projects.create(user, dto));
  }

  @Get(':id')
  async get(
    @CurrentUser() user: User,
    @Param('id', uuid()) id: string,
  ): Promise<ProjectDto> {
    return toProjectDto(await this.projects.findOwned(user.id, id));
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) dto: UpdateProjectDto,
  ): Promise<ProjectDto> {
    return toProjectDto(await this.projects.update(user.id, id, dto));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: User,
    @Param('id', uuid()) id: string,
  ): Promise<void> {
    await this.projects.remove(user.id, id);
  }
}
