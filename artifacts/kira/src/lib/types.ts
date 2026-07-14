import { z } from 'zod';

export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  full_name: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const LoginResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("bearer"),
  user: UserSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const DashboardSummarySchema = z.object({
  total_conversations: z.number(),
  total_artifacts: z.number(),
  artifacts_by_type: z.object({
    requirement_analysis: z.number(),
    test_scenario: z.number(),
    test_case: z.number(),
    bug_report: z.number(),
    security: z.number(),
  }),
  recent_activity: z.array(z.object({
    type: z.string(),
    title: z.string(),
    id: z.number(),
    created_at: z.string(),
  })),
  ai_provider: z.object({
    configured: z.boolean(),
    model: z.string().nullable(),
  }),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;

export const MessageSchema = z.object({
  id: z.number(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  created_at: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ConversationSchema = z.object({
  id: z.number(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  message_count: z.number().optional(),
  messages: z.array(MessageSchema).optional(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const GeneratedArtifactSchema = z.object({
  id: z.number(),
  artifact_type: z.enum(["requirement_analysis", "test_scenario", "test_case", "bug_report", "security"]),
  title: z.string(),
  input_data: z.any(),
  output_data: z.any(),
  created_at: z.string(),
});
export type GeneratedArtifact = z.infer<typeof GeneratedArtifactSchema>;

// Requirement Analysis
export const RequirementAnalysisSchema = z.object({
  summary: z.string(),
  functional_requirements: z.array(z.string()),
  positive_scenarios: z.array(z.string()),
  negative_scenarios: z.array(z.string()),
  edge_cases: z.array(z.string()),
  missing_information: z.array(z.string()),
  risks: z.array(z.string()),
  questions_for_po: z.array(z.string()),
  assumptions: z.array(z.string()),
});
export type RequirementAnalysis = z.infer<typeof RequirementAnalysisSchema>;

// Test Scenarios
export const TestScenarioSchema = z.object({
  scenario_id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(["positive", "negative", "boundary", "edge_case"]),
  priority: z.enum(["High", "Medium", "Low"]),
});
export const TestScenariosResponseSchema = z.object({
  scenarios: z.array(TestScenarioSchema),
});
export type TestScenariosResponse = z.infer<typeof TestScenariosResponseSchema>;

// Test Cases
export const TestCaseSchema = z.object({
  test_case_id: z.string(),
  objective: z.string(),
  preconditions: z.string(),
  test_data: z.string(),
  steps: z.array(z.string()),
  expected_result: z.string(),
  priority: z.enum(["High", "Medium", "Low"]),
  test_type: z.string(),
});
export const TestCasesResponseSchema = z.object({
  test_cases: z.array(TestCaseSchema),
});
export type TestCasesResponse = z.infer<typeof TestCasesResponseSchema>;

// Bug Report
export const BugReportResponseSchema = z.object({
  title: z.string(),
  module: z.string(),
  environment: z.string(),
  preconditions: z.string(),
  steps_to_reproduce: z.array(z.string()),
  expected_result: z.string(),
  actual_result: z.string(),
  severity: z.enum(["Critical", "High", "Medium", "Low"]),
  priority: z.enum(["High", "Medium", "Low"]),
  information_required: z.array(z.string()),
});
export type BugReportResponse = z.infer<typeof BugReportResponseSchema>;
