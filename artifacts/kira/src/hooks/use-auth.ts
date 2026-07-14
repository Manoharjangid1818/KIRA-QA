import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, setToken, removeToken } from '@/lib/api';
import type { User, LoginResponse } from '@/lib/types';
import { useLocation } from 'wouter';
import { useEffect } from 'react';

export function useAuth() {
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const userQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<User>('/auth/me'),
    retry: false,
  });

  useEffect(() => {
    const handleAuthError = () => {
      queryClient.setQueryData(['auth', 'me'], null);
      setLocation('/login');
    };
    window.addEventListener('auth_error', handleAuthError);
    return () => window.removeEventListener('auth_error', handleAuthError);
  }, [setLocation, queryClient]);

  const loginMutation = useMutation({
    mutationFn: (data: any) => apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: (data) => {
      setToken(data.access_token);
      queryClient.setQueryData(['auth', 'me'], data.user);
      setLocation('/dashboard');
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: any) => apiFetch<LoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: (data) => {
      setToken(data.access_token);
      queryClient.setQueryData(['auth', 'me'], data.user);
      setLocation('/dashboard');
    },
  });

  const logout = () => {
    removeToken();
    queryClient.setQueryData(['auth', 'me'], null);
    setLocation('/login');
  };

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    isError: userQuery.isError,
    login: loginMutation,
    register: registerMutation,
    logout,
  };
}
