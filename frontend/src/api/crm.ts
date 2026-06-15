import api from "./client";
import type {
  Contact,
  ContactListParams,
  ContactListResponse,
  ContactCreateData,
  ContactUpdateData,
  Tag,
  Pipeline,
  PipelineCreateData,
  PipelineUpdateData,
  Stage,
  StageCreateData,
  StageUpdateData,
  Deal,
  DealListParams,
  DealListResponse,
  DealCreateData,
  DealUpdateData,
  DealItem,
  DealItemCreateData,
  DealItemUpdateData,
  Activity,
  ActivityListParams,
  ActivityListResponse,
  ActivityCreateData,
  ActivityUpdateData,
  AutomationRule,
  AutomationRuleListParams,
  AutomationRuleCreateData,
  AutomationRuleUpdateData,
  AutomationRuleLog,
  CustomField,
  CustomFieldCreateData,
  CustomFieldUpdateData,
  CustomFieldValue,
  CRMDashboardData,
  CRMDashboardParams,
  AISuggestion,
  ConversationSummary,
  SegmentQueryData,
  SegmentQueryResult,
  PaginationParams,
} from "../types/crm";

// ─── Contacts ────────────────────────────────────────────────────────────────

export async function getContacts(
  params?: ContactListParams,
): Promise<ContactListResponse> {
  const { data } = await api.get("/customers", { params });
  return data;
}

export async function getContact(id: string): Promise<Contact> {
  const { data } = await api.get(`/customers/${id}`);
  return data;
}

export async function createContact(
  contactData: ContactCreateData,
): Promise<Contact> {
  const { data } = await api.post("/customers", contactData);
  return data;
}

export async function updateContact(
  id: string,
  contactData: ContactUpdateData,
): Promise<Contact> {
  const { data } = await api.put(`/customers/${id}`, contactData);
  return data;
}

export async function deleteContact(id: string): Promise<void> {
  await api.delete(`/customers/${id}`);
}

export async function getContactActivities(
  id: string,
  params?: PaginationParams,
): Promise<ActivityListResponse> {
  const { data } = await api.get(`/customers/${id}/activities`, { params });
  return data;
}

export async function getContactTasks(id: string): Promise<unknown[]> {
  const { data } = await api.get(`/customers/${id}/tasks`);
  return data;
}

export async function getContactDeals(id: string): Promise<Deal[]> {
  const { data } = await api.get(`/customers/${id}/deals`);
  return data;
}

export async function addTagToContact(
  contactId: string,
  tagData: { name: string; color?: string },
): Promise<Tag> {
  const { data } = await api.post(`/customers/${contactId}/tags`, tagData);
  return data;
}

export async function removeTagFromContact(
  contactId: string,
  tagId: string,
): Promise<void> {
  await api.delete(`/customers/${contactId}/tags/${tagId}`);
}

export async function getContactCampaigns(id: string): Promise<
  {
    id: string;
    name: string;
    status: string;
    scheduledAt: string | null;
  }[]
> {
  const { data } = await api.get(`/customers/${id}/campaigns`);
  return data;
}

// ─── Pipelines ───────────────────────────────────────────────────────────────

export async function getPipelines(): Promise<Pipeline[]> {
  const { data } = await api.get("/pipelines");
  return data;
}

export async function createPipeline(
  pipelineData: PipelineCreateData,
): Promise<Pipeline> {
  const { data } = await api.post("/pipelines", pipelineData);
  return data;
}

export async function updatePipeline(
  id: string,
  pipelineData: PipelineUpdateData,
): Promise<Pipeline> {
  const { data } = await api.put(`/pipelines/${id}`, pipelineData);
  return data;
}

export async function deletePipeline(id: string): Promise<void> {
  await api.delete(`/pipelines/${id}`);
}

export async function addStage(
  pipelineId: string,
  stageData: StageCreateData,
): Promise<Stage> {
  const { data } = await api.post(`/pipelines/${pipelineId}/stages`, stageData);
  return data;
}

export async function updateStage(
  pipelineId: string,
  stageId: string,
  stageData: StageUpdateData,
): Promise<Stage> {
  const { data } = await api.put(
    `/pipelines/${pipelineId}/stages/${stageId}`,
    stageData,
  );
  return data;
}

export async function deleteStage(
  pipelineId: string,
  stageId: string,
): Promise<void> {
  await api.delete(`/pipelines/${pipelineId}/stages/${stageId}`);
}

// ─── Deals ───────────────────────────────────────────────────────────────────

export async function getDeals(
  params?: DealListParams,
): Promise<DealListResponse> {
  const { data } = await api.get("/deals", { params });
  return data;
}

export async function getDeal(id: string): Promise<Deal> {
  const { data } = await api.get(`/deals/${id}`);
  return data;
}

export async function createDeal(dealData: DealCreateData): Promise<Deal> {
  const { data } = await api.post("/deals", dealData);
  return data;
}

export async function updateDeal(
  id: string,
  dealData: DealUpdateData,
): Promise<Deal> {
  const { data } = await api.put(`/deals/${id}`, dealData);
  return data;
}

export async function moveDealToStage(
  id: string,
  stageId: string,
): Promise<Deal> {
  const { data } = await api.patch(`/deals/${id}/stage`, { stageId });
  return data;
}

