import { z } from "zod";
import {
  LIFECYCLE_STAGES,
  ACTIVITY_TYPES,
  CUSTOM_FIELD_TYPES,
  AUTOMATION_TRIGGER_TYPES,
  AUTOMATION_ACTION_TYPES,
} from "../types/crm";

// --- Contact Schemas ---

export const createContactSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be at most 200 characters"),
  email: z
    .string()
    .email("Invalid email address")
    .max(254, "Email must be at most 254 characters")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(30, "Phone must be at most 30 characters")
    .optional()
    .or(z.literal("")),
  telegramChatId: z.string().optional().nullable(),
  notes: z
    .string()
    .max(5000, "Notes must be at most 5000 characters")
    .optional()
    .nullable(),
  company: z
    .string()
    .max(200, "Company must be at most 200 characters")
    .optional()
    .nullable(),
  jobTitle: z
    .string()
    .max(200, "Job title must be at most 200 characters")
    .optional()
    .nullable(),
  leadSource: z
    .string()
    .max(100, "Lead source must be at most 100 characters")
    .optional()
    .nullable(),
  lifecycleStage: z.enum(LIFECYCLE_STAGES).optional(),
});

export const updateContactSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be at most 200 characters")
    .optional(),
  email: z
    .string()
    .email("Invalid email address")
    .max(254, "Email must be at most 254 characters")
    .optional()
    .nullable()
    .or(z.literal("")),
  phone: z
    .string()
    .max(30, "Phone must be at most 30 characters")
    .optional()
    .nullable()
    .or(z.literal("")),
  telegramChatId: z.string().optional().nullable(),
  notes: z
    .string()
    .max(5000, "Notes must be at most 5000 characters")
    .optional()
    .nullable(),
  company: z
    .string()
    .max(200, "Company must be at most 200 characters")
    .optional()
    .nullable(),
  jobTitle: z
    .string()
    .max(200, "Job title must be at most 200 characters")
    .optional()
    .nullable(),
  leadSource: z
    .string()
    .max(100, "Lead source must be at most 100 characters")
    .optional()
    .nullable(),
  lifecycleStage: z.enum(LIFECYCLE_STAGES).optional(),
});

// --- Tag Schemas ---

export const createTagSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name is required")
    .max(100, "Tag name must be at most 100 characters"),
  color: z
    .string()
    .max(7, "Color must be at most 7 characters")
    .regex(
      /^#[0-9a-fA-F]{6}$/,
      "Color must be a valid hex color (e.g. #FF0000)",
    )
    .optional()
    .nullable(),
});

// --- Pipeline Schemas ---

const stageInputSchema = z.object({
  name: z
    .string()
    .min(1, "Stage name is required")
    .max(50, "Stage name must be at most 50 characters"),
  isTerminal: z.boolean().optional(),
  dealStatus: z.enum(["won", "lost"]).optional().nullable(),
});

export const createPipelineSchema = z.object({
  name: z
    .string()
    .min(1, "Pipeline name is required")
    .max(100, "Pipeline name must be at most 100 characters"),
  stages: z
    .array(stageInputSchema)
    .min(2, "Pipeline must have at least 2 stages")
    .max(20, "Pipeline must have at most 20 stages"),
});

export const updatePipelineSchema = z.object({
  name: z
    .string()
    .min(1, "Pipeline name is required")
    .max(100, "Pipeline name must be at most 100 characters"),
});

// --- Stage Schemas ---

export const createStageSchema = z.object({
  name: z
    .string()
    .min(1, "Stage name is required")
    .max(50, "Stage name must be at most 50 characters"),
  position: z.number().int("Position must be an integer").min(0),
  isTerminal: z.boolean().optional(),
  dealStatus: z.enum(["won", "lost"]).optional().nullable(),
});

export const updateStageSchema = z.object({
  name: z
    .string()
    .min(1, "Stage name is required")
    .max(50, "Stage name must be at most 50 characters")
    .optional(),
  position: z.number().int("Position must be an integer").min(0).optional(),
  isTerminal: z.boolean().optional(),
  dealStatus: z.enum(["won", "lost"]).optional().nullable(),
});

// --- Deal Schemas ---

