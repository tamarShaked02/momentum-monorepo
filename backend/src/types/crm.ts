/**
 * Shared TypeScript types for CRM entities.
 * These interfaces mirror the Prisma schema models for CRM-related entities.
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
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  createdAt: Date;
}

export interface ContactTag {
  id: string;
  contactId: string;
  tagId: string;
  assignedAt: Date;
}

export interface CustomField {
  id: string;
  userId: string;
  name: string;
  fieldType: CustomFieldType;
  options: string[];
  position: number;
  createdAt: Date;
}

export interface CustomFieldValue {
  id: string;
  customFieldId: string;
  contactId: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Pipeline {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Stage {
  id: string;
  pipelineId: string;
  name: string;
  position: number;
  isTerminal: boolean;
  dealStatus: string | null;
  createdAt: Date;
}

export interface Deal {
  id: string;
  userId: string;
  title: string;
  value: number | null;
  expectedCloseDate: Date | null;
  winProbability: number | null;
  pipelineId: string;
  stageId: string;
  contactId: string;
  status: DealStatus;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DealItem {
  id: string;
  dealId: string;
  inventoryItemId: string;
  quantity: number;
  unitPrice: number;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationRuleLog {
  id: string;
  ruleId: string;
  success: boolean;
  actionType: string;
  error: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}
