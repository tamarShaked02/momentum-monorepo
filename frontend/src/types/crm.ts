/**
 * Shared TypeScript types for CRM entities (frontend).
 * These interfaces match the backend API response shapes.
 * All date fields use `string` since JSON serialization converts Date to string.
 */

// --- Enums & Constants ---

export const LIFECYCLE_STAGES = [
  "lead",
  "prospect",
  "customer",
  "vip",
  "churned",
] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const ACTIVITY_TYPES = [
  "call",
  "email",
  "meeting",
  "note",
  "status_change",
  "deal_stage_change",
  "appointment",
  "telegram_message",
  "task_completed",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const DEAL_STATUSES = ["open", "won", "lost"] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const CUSTOM_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "dropdown",
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const AUTOMATION_TRIGGER_TYPES = [
  "deal_stage_changed",
  "deal_created",
  "deal_stale",
  "contact_lifecycle_changed",
  "appointment_completed",
] as const;
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];

export const AUTOMATION_ACTION_TYPES = [
  "create_task",
  "move_deal_to_stage",
  "change_contact_lifecycle",
  "send_telegram_message",
  "log_activity",
] as const;
export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

// --- Entity Interfaces ---

export interface Contact {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  telegramChatId: string | null;
  notes: string | null;
  company: string | null;
  jobTitle: string | null;
  leadSource: string | null;
  lifecycleStage: LifecycleStage;
  createdAt: string;
  updatedAt: string;
  tags?: ContactTag[];
  customFieldValues?: CustomFieldValue[];
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface ContactTag {
  id: string;
  contactId: string;
  tagId: string;
  assignedAt: string;
  tag?: Tag;
}

export interface Pipeline {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  stages?: Stage[];
}

export interface Stage {
  id: string;
  pipelineId: string;
  name: string;
  position: number;
  isTerminal: boolean;
  dealStatus: string | null;
  createdAt: string;
}

export interface Deal {
  id: string;
  userId: string;
  title: string;
  value: number | null;
  expectedCloseDate: string | null;
  winProbability: number | null;
  pipelineId: string;
  stageId: string;
  contactId: string;
  status: DealStatus;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contact?: Contact;
  stage?: Stage;
  pipeline?: Pipeline;
  items?: DealItem[];
  activities?: Activity[];
}

export interface DealItem {
  id: string;
  dealId: string;
  inventoryItemId: string;
  quantity: number;
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
  inventoryItem?: { id: string; name: string; sku: string | null };
}

export interface Activity {
  id: string;
  userId: string;
  type: ActivityType;
  description: string | null;
  metadata: Record<string, unknown> | null;
  contactId: string | null;
  dealId: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  contact?: { id: string; name: string };
  deal?: { id: string; title: string };
}

export interface AutomationTrigger {
  type: AutomationTriggerType;
  params?: Record<string, unknown>;
}

export interface AutomationAction {
  type: AutomationActionType;
  params: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  userId: string;
  name: string;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  enabled: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRuleLog {
  id: string;
  ruleId: string;
  success: boolean;
  actionType: string;
  error: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CustomField {
  id: string;
  userId: string;
  name: string;
  fieldType: CustomFieldType;
  options: string[];
  position: number;
  createdAt: string;
}

export interface CustomFieldValue {
  id: string;
  customFieldId: string;
  contactId: string;
  value: string;
  createdAt: string;
  updatedAt: string;
  customField?: CustomField;
}

// --- Dashboard & Analytics ---

export interface DashboardMetrics {
  totalPipelineValue: number;
  weightedPipelineValue: number;
  dealsWon: number;
  dealsLost: number;
  winRate: number;
  averageCycleDuration: number;
}

export interface CRMDashboardResponse {
  metrics: DashboardMetrics;
  forecast: ForecastMonth[];
  funnel: FunnelStage[];
  analytics: {
    totalCustomers: number;
    newCustomersThisMonth: number;
    totalPipelineValue: number;
    totalClosedWonValue: number;
  };
}

export interface ForecastMonth {
  month: string;
  weightedValue: number;
  dealCount: number;
}

export interface FunnelStage {
  stageId: string;
  stageName: string;
  dealCount: number;
  totalValue: number;
}

// --- AI Suggestions ---

export interface CRMSuggestion {
  suggestion: string | null;
  reasoning: string | null;
  reason?: "insufficient_activities" | "service_unavailable";
}

export interface ConversationSummary {
  summary: string;
  keyTopics: string[];
  actionItems: string[];
  generatedAt: string;
}

// --- Pagination ---

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// --- Request/Response DTOs ---

export interface ContactListParams extends PaginationParams {
  search?: string;
  lifecycleStage?: LifecycleStage;
  tag?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ContactListResponse {
  data: Contact[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ContactCreateData {
  name: string;
  email?: string | null;
  phone?: string | null;
  telegramChatId?: string | null;
  notes?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  leadSource?: string | null;
  lifecycleStage?: LifecycleStage;
}

export interface ContactUpdateData extends Partial<ContactCreateData> {}

export interface PipelineCreateData {
  name: string;
  stages: {
    name: string;
    position: number;
    isTerminal?: boolean;
    dealStatus?: string | null;
  }[];
}

export interface PipelineUpdateData {
  name?: string;
}

export interface StageCreateData {
  name: string;
  position: number;
  isTerminal?: boolean;
  dealStatus?: string | null;
}

export interface StageUpdateData {
  name?: string;
  position?: number;
  isTerminal?: boolean;
  dealStatus?: string | null;
}

export interface DealListParams extends PaginationParams {
  pipelineId?: string;
  stageId?: string;
  contactId?: string;
  status?: DealStatus;
  minValue?: number;
  maxValue?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface DealListResponse {
  data: Deal[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DealCreateData {
  title: string;
  contactId: string;
  pipelineId: string;
  stageId: string;
  value?: number | null;
  expectedCloseDate?: string | null;
  winProbability?: number | null;
}

export interface DealUpdateData extends Partial<DealCreateData> {
  status?: DealStatus;
}

export interface DealItemCreateData {
  inventoryItemId: string;
  quantity: number;
  unitPrice: number;
}

export interface DealItemUpdateData {
  quantity?: number;
  unitPrice?: number;
}

export interface ActivityListParams extends PaginationParams {
  type?: ActivityType | ActivityType[];
  contactId?: string;
  dealId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ActivityListResponse {
  data: Activity[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ActivityCreateData {
  type: ActivityType;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  contactId?: string | null;
  dealId?: string | null;
}

export interface ActivityUpdateData {
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AutomationRuleListParams extends PaginationParams {
  enabled?: boolean;
}

export interface AutomationRuleCreateData {
  name: string;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  enabled?: boolean;
  position?: number;
}

export interface AutomationRuleUpdateData extends Partial<AutomationRuleCreateData> {}

export interface CustomFieldCreateData {
  name: string;
  fieldType: CustomFieldType;
  options?: string[];
  position?: number;
}

export interface CustomFieldUpdateData {
  name?: string;
  fieldType?: CustomFieldType;
  options?: string[];
  position?: number;
}

export interface CRMDashboardParams {
  startDate?: string;
  endDate?: string;
  pipelineId?: string;
}

export interface CRMDashboardData extends CRMDashboardResponse {}

export type AISuggestion = CRMSuggestion;

export interface SegmentQueryData {
  tags?: string[];
  lifecycleStages?: LifecycleStage[];
}

export interface SegmentQueryResult {
  contacts: Contact[];
  total: number;
}