export const createDealSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters"),
  contactId: z.string().min(1, "Contact is required"),
  pipelineId: z.string().min(1, "Pipeline is required"),
  stageId: z.string().min(1, "Stage is required"),
  value: z
    .number()
    .min(0.01, "Value must be at least 0.01")
    .max(999999999.99, "Value must be at most 999,999,999.99")
    .optional()
    .nullable(),
  expectedCloseDate: z.string().optional().nullable(),
  winProbability: z
    .number()
    .int("Win probability must be an integer")
    .min(0, "Win probability must be at least 0")
    .max(100, "Win probability must be at most 100")
    .optional()
    .nullable(),
});

export const updateDealSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters")
    .optional(),
  contactId: z.string().min(1, "Contact is required").optional(),
  pipelineId: z.string().min(1, "Pipeline is required").optional(),
  stageId: z.string().min(1, "Stage is required").optional(),
  value: z
    .number()
    .min(0.01, "Value must be at least 0.01")
    .max(999999999.99, "Value must be at most 999,999,999.99")
    .optional()
    .nullable(),
  expectedCloseDate: z.string().optional().nullable(),
  winProbability: z
    .number()
    .int("Win probability must be an integer")
    .min(0, "Win probability must be at least 0")
    .max(100, "Win probability must be at most 100")
    .optional()
    .nullable(),
  status: z.enum(["open", "won", "lost"]).optional(),
});

export const updateDealStageSchema = z.object({
  stageId: z.string().min(1, "Stage is required"),
});

// --- Deal Item Schemas ---

export const createDealItemSchema = z.object({
  inventoryItemId: z.string().min(1, "Inventory item is required"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(10000, "Quantity must be at most 10,000"),
  unitPrice: z
    .number()
    .min(0.01, "Unit price must be at least 0.01")
    .max(999999.99, "Unit price must be at most 999,999.99"),
});

export const updateDealItemSchema = z.object({
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(10000, "Quantity must be at most 10,000")
    .optional(),
  unitPrice: z
    .number()
    .min(0.01, "Unit price must be at least 0.01")
    .max(999999.99, "Unit price must be at most 999,999.99")
    .optional(),
});

// --- Activity Schemas ---

export const createActivitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  description: z
    .string()
    .max(5000, "Description must be at most 5000 characters")
    .optional()
    .nullable(),
  contactId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const updateActivitySchema = z.object({
  description: z
    .string()
    .max(5000, "Description must be at most 5000 characters")
    .optional()
    .nullable(),
});

// --- Automation Rule Schemas ---

const automationTriggerSchema = z.object({
  type: z.enum(AUTOMATION_TRIGGER_TYPES),
  params: z.record(z.unknown()).optional(),
});

const automationActionSchema = z.object({
  type: z.enum(AUTOMATION_ACTION_TYPES),
  params: z.record(z.unknown()),
});

export const createAutomationRuleSchema = z.object({
  name: z
    .string()
    .min(1, "Rule name is required")
    .max(200, "Rule name must be at most 200 characters"),
  trigger: automationTriggerSchema,
  actions: z
    .array(automationActionSchema)
    .min(1, "At least 1 action is required")
    .max(10, "At most 10 actions are allowed"),
  enabled: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const updateAutomationRuleSchema = z.object({
  name: z
    .string()
    .min(1, "Rule name is required")
    .max(200, "Rule name must be at most 200 characters")
    .optional(),
  trigger: automationTriggerSchema.optional(),
  actions: z
    .array(automationActionSchema)
    .min(1, "At least 1 action is required")
    .max(10, "At most 10 actions are allowed")
    .optional(),
  enabled: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const toggleAutomationRuleSchema = z.object({
  enabled: z.boolean(),
});

// --- Custom Field Schemas ---

export const createCustomFieldSchema = z.object({
  name: z
    .string()
    .min(1, "Field name is required")
    .max(100, "Field name must be at most 100 characters"),
  fieldType: z.enum(CUSTOM_FIELD_TYPES),
  options: z
    .array(z.string().min(1).max(200))
    .max(50, "At most 50 dropdown options are allowed")
    .optional(),
  position: z.number().int().min(0).optional(),
});

export const updateCustomFieldSchema = z.object({
  name: z
    .string()
    .min(1, "Field name is required")
    .max(100, "Field name must be at most 100 characters")
    .optional(),
  fieldType: z.enum(CUSTOM_FIELD_TYPES).optional(),
  options: z
    .array(z.string().min(1).max(200))
    .max(50, "At most 50 dropdown options are allowed")
    .optional(),
  position: z.number().int().min(0).optional(),
});