export async function deleteDeal(id: string): Promise<void> {
  await api.delete(`/deals/${id}`);
}

export async function addDealItem(
  dealId: string,
  itemData: DealItemCreateData,
): Promise<DealItem> {
  const { data } = await api.post(`/deals/${dealId}/items`, itemData);
  return data;
}

export async function updateDealItem(
  dealId: string,
  itemId: string,
  itemData: DealItemUpdateData,
): Promise<DealItem> {
  const { data } = await api.put(`/deals/${dealId}/items/${itemId}`, itemData);
  return data;
}

export async function removeDealItem(
  dealId: string,
  itemId: string,
): Promise<void> {
  await api.delete(`/deals/${dealId}/items/${itemId}`);
}

// ─── Activities ──────────────────────────────────────────────────────────────

export async function getActivities(
  params?: ActivityListParams,
): Promise<ActivityListResponse> {
  const { data } = await api.get("/activities", { params });
  return data;
}

export async function createActivity(
  activityData: ActivityCreateData,
): Promise<Activity> {
  const { data } = await api.post("/activities", activityData);
  return data;
}

export async function updateActivity(
  id: string,
  activityData: ActivityUpdateData,
): Promise<Activity> {
  const { data } = await api.put(`/activities/${id}`, activityData);
  return data;
}

export async function deleteActivity(id: string): Promise<void> {
  await api.delete(`/activities/${id}`);
}

// ─── Automation Rules ────────────────────────────────────────────────────────

export async function getAutomationRules(
  params?: AutomationRuleListParams,
): Promise<AutomationRule[]> {
  const { data } = await api.get("/automation-rules", { params });
  return data;
}

export async function createAutomationRule(
  ruleData: AutomationRuleCreateData,
): Promise<AutomationRule> {
  const { data } = await api.post("/automation-rules", ruleData);
  return data;
}

export async function updateAutomationRule(
  id: string,
  ruleData: AutomationRuleUpdateData,
): Promise<AutomationRule> {
  const { data } = await api.put(`/automation-rules/${id}`, ruleData);
  return data;
}

export async function toggleAutomationRule(
  id: string,
  enabled: boolean,
): Promise<AutomationRule> {
  const { data } = await api.patch(`/automation-rules/${id}/toggle`, {
    enabled,
  });
  return data;
}

export async function deleteAutomationRule(id: string): Promise<void> {
  await api.delete(`/automation-rules/${id}`);
}

export async function getAutomationRuleLogs(
  id: string,
  params?: PaginationParams,
): Promise<{ logs: AutomationRuleLog[]; total: number }> {
  const { data } = await api.get(`/automation-rules/${id}/logs`, { params });
  return data;
}

export async function checkStaleDeals(
  thresholdDays?: number,
): Promise<{ processed: number; staleDeals: string[] }> {
  const { data } = await api.post("/automation-rules/check-stale-deals", {
    thresholdDays,
  });
  return data;
}

// ─── Custom Fields ───────────────────────────────────────────────────────────

export async function getCustomFields(): Promise<CustomField[]> {
  const { data } = await api.get("/custom-fields");
  return data;
}

export async function createCustomField(
  fieldData: CustomFieldCreateData,
): Promise<CustomField> {
  const { data } = await api.post("/custom-fields", fieldData);
  return data;
}

export async function updateCustomField(
  id: string,
  fieldData: CustomFieldUpdateData,
): Promise<CustomField> {
  const { data } = await api.put(`/custom-fields/${id}`, fieldData);
  return data;
}

export async function deleteCustomField(id: string): Promise<void> {
  await api.delete(`/custom-fields/${id}`);
}

export async function getContactFieldValues(
  contactId: string,
): Promise<CustomFieldValue[]> {
  const { data } = await api.get(`/custom-fields/contacts/${contactId}/values`);
  return data;
}

export async function setContactFieldValues(
  contactId: string,
  values: { customFieldId: string; value: string }[],
): Promise<CustomFieldValue[]> {
  const { data } = await api.put(
    `/custom-fields/contacts/${contactId}/values`,
    { values },
  );
  return data;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getCRMDashboard(
  params?: CRMDashboardParams,
): Promise<CRMDashboardData> {
  const { data } = await api.get("/crm/dashboard", { params });
  return data;
}

// ─── AI Suggestions ──────────────────────────────────────────────────────────

export async function getContactSuggestion(
  contactId: string,
): Promise<AISuggestion> {
  const { data } = await api.get(`/crm/suggestions/contact/${contactId}`);
  return data;
}

export async function getDealSuggestion(dealId: string): Promise<AISuggestion> {
  const { data } = await api.get(`/crm/suggestions/deal/${dealId}`);
  return data;
}

export async function getConversationSummary(
  contactId: string,
): Promise<ConversationSummary> {
  const { data } = await api.get(`/crm/summaries/contact/${contactId}`);
  return data;
}

// ─── Marketing Segments ──────────────────────────────────────────────────────

export async function querySegment(
  segmentData: SegmentQueryData,
): Promise<SegmentQueryResult> {
  const { data } = await api.post("/marketing/segments/query", segmentData);
  return data;
}

export async function getSegmentCount(params: {
  tags?: string[];
  lifecycleStages?: string[];
}): Promise<{ count: number }> {
  const { data } = await api.get("/marketing/segments/count", { params });
  return data;
}
