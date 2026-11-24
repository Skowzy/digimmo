import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Plan, RuleParams, Site, Violation } from '@digimmo/domain'
import { api } from './api'

export type ProjectDto = { id: string; name: string; site: Site; rules: RuleParams; createdAt: string; updatedAt: string }
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
    mutationFn: (body: { name: string; site: Site; rules?: RuleParams }) =>
      api<ProjectDto>('/projects', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { name?: string; site?: Site; rules?: RuleParams }) =>
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
