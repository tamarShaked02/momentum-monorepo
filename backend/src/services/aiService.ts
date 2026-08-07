import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";
import {
  getOnboardingPrompt,
  getCommandBarPrompt,
  getMarketingPrompt,
} from "../prompts/systemPrompt.js";
import prisma from "../config/db.js";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// CRM AI suggestion types
export type SuggestionType =
  | "follow_up_call"
  | "send_proposal"
  | "schedule_meeting"
  | "re_engage_stale"
  | "close_deal";

export interface CRMSuggestionResult {
  suggestion: SuggestionType | null;
  reasoning: string | null;
  reason?: "insufficient_activities" | "service_unavailable";
}

export interface ConversationSummaryResult {
  summary: string | null;
  reason?: "insufficient_messages" | "service_unavailable";
}

interface OnboardingQuestionResponse {
  type: "question";
  message: string;
}

interface OnboardingRecommendationResponse {
  type: "recommendation";
  recommended_modules: Array<{ id: string; reason: string }>;
  summary: string;
  businessType: string;
  mode?: string;
}

type OnboardingResponse =
  | OnboardingQuestionResponse
  | OnboardingRecommendationResponse;

const getClient = () => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey && !env.USE_MOCK_AI) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
};

// ---------- Mock Responses ----------

const getMockOnboardingResponse = (
  userMessage: string,
  messageCount: number,
): OnboardingResponse => {
  const lower = userMessage.toLowerCase();

  // For returning users requesting specific module additions/removals
  const addKeywords = ["add", "enable", "want", "need", "activate"];
  const removeKeywords = [
    "remove",
    "disable",
    "deactivate",
    "turn off",
    "don't need",
    "dont need",
    "don't want",
    "dont want",
    "no longer",
    "not want",
  ];
  const isAddRequest = addKeywords.some((k) => lower.includes(k));
  const isRemoveRequest = removeKeywords.some((k) => lower.includes(k));

  if (isAddRequest || isRemoveRequest) {
    const modules: Array<{ id: string; reason: string }> = [];
    if (
      lower.includes("schedul") ||
      lower.includes("appointment") ||
      lower.includes("book") ||
      lower.includes("calendar")
    ) {
      modules.push({
        id: "scheduling",
        reason: "Appointment scheduling and calendar management.",
      });
    }
    if (
      lower.includes("crm") ||
      lower.includes("customer") ||
      lower.includes("contact")
    ) {
      modules.push({ id: "crm", reason: "Customer relationship management." });
    }
    if (
      lower.includes("inventor") ||
      lower.includes("product") ||
      lower.includes("stock")
    ) {
      modules.push({
        id: "inventory",
        reason: "Track products and stock levels.",
      });
    }
    if (lower.includes("task")) {
      modules.push({
        id: "tasks",
        reason: "Task management and organization.",
      });
    }
    if (
      lower.includes("market") ||
      lower.includes("campaign") ||
      lower.includes("promot")
    ) {
      modules.push({
        id: "marketing",
        reason: "Marketing campaigns and promotions.",
      });
    }
    if (
      lower.includes("analytic") ||
      lower.includes("report") ||
      lower.includes("insight")
    ) {
      modules.push({
        id: "analytics",
        reason: "Business analytics and reporting.",
      });
    }

    if (modules.length > 0) {
      const mode = isRemoveRequest ? "remove" : "add";
      return {
        type: "recommendation",
        recommended_modules: modules,
        summary: isRemoveRequest
          ? `Got it! I'll remove ${modules.map((m) => m.id).join(", ")} from your setup.`
          : `Got it! I'll add ${modules.map((m) => m.id).join(", ")} to your setup.`,
        businessType: "general",
        mode,
      };
    }
  }

  if (messageCount <= 1) {
    return {
      type: "question",
      message:
        "That sounds like a great business! Do you take appointments from customers, or is it mostly walk-ins?",
    };
  }

  const modules: Array<{ id: string; reason: string }> = [
    {
      id: "crm",
      reason: "Essential for managing your client relationships and history.",
    },
    { id: "tasks", reason: "Helps you organize daily operational tasks." },
  ];

  if (
    lower.includes("appointment") ||
    lower.includes("book") ||
    lower.includes("schedule") ||
    lower.includes("yes")
  ) {
    modules.push({
      id: "scheduling",
      reason:
        "You mentioned taking appointments - this will manage your calendar.",
    });
  }
  if (
    lower.includes("product") ||
    lower.includes("sell") ||
    lower.includes("inventory") ||
    lower.includes("stock")
  ) {
    modules.push({
      id: "inventory",
      reason: "To track your products and stock levels.",
    });
  }
  if (
    lower.includes("promot") ||
    lower.includes("market") ||
    lower.includes("grow") ||
    lower.includes("social")
  ) {
    modules.push({
      id: "marketing",
      reason: "To help you promote your business and reach more customers.",
    });
  }
  modules.push({
    id: "analytics",
    reason: "To track your business performance over time.",
  });

  return {
    type: "recommendation",
    recommended_modules: modules,
    summary:
      "Great! I've analyzed your needs and set up the perfect toolkit for your business.",
    businessType: "general",
  };
};

