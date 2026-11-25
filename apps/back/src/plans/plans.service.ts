import {
  type Plan,
  type Violation,
  parsePlan,
  validatePlan,
} from '@digimmo/domain';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Project } from '../projects/project.entity';
import { siteAndRules } from '../projects/site-and-rules';
import { PlanDoc } from './plan.schema';

export const EMPTY_PLAN: Plan = {
  levels: [{ id: 'rdc', rooms: [], openings: [], furniture: [] }],
  stairs: null,
};

export interface PlanValidation {
  violations: Violation[];
  checkedAt: string;
}

export type PlanResult =
  { ok: true; validation: PlanValidation } | { ok: false; issues: unknown };

function check(project: Project, plan: Plan): PlanValidation {
  const { site, rules } = siteAndRules(project);
  return {
    violations: validatePlan(site, rules, plan),
    checkedAt: new Date().toISOString(),
  };
}

@Injectable()
export class PlansService {
  constructor(
    @InjectModel(PlanDoc.name) private readonly model: Model<PlanDoc>,
  ) {}

  /** Sans document : plan vide, validation à la volée, rien n'est écrit. */
  async get(
    project: Project,
  ): Promise<{ plan: Plan; validation: PlanValidation }> {
    const doc = await this.model.findOne({ projectId: project.id }).lean();
    if (!doc)
      return { plan: EMPTY_PLAN, validation: check(project, EMPTY_PLAN) };
    return {
      plan: { levels: doc.levels, stairs: doc.stairs },
      validation: {
        violations: doc.validation.violations,
        checkedAt: new Date(doc.validation.checkedAt).toISOString(),
      },
    };
  }

  /** Plans enregistrés par projet, en une requête ; absent = pas de plan (aucun plan vide de substitution). */
  async findStoredMany(projectIds: string[]): Promise<Map<string, Plan>> {
    if (projectIds.length === 0) return new Map();
    const docs = await this.model
      .find({ projectId: { $in: projectIds } })
      .lean();
    return new Map(
      docs.map((d) => [d.projectId, { levels: d.levels, stairs: d.stairs }]),
    );
  }

  /** Stocke le plan PARSÉ (jamais le corps brut) ; un plan qui viole des règles reste un brouillon valide. */
  async save(project: Project, body: unknown): Promise<PlanResult> {
    const parsed = parsePlan(body);
    if (!parsed.ok) return { ok: false, issues: parsed.issues };
    const { plan } = parsed;
    const validation = check(project, plan);
    await this.model.findOneAndUpdate(
      { projectId: project.id },
      {
        $set: {
          levels: plan.levels,
          stairs: plan.stairs,
          validation: {
            violations: validation.violations,
            checkedAt: new Date(validation.checkedAt),
          },
        },
      },
      { upsert: true },
    );
    return { ok: true, validation };
  }

  /** Recalcule `validation` si un plan existe (terrain ou règles modifiés). */
  async revalidate(project: Project): Promise<void> {
    const doc = await this.model.findOne({ projectId: project.id }).lean();
    if (!doc) return;
    const validation = check(project, {
      levels: doc.levels,
      stairs: doc.stairs,
    });
    // Seulement si le plan n'a pas changé depuis la lecture : sinon la sauvegarde plus récente
    // a déjà validé avec les règles à jour, et on écraserait son résultat par celui d'un plan périmé.
    await this.model.updateOne(
      { projectId: project.id, updatedAt: doc.updatedAt },
      {
        $set: {
          validation: {
            violations: validation.violations,
            checkedAt: new Date(validation.checkedAt),
          },
        },
      },
    );
  }

  async deleteForProjects(projectIds: string[]): Promise<void> {
    if (projectIds.length === 0) return;
    await this.model.deleteMany({ projectId: { $in: projectIds } });
  }
}
