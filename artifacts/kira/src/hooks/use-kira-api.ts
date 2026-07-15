import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { 
  DashboardSummary, 
  Conversation, 
  GeneratedArtifact,
  RequirementAnalysis,
  TestScenariosResponse,
  TestCasesResponse,
  BugReportResponse,
  KnowledgeBase,
  KBDocument,
  RAGAnswer,
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
    mutationFn: (data: { content: string; knowledge_base_id?: number | null; attachment_ids?: number[] }) =>
      apiFetch<any>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// ── Chat Attachments ──────────────────────────────────────────────────────────

export function useUploadChatAttachment() {
  const baseUrl = (import.meta.env.BASE_URL as string).replace(/\/$/, '');
  return useMutation({
    mutationFn: async (file: File) => {
      const token = localStorage.getItem('kira_auth_token');
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${baseUrl}/api/attachments`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? 'Upload failed');
      }
      return res.json();
    },
  });
}

export function useDeleteChatAttachment() {
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/attachments/${id}`, { method: 'DELETE' }),
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

// --- Knowledge Base ---

export function useKnowledgeBases() {
  return useQuery({
    queryKey: ['knowledge-bases'],
    queryFn: () => apiFetch<KnowledgeBase[]>('/knowledge-bases'),
  });
}

export function useKnowledgeBase(id: number | null) {
  return useQuery({
    queryKey: ['knowledge-bases', id],
    queryFn: () => apiFetch<KnowledgeBase>(`/knowledge-bases/${id}`),
    enabled: !!id,
  });
}

export function useCreateKnowledgeBase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiFetch<KnowledgeBase>('/knowledge-bases', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] }),
  });
}

export function useDeleteKnowledgeBase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/knowledge-bases/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] }),
  });
}

export function useKBDocuments(kbId: number | null) {
  return useQuery({
    queryKey: ['kb-documents', kbId],
    queryFn: () => apiFetch<KBDocument[]>(`/knowledge-bases/${kbId}/documents`),
    enabled: !!kbId,
    refetchInterval: (query) => {
      // Auto-refresh while any doc is still processing
      const docs = query.state.data as KBDocument[] | undefined;
      const processing = docs?.some(d => d.processing_status === 'uploaded' || d.processing_status === 'processing');
      return processing ? 3000 : false;
    },
  });
}

export function useUploadDocument(kbId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const token = localStorage.getItem('kira_auth_token');
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '') + '/api';
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${baseUrl}/knowledge-bases/${kbId}/documents`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? 'Upload failed');
      }
      return res.json() as Promise<KBDocument>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kb-documents', kbId] }),
  });
}

export function useDeleteDocument(kbId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (docId: number) =>
      apiFetch(`/knowledge-bases/${kbId}/documents/${docId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kb-documents', kbId] }),
  });
}

export function useAskKnowledgeBase(kbId: number) {
  return useMutation({
    mutationFn: (data: { question: string; allow_general_knowledge?: boolean }) =>
      apiFetch<RAGAnswer>(`/knowledge-bases/${kbId}/ask`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}
