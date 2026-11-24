import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Plan, RuleParams, Site, Violation } from '@digimmo/domain'
import { api } from './api'

export type ProjectDto = { id: string; name: string; site: Site; rules: RuleParams; createdAt: string; updatedAt: string }
export type Terrain = { widthCm: number; depthCm: number; street: 'north' | 'south' | 'east' | 'west' }
export type PlanResponse = { plan: Plan; validation: { violations: Violation[]; checkedAt: string } }

export const useProjects = () =>
  useQuery({ queryKey: ['projects'], queryFn: () => api<ProjectDto[]>('/projects') })

export const useProject = (id: string) =>
  useQuery({ queryKey: ['projects', id], queryFn: () => api<ProjectDto>(`/projects/${id}`) })

export const usePlan = (id: string) =>
  useQuery({ queryKey: ['projects', id, 'plan'], queryFn: () => api<PlanResponse>(`/projects/${id}/plan`) })

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; terrain: Terrain; rules?: RuleParams }) =>
      api<ProjectDto>('/projects', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { name?: string; terrain?: Terrain; rules?: RuleParams }) =>
      api<ProjectDto>(`/projects/${id}`, { method: 'PATCH', body }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
      queryClient.invalidateQueries({ queryKey: ['projects', id] }),
      queryClient.invalidateQueries({ queryKey: ['projects', id, 'plan'] }),
    ]),
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ['projects', id] })
      return queryClient.invalidateQueries({ queryKey: ['projects'], exact: true })
    },
  })
}

export type FurnitureCategory = 'chambre' | 'cuisine' | 'sdb' | 'sejour' | 'autre'
export type FurnitureItem = { id: string; category: FurnitureCategory; name: string; widthCm: number; depthCm: number; symbol: string }
export type FurnitureInput = Omit<FurnitureItem, 'id'>

export const useCatalog = () =>
  useQuery({ queryKey: ['catalog'], queryFn: () => api<FurnitureItem[]>('/catalog') })

export function useCreateFurniture() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: FurnitureInput) => api<FurnitureItem>('/admin/catalog', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog'] }),
  })
}

export function useUpdateFurniture() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<FurnitureInput> & { id: string }) =>
      api<FurnitureItem>(`/admin/catalog/${id}`, { method: 'PATCH', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog'] }),
  })
}

export function useDeleteFurniture() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/admin/catalog/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog'] }),
  })
}
