import type { Level, Violation } from '@digimmo/domain';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from 'mongoose';

/** Le format de `levels`, `stairs` et `violations` est garanti par `parsePlan` en amont. */
@Schema({
  collection: 'plans',
  timestamps: { createdAt: false, updatedAt: true },
})
export class PlanDoc {
  @Prop({ type: String, required: true, unique: true, index: true })
  projectId!: string;

  @Prop({ type: SchemaTypes.Mixed, default: [] })
  levels!: Level[];

  @Prop({ type: SchemaTypes.Mixed, default: null })
  stairs!: { rect: { x: number; y: number; w: number; h: number } } | null;

  @Prop({
    type: SchemaTypes.Mixed,
    default: () => ({ violations: [], checkedAt: new Date() }),
  })
  validation!: { violations: Violation[]; checkedAt: Date };

  updatedAt!: Date;
}

export const PlanSchema = SchemaFactory.createForClass(PlanDoc);
