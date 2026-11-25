export * from './types';
export { formatMeters, formatArea } from './units';
export { DEFAULT_RULE_PARAMS, rectangularSite } from './defaults';
export { computeWallSegments } from './walls';
export type { WallSegment } from './walls';
export { furnitureFootprint, containsRect } from './geometry';
export { doorSwingRect, doorHinge } from './rules/openings';
export { validatePlan } from './validate';
export { parsePlan, planSchema, ruleParamsSchema, siteSchema } from './schema';
