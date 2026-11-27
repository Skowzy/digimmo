import { createContext, useContext, type Dispatch } from 'react'
import type { Action } from './reducer'
import type { EditorState } from './types'

export interface EditorContextValue { state: EditorState; dispatch: Dispatch<Action> }

export const EditorContext = createContext<EditorContextValue | null>(null)

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor doit être utilisé dans un EditorProvider')
  return ctx
}
