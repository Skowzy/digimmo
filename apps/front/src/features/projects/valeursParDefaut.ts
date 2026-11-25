import { DEFAULT_RULE_PARAMS } from '@digimmo/domain'
import type { RuleParams } from '@digimmo/domain'
import type { Terrain } from '../../lib/queries'

export type ProjectSettingsValues = { name: string; terrain: Terrain | null; rules: RuleParams }

export const VALEURS_PAR_DEFAUT: ProjectSettingsValues = { name: '', terrain: null, rules: DEFAULT_RULE_PARAMS }