const getMockCommandResponse = (command: string) => {
  const lower = command.toLowerCase();
  if (lower.includes("book") || lower.includes("appointment")) {
    return {
      action: "book_appointment",
      data: { title: "Appointment", date: "tomorrow", time: "14:00" },
    };
  }
  if (lower.includes("task")) {
    return {
      action: "create_task",
      data: { title: "New task from command", priority: "medium" },
    };
  }
  return {
    action: "unknown",
    message:
      "I'm not sure how to help with that. Try 'Book an appointment for tomorrow at 3pm'.",
  };
};

const getMockMarketingResponse = () => ({
  sms: "🔥 Flash Sale! 20% off all services this week only. Book now before slots fill up! Reply BOOK to reserve.",
  email: {
    subject: "✨ Exclusive Offer Just For You!",
    body: "Hi there!\n\nWe're running a special promotion this week - 20% off all our services!\n\nDon't miss out on this limited-time offer. Book your appointment today.\n\nSee you soon!",
  },
  social:
    "✨ FLASH SALE ALERT ✨\n\n20% OFF all services this week! 🎉\n\nLimited slots available - book now! Link in bio 👆\n\n#SmallBusiness #FlashSale #BookNow #SpecialOffer",
});

// ---------- Real AI Calls ----------

const callGemini = async (
  systemPrompt: string,
  userPrompt: string,
): Promise<string> => {
  const genAI = getClient();
  if (!genAI) throw new Error("AI client not available");

  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
  const fullPrompt = `${systemPrompt}\n\nUSER INPUT: "${userPrompt}"`;
  const result = await model.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
};

const callGeminiWithHistory = async (
  systemPrompt: string,
  history: ConversationMessage[],
): Promise<string> => {
  const genAI = getClient();
  if (!genAI) throw new Error("AI client not available");

  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const conversationText = history
    .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n");

  const fullPrompt = `${systemPrompt}\n\nCONVERSATION SO FAR:\n${conversationText}\n\nRespond to the latest user message. Remember to respond with valid JSON only.`;

  const result = await model.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
};

// ---------- Exported Service Functions ----------

export const processOnboardingMessage = async (
  conversationHistory: ConversationMessage[],
): Promise<OnboardingResponse> => {
  if (env.USE_MOCK_AI) {
    console.log("Using Mock AI for onboarding");
    const userMessages = conversationHistory.filter((m) => m.role === "user");
    const lastMessage = userMessages[userMessages.length - 1]?.content || "";
    return getMockOnboardingResponse(lastMessage, userMessages.length);
  }

  try {
    const systemPrompt = getOnboardingPrompt();
    const text = await callGeminiWithHistory(systemPrompt, conversationHistory);
    return JSON.parse(text) as OnboardingResponse;
  } catch (error) {
    console.error("AI onboarding error:", error);
    const userMessages = conversationHistory.filter((m) => m.role === "user");
    return getMockOnboardingResponse(
      userMessages[userMessages.length - 1]?.content || "",
      userMessages.length,
    );
  }
};

