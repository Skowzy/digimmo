import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlansController } from '../plans/plans.controller';
import { PlansModule } from '../plans/plans.module';
import { Project } from './project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project]), PlansModule],
  controllers: [ProjectsController, PlansController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
