import { useMemo, useReducer, type ReactNode } from 'react'
import { editorReducer } from './reducer'
import { EditorContext } from './useEditor'
import type { EditorState } from './types'

// Le hook useEditor vit dans useEditor.ts (règle react-refresh : ce fichier n'exporte que des composants).
export function EditorProvider({ initial, children }: { initial: EditorState; children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, initial)
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}
