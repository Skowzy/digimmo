import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlansModule } from '../plans/plans.module';
import { ProjectsModule } from '../projects/projects.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [AuthModule, ProjectsModule, PlansModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
