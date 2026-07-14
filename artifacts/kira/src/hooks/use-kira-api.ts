import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { 
  DashboardSummary, 
  Conversation, 
  GeneratedArtifact,
  RequirementAnalysis,
  TestScenariosResponse,
  TestCasesResponse,
  BugReportResponse
} from '@/lib/types';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardSummary>('/dashboard/summary'),
  });
}

// --- Conversations ---

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiFetch<Conversation[]>('/conversations'),
  });
}

export function useConversation(id: number | null) {
  return useQuery({
    queryKey: ['conversations', id],
    queryFn: () => apiFetch<Conversation>(`/conversations/${id}`),
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: { title?: string }) => apiFetch<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useSendMessage(conversationId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { content: string }) => apiFetch<any>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// --- Artifacts ---

export function useArtifacts(type?: string) {
  return useQuery({
    queryKey: ['artifacts', { type }],
    queryFn: () => {
      const qs = type ? `?artifact_type=${encodeURIComponent(type)}` : '';
      return apiFetch<GeneratedArtifact[]>(`/artifacts${qs}`);
    },
  });
}

export function useArtifact(id: number | null) {
  return useQuery({
    queryKey: ['artifacts', id],
    queryFn: () => apiFetch<GeneratedArtifact>(`/artifacts/${id}`),
    enabled: !!id,
  });
}

export function useSaveArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { artifact_type: string, title: string, input_data: any, output_data: any }) => 
      apiFetch<GeneratedArtifact>('/artifacts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifacts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/artifacts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifacts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// --- Generators ---

export function useGenerateRequirementAnalysis() {
  return useMutation({
    mutationFn: (data: { requirement_text: string }) => 
      apiFetch<RequirementAnalysis>('/requirement-analyzer/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useGenerateTestScenarios() {
  return useMutation({
    mutationFn: (data: { module_name: string, feature_name: string, requirement: string }) => 
      apiFetch<TestScenariosResponse>('/test-scenarios/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useGenerateTestCases() {
  return useMutation({
    mutationFn: (data: { module: string, requirement: string, number_of_test_cases: number }) => 
      apiFetch<TestCasesResponse>('/test-cases/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useGenerateBugReport() {
  return useMutation({
    mutationFn: (data: { description: string, module: string, environment: string, reproduction_steps: string }) => 
      apiFetch<BugReportResponse>('/bug-reports/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}
