import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlanDoc, PlanSchema } from './plan.schema';
import { PlansService } from './plans.service';

/** Sans dépendance vers ProjectsModule : c'est lui qui l'importe (le contrôleur de plans vit dans ProjectsModule). */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: PlanDoc.name, schema: PlanSchema }]),
  ],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