export const processCommand = async (command: string): Promise<any> => {
  if (env.USE_MOCK_AI) {
    console.log("Using Mock AI for command");
    return getMockCommandResponse(command);
  }

  try {
    const systemPrompt = getCommandBarPrompt();
    const text = await callGemini(systemPrompt, command);
    return JSON.parse(text);
  } catch (error) {
    console.error("AI command error:", error);
    return getMockCommandResponse(command);
  }
};

export const generateMarketingContent = async (brief: string): Promise<any> => {
  if (env.USE_MOCK_AI) {
    console.log("Using Mock AI for marketing");
    return getMockMarketingResponse();
  }

  try {
    const systemPrompt = getMarketingPrompt();
    const text = await callGemini(systemPrompt, brief);
    return JSON.parse(text);
  } catch (error) {
    console.error("AI marketing error:", error);
    return getMockMarketingResponse();
  }
};

// ---------- CRM AI Suggestions ----------

const CRM_AI_TIMEOUT = 15000; // 15 seconds

const VALID_SUGGESTION_TYPES: SuggestionType[] = [
  "follow_up_call",
  "send_proposal",
  "schedule_meeting",
  "re_engage_stale",
  "close_deal",
];

/**
 * Calls Gemini with a timeout. Returns null if the call exceeds the timeout or fails.
 */
const callGeminiWithTimeout = async (
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> => {
  const genAI = getClient();
  if (!genAI) return null;

  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("AI_TIMEOUT")), CRM_AI_TIMEOUT),
  );

  try {
    const result = await Promise.race([
      model.generateContent(fullPrompt),
      timeoutPromise,
    ]);
    const response = (result as any).response;
    const text = response.text();
    return text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
  } catch (error: any) {
    if (error?.message === "AI_TIMEOUT") {
      console.error("CRM AI suggestion timed out after 15 seconds");
    } else {
      console.error("CRM AI suggestion error:", error);
    }
    return null;
  }
};

/**
 * Calculates the average cycle time (in days) for a given stage based on closed deals.
 * Returns 14 (default) if no deals have passed through the stage.
 */
