import type { LevelId, Plan } from '@digimmo/domain'

export type Tool = 'select' | 'room' | 'door' | 'window' | 'furniture' | 'stairs'
export type Selection = { kind: 'room' | 'opening' | 'furniture' | 'stairs'; id: string } | null
export interface View { x: number; y: number; width: number; height: number } // viewBox en cm
export interface EditorState {
  plan: Plan
  levelId: LevelId
  tool: Tool
  selection: Selection
  view: View
  past: Plan[]
  future: Plan[]
  savedPlan: Plan
  pendingFurniture: string | null // catalogId à poser
}
