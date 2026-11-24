import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { resetSession } from '../app/resetSession'
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
  const { pathname } = useLocation()
  const sortie = useRef(false)

  // Réinitialiser `['me']` seulement une fois sur l'accueil : sinon RequireAuth renverrait vers /connexion.
  useEffect(() => {
    if (sortie.current && pathname === '/') {
      sortie.current = false
      resetSession(queryClient)
    }
  }, [pathname, queryClient])

  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    // En cas d'échec réseau/serveur, la session est aussi réinitialisée localement.
    onSettled: () => {
      if (pathname === '/') resetSession(queryClient)
      else {
        sortie.current = true
        void navigate('/')
      }
    },
  })
}

/** Valide le paramètre `suite` : uniquement un chemin interne (pas d'open redirect). */
export function cheminSuite(suite: string | null): string {
  // eslint-disable-next-line no-control-regex -- on rejette volontairement les caractères de contrôle
  if (suite && suite.startsWith('/') && !suite.startsWith('//') && !/[\\\u0000-\u001f]/.test(suite)) return suite
  return '/projets'
}