const getAverageCycleTimeForStage = async (
  userId: string,
  stageId: string,
): Promise<number> => {
  const DEFAULT_CYCLE_DAYS = 14;

  // Find deals that have stage-change activities FROM this stage (indicating they spent time there)
  const stageChangeActivities = await prisma.activity.findMany({
    where: {
      userId,
      type: "deal_stage_change",
      metadata: {
        path: ["fromStageId"],
        equals: stageId,
      },
    },
    include: {
      deal: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (stageChangeActivities.length === 0) {
    return DEFAULT_CYCLE_DAYS;
  }

  // For each deal that left this stage, calculate how long they spent in it
  const durations: number[] = [];
  const processedDeals = new Set<string>();

  for (const activity of stageChangeActivities) {
    if (!activity.dealId || processedDeals.has(activity.dealId)) continue;
    processedDeals.add(activity.dealId);

    // Find when the deal entered this stage (look for stage change TO this stage, or deal creation)
    const entryActivity = await prisma.activity.findFirst({
      where: {
        userId,
        dealId: activity.dealId,
        type: "deal_stage_change",
        metadata: {
          path: ["toStageId"],
          equals: stageId,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const entryDate = entryActivity?.createdAt ?? activity.deal?.createdAt;
    if (entryDate) {
      const daysInStage =
        (activity.createdAt.getTime() - new Date(entryDate).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysInStage > 0) {
        durations.push(daysInStage);
      }
    }
  }

  if (durations.length === 0) {
    return DEFAULT_CYCLE_DAYS;
  }

  return durations.reduce((sum, d) => sum + d, 0) / durations.length;
};

/**
 * Generates AI-powered next-step suggestion for a contact or deal.
 * Requirements: 12.1, 12.2, 12.5, 12.6, 12.7, 12.8, 12.9
 */
export const generateCRMSuggestion = async (
  userId: string,
  contactId?: string,
  dealId?: string,
): Promise<CRMSuggestionResult> => {
  // Fetch recent 20 activities for the entity
  const activityWhere: Record<string, unknown> = { userId };
  if (dealId) {
    activityWhere.dealId = dealId;
  } else if (contactId) {
    activityWhere.contactId = contactId;
  } else {
    return {
      suggestion: null,
      reasoning: null,
      reason: "insufficient_activities",
    };
  }

  const activities = await prisma.activity.findMany({
    where: activityWhere,
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Skip suggestions for entities with < 2 activities
  if (activities.length < 2) {
    return {
      suggestion: null,
      reasoning: null,
      reason: "insufficient_activities",
    };
  }

  // Calculate days since last activity
  const lastActivityDate = activities[0]?.createdAt;
  const daysSinceLastActivity = lastActivityDate
    ? Math.floor(
        (Date.now() - new Date(lastActivityDate).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  // Fetch deal details if dealing with a deal
  let dealContext = "";
  let isStale = false;

  if (dealId) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { stage: true },
    });

    if (deal) {
      const avgCycleTime = await getAverageCycleTimeForStage(
        userId,
        deal.stageId,
      );

      // Calculate days in current stage
      const stageEntryActivity = await prisma.activity.findFirst({
        where: {
          userId,
          dealId,
          type: "deal_stage_change",
          metadata: {
            path: ["toStageId"],
            equals: deal.stageId,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const stageEntryDate = stageEntryActivity?.createdAt ?? deal.createdAt;
      const daysInCurrentStage = Math.floor(
        (Date.now() - new Date(stageEntryDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      isStale = daysInCurrentStage > avgCycleTime;

      dealContext = `
Deal: "${deal.title}"
Value: ${deal.value ?? "not set"}
Stage: "${deal.stage.name}" (position ${deal.stage.position})
Days in current stage: ${daysInCurrentStage}
Average cycle time for this stage: ${avgCycleTime.toFixed(1)} days
Is stale: ${isStale ? "YES" : "NO"}
Win probability: ${deal.winProbability ?? "not set"}%
Expected close: ${deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().split("T")[0] : "not set"}
Status: ${deal.status}`;
    }
  }

  // Build activity context
  const activityContext = activities
    .map(
      (a) =>
        `- [${new Date(a.createdAt).toISOString().split("T")[0]}] ${a.type}: ${a.description ?? "(no description)"}`,
    )
    .join("\n");

  // Use mock response if configured
  if (env.USE_MOCK_AI) {
    return getMockCRMSuggestion(
      activities,
      daysSinceLastActivity,
      isStale,
      !!dealId,
    );
  }

  // Build prompt
  const systemPrompt = `You are a CRM assistant that recommends the next best action for a sales representative.
You MUST respond with valid JSON only, no other text.
The suggestion type MUST be one of: "follow_up_call", "send_proposal", "schedule_meeting", "re_engage_stale", "close_deal".

Respond in this exact JSON format:
{
  "suggestion": "<suggestion_type>",
  "reasoning": "<brief explanation of why this is the recommended next step>"
}

Guidelines:
- If the deal/contact is stale (no recent activity), suggest "re_engage_stale"
- If there's active engagement and the deal is in a late stage, suggest "close_deal"
- If there's been initial contact but no meeting, suggest "schedule_meeting"
- If there's been a meeting but no proposal, suggest "send_proposal"
- If there's been a proposal sent but no follow-up, suggest "follow_up_call"
- Consider the days since last activity and deal stage when making recommendations`;

  const userPrompt = `Based on the following context, recommend the best next action:

${dealContext ? dealContext : `Contact ID: ${contactId}`}

Days since last activity: ${daysSinceLastActivity}

Recent activities (newest first):
${activityContext}`;

  const result = await callGeminiWithTimeout(systemPrompt, userPrompt);

  if (!result) {
    return { suggestion: null, reasoning: null, reason: "service_unavailable" };
  }

  try {
    const parsed = JSON.parse(result);
    const suggestion = VALID_SUGGESTION_TYPES.includes(parsed.suggestion)
      ? parsed.suggestion
      : "follow_up_call";
    return {
      suggestion,
      reasoning: parsed.reasoning || "Based on recent activity patterns.",
    };
  } catch {
    return { suggestion: null, reasoning: null, reason: "service_unavailable" };
  }
};

/**
 * Generates an AI-powered conversation summary for a contact's telegram messages.
 * Requirements: 12.3, 12.4
 */
export const generateConversationSummary = async (
  userId: string,
  contactId: string,
): Promise<ConversationSummaryResult> => {
  // Count telegram message activities for this contact
  const telegramCount = await prisma.activity.count({
    where: {
      userId,
      contactId,
      type: "telegram_message",
    },
  });

  // If < 3 messages, don't generate summary
  if (telegramCount < 3) {
    return { summary: null, reason: "insufficient_messages" };
  }

  // Fetch up to 50 most recent telegram messages
  const telegramMessages = await prisma.activity.findMany({
    where: {
      userId,
      contactId,
      type: "telegram_message",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Build message context (reverse to chronological order for the prompt)
  const messagesContext = telegramMessages
    .reverse()
    .map((m) => {
      const direction = (m.metadata as any)?.direction ?? "unknown";
      const text = m.description ?? "(no content)";
      const date = new Date(m.createdAt).toISOString().split("T")[0];
      return `[${date}] ${direction === "inbound" ? "Customer" : "You"}: ${text}`;
    })
    .join("\n");

  // Use mock response if configured
  if (env.USE_MOCK_AI) {
    return getMockConversationSummary(telegramMessages.length);
  }

  const systemPrompt = `You are a CRM assistant that summarizes Telegram conversations between a business and their customer.
You MUST respond with valid JSON only, no other text.

Respond in this exact JSON format:
{
  "summary": "<concise summary highlighting key topics, customer requests, and action items>"
}

Guidelines:
- Keep the summary concise (2-4 sentences)
- Highlight key topics discussed
- Note any customer requests or questions
- List any action items or follow-ups needed`;

  const userPrompt = `Summarize the following Telegram conversation (${telegramMessages.length} messages):

${messagesContext}`;

  const result = await callGeminiWithTimeout(systemPrompt, userPrompt);

  if (!result) {
    return { summary: null, reason: "service_unavailable" };
  }

  try {
    const parsed = JSON.parse(result);
    return { summary: parsed.summary || null };
  } catch {
    return { summary: null, reason: "service_unavailable" };
  }
};

// ---------- Mock CRM AI Responses ----------

const getMockCRMSuggestion = (
  activities: Array<{ type: string; createdAt: Date }>,
  daysSinceLastActivity: number,
  isStale: boolean,
  isDeal: boolean,
): CRMSuggestionResult => {
  // Simple heuristic-based mock
  if (isStale || daysSinceLastActivity > 14) {
    return {
      suggestion: "re_engage_stale",
      reasoning: `No activity for ${daysSinceLastActivity} days. Consider reaching out to re-engage.`,
    };
  }

  const types = activities.map((a) => a.type);

  if (types.includes("meeting") && !types.includes("send_proposal")) {
    return {
      suggestion: "send_proposal",
      reasoning: "A meeting was held but no proposal has been sent yet.",
    };
  }

  if (isDeal && types.filter((t) => t === "meeting").length >= 2) {
    return {
      suggestion: "close_deal",
      reasoning:
        "Multiple meetings have occurred. The deal may be ready to close.",
    };
  }

  if (!types.includes("meeting") && !types.includes("call")) {
    return {
      suggestion: "schedule_meeting",
      reasoning:
        "No meetings or calls recorded. Schedule a meeting to advance the relationship.",
    };
  }

  return {
    suggestion: "follow_up_call",
    reasoning: "Follow up on recent interactions to maintain momentum.",
  };
};

const getMockConversationSummary = (
  messageCount: number,
): ConversationSummaryResult => {
  return {
    summary: `Summary of ${messageCount} Telegram messages: The customer discussed service inquiries, pricing questions, and scheduling preferences. Key action items include sending updated pricing and confirming the next appointment date.`,
  };
};
