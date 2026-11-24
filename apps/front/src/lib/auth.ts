import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api, ApiError } from './api'

export type Me = { id: string; email: string; role: 'user' | 'admin' }
type Credentials = { email: string; password: string }

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<Me>('/auth/me')
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: 60_000,
  })
}

function useAuthMutation(path: '/auth/login' | '/auth/register') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Credentials) => api<Me>(path, { method: 'POST', body }),
    onSuccess: (user) => queryClient.setQueryData(['me'], user),
  })
}

export const useLogin = () => useAuthMutation('/auth/login')
export const useRegister = () => useAuthMutation('/auth/register')

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear()
      navigate('/')
    },
  })
}

/** Valide le paramètre `suite` : uniquement un chemin interne (pas d'open redirect). */
export function cheminSuite(suite: string | null): string {
  if (suite && suite.startsWith('/') && !suite.startsWith('//') && !suite.startsWith('/\\')) return suite
  return '/projets'
}
