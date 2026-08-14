import { GoogleGenerativeAI, FunctionCallingMode } from "@google/generative-ai";
import { env } from "../config/env.js";
import { functionRegistry } from "./functionRegistry.js";

export interface InterpretResult {
  type: "function_call" | "clarification" | "unknown";
  functionCall?: {
    action: string;
    parameters: Record<string, any>;
  };
  clarification?: {
    message: string;
    missingParams?: string[];
  };
  unknownMessage?: string;
}

const getClient = () => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey && !env.USE_MOCK_AI) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
};

// Comprehensive regex fallback for mock mode / failures
function regexFallback(command: string): InterpretResult {
  const lower = command.toLowerCase().trim();

  // Create marketing campaign: create campaign Summer Sale
  const campaignMatch = lower.match(/(?:create|new|start)\s+(?:marketing\s+)?campaign\s+(.+)/i);
  if (campaignMatch) {
    return {
      type: "function_call",
      functionCall: {
        action: "create_marketing_campaign",
        parameters: { name: campaignMatch[1].trim() },
      },
    };
  }

  // Update campaign status
  const campaignStatusMatch = lower.match(/(?:set|update)\s+campaign\s+(.+?)\s+status\s+to\s+(\w+)/i);
  if (campaignStatusMatch) {
    return {
      type: "function_call",
      functionCall: {
        action: "update_campaign_status",
        parameters: {
          campaignName: campaignStatusMatch[1].trim(),
          status: campaignStatusMatch[2].trim().toLowerCase(),
        },
      },
    };
  }

  // Create inventory item: add inventory item Shampoo
  const itemMatch = lower.match(/(?:create|add)\s+inventory\s+item\s+(.+)/i);
  if (itemMatch) {
    return {
      type: "function_call",
      functionCall: {
        action: "create_inventory_item",
        parameters: { name: itemMatch[1].trim() },
      },
    };
  }

  // Bought or added items: "bought 3 Fabric items", "i bought 5 shampoos", "add 3 Fabric"
  const buyMatch = lower.match(/(?:i\s+)?(?:bought|purchased|added|got)\s+(\d+)\s+(.+)/i);
  if (buyMatch) {
    const qty = parseInt(buyMatch[1], 10);
    const itemName = buyMatch[2].replace(/items?/gi, "").replace(/units?\s+of/gi, "").trim();
    return {
      type: "function_call",
      functionCall: {
        action: "update_inventory_quantity",
        parameters: {
          itemName,
          quantity: qty,
          changeType: "add",
        },
      },
    };
  }

  // Update inventory quantity: update stock for Shampoo to 20 / add 10 stock for Shampoo
  const stockMatch = lower.match(/(?:update|set|add|increase|decrease)\s+(?:stock|inventory)\s+(?:for\s+)?(.+?)\s+(?:to|by)\s+(\d+)/i);
  if (stockMatch) {
    return {
      type: "function_call",
      functionCall: {
        action: "update_inventory_quantity",
        parameters: {
          itemName: stockMatch[1].trim(),
          quantity: parseInt(stockMatch[2], 10),
        },
      },
    };
  }

  // Create task: create task Buy supplies
  const taskMatch = lower.match(/(?:create|add)\s+task\s+(.+)/i);
  if (taskMatch) {
    return {
      type: "function_call",
      functionCall: {
        action: "create_task",
        parameters: { title: taskMatch[1].trim() },
      },
    };
  }

  // Update task status: mark task Buy supplies as done
  const taskStatusMatch = lower.match(/(?:mark|set|update)\s+task\s+(.+?)\s+(?:as|status|to)\s+(\w+)/i);
  if (taskStatusMatch) {
    return {
      type: "function_call",
      functionCall: {
        action: "update_task_status",
        parameters: {
          taskTitle: taskStatusMatch[1].trim(),
          status: taskStatusMatch[2].trim().toLowerCase() === "completed" ? "done" : taskStatusMatch[2].trim().toLowerCase(),
        },
      },
    };
  }

  // Create contact: create contact John Doe
  const contactMatch = lower.match(/(?:create|add)\s+(?:contact|customer)\s+(.+)/i);
  if (contactMatch) {
    return {
      type: "function_call",
      functionCall: {
        action: "create_contact",
        parameters: { name: contactMatch[1].trim() },
      },
    };
  }

  // Update deal stage: move deal Website Project to Closed Won
  const dealStageMatch = lower.match(/(?:move|update)\s+deal\s+(.+?)\s+to\s+(?:stage\s+)?(.+)/i);
  if (dealStageMatch) {
    return {
      type: "function_call",
      functionCall: {
        action: "update_deal_stage",
        parameters: {
          dealTitle: dealStageMatch[1].trim(),
          targetStage: dealStageMatch[2].trim(),
        },
      },
    };
  }

  // Book appointment: book manicure on Friday at 2pm
  const bookRegex = /book\s+(.+?)\s+(?:on\s+)?(.+?)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  const bookMatch = lower.match(bookRegex);
  if (bookMatch) {
    return {
      type: "function_call",
      functionCall: {
        action: "create_appointment",
        parameters: {
          title: bookMatch[1].trim(),
          date: bookMatch[2].trim(),
          time: bookMatch[3].trim(),
        },
      },
    };
  }

  // Cancel appointment: cancel haircut tomorrow
  const cancelRegex = /cancel\s+(.+?)(?:\s+(?:on|tomorrow|today|yesterday|\w+day))?$/i;
  const cancelMatch = lower.match(cancelRegex);
  if (cancelMatch && lower.includes("cancel")) {
    const title = cancelMatch[1].replace(/appointment/gi, "").trim();
    let date = "today";
    if (lower.includes("tomorrow")) date = "tomorrow";
    return {
      type: "function_call",
      functionCall: {
        action: "cancel_appointment",
        parameters: { title, date },
      },
    };
  }

  // Read Q&A: how many ... in stock / check stock / inventory status
  if (lower.includes("in stock") || lower.includes("stock status") || lower.includes("how many") || lower.includes("inventory status")) {
    const itemMatch = lower.match(/(?:how\s+many|check|stock\s+for|what\s+is\s+the\s+stock\s+of)\s+(.+?)(?:\s+(?:are\s+)?in\s+stock|\?|$)/i);
    const itemName = itemMatch ? itemMatch[1].replace(/items?/gi, "").replace(/fabrics?/gi, "Fabric").trim() : undefined;
    return {
      type: "function_call",
      functionCall: {
        action: "get_inventory_status",
        parameters: itemName && !itemName.includes("inventory") ? { itemName } : {},
      },
    };
  }

  // Read Q&A: what are my pending tasks / show tasks
  if (lower.includes("pending tasks") || lower.includes("my tasks") || lower.includes("what do i need to do")) {
    return {
      type: "function_call",
      functionCall: {
        action: "get_pending_tasks",
        parameters: { status: "pending" },
      },
    };
  }

  // Read Q&A: show campaigns / active campaigns / my campaigns
  if (lower.includes("campaigns") || lower.includes("marketing campaign")) {
    return {
      type: "function_call",
      functionCall: {
        action: "get_marketing_campaigns",
        parameters: lower.includes("active") ? { status: "active" } : {},
      },
    };
  }

  // Read Q&A: CRM summary / show deals / show customers
  if (lower.includes("crm") || lower.includes("customers") || lower.includes("deals")) {
    return {
      type: "function_call",
      functionCall: {
        action: "get_crm_summary",
        parameters: {},
      },
    };
  }

  // List tasks: list tasks, show tasks
  if (lower.includes("tasks") || lower.includes("task")) {
    return {
      type: "function_call",
      functionCall: {
        action: "get_pending_tasks",
        parameters: {},
      },
    };
  }

  return {
    type: "unknown",
    unknownMessage: "I'm not sure how to help with that. Try asking 'How many fabrics are in stock?' or 'What are my pending tasks?'.",
  };
}

// Helper function for exponential backoff retries on transient 503 / 429 API errors
async function sendMessageWithRetry(session: any, command: string): Promise<any> {
  const maxRetries = 3;
  const delays = [1000, 2000, 4000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const responsePromise = session.sendMessage(command);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 30000)
      );
      return await Promise.race([responsePromise, timeoutPromise]);
    } catch (error: any) {
      const status = error?.status || error?.statusCode;
      const msg = error?.message || "";
      const isTransientError =
        status === 503 ||
        status === 429 ||
        msg.includes("503") ||
        msg.includes("429") ||
        msg.includes("Timeout") ||
        msg.includes("high demand") ||
        msg.includes("overloaded") ||
        msg.includes("Service Unavailable") ||
        msg.includes("UNAVAILABLE");

      if (isTransientError && attempt < maxRetries) {
        const delay = delays[attempt] || 4000;
        console.warn(`API Timeout/503/429 transient error (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }
}

export async function interpretCommand(command: string, userId: string): Promise<InterpretResult> {
  if (env.USE_MOCK_AI) {
    return regexFallback(command);
  }

  const genAI = getClient();
  if (!genAI) {
    return regexFallback(command);
  }

  try {
    const declarations = functionRegistry.getAllDeclarations();
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      tools: [{ functionDeclarations: declarations }],
      systemInstruction:
        "You are an active operational growth AI assistant for a business management platform. System modules (such as Marketing, CRM, Inventory, Tasks, Scheduling, and Analytics) are automatically unlocked and provisioned for the user whenever they request an action. You MUST use function tools for BOTH active mutations and data queries. For questions like 'How many fabrics are in stock?', 'What are my pending tasks?', 'Show my active campaigns', or 'CRM summary', call the read-only retrieval tools (`get_inventory_status`, `get_pending_tasks`, `get_crm_summary`, `get_marketing_campaigns`). Return clear, helpful, conversational answers based directly on the raw database results.",
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingMode.AUTO,
        },
      },
    });

    const session = model.startChat({
      history: [],
      generationConfig: {
        temperature: 0.1,
      },
    });

    const result = await sendMessageWithRetry(session, command);
    const functionCalls = result.response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      // Check if action exists in registry
      const definition = functionRegistry.getByAction(call.name);
      if (!definition) {
        return {
          type: "unknown",
          unknownMessage: `The AI tried to call an unknown action: ${call.name}`,
        };
      }
      return {
        type: "function_call",
        functionCall: {
          action: call.name,
          parameters: call.args as Record<string, any>,
        },
      };
    } else {
      // Normal chat response, check if it's asking for clarification
      const text = result.response.text();
      return {
        type: "clarification",
        clarification: {
          message: text,
        },
      };
    }
  } catch (error: any) {
    const status = error?.status || error?.statusCode;
    const msg = error?.message || "";
    const isTransientError =
      status === 503 ||
      status === 429 ||
      msg.includes("503") ||
      msg.includes("429") ||
      msg.includes("Timeout") ||
      msg.includes("high demand") ||
      msg.includes("overloaded") ||
      msg.includes("Service Unavailable") ||
      msg.includes("UNAVAILABLE");

    if (isTransientError) {
      console.warn(`Gemini API service transient limit reached: ${msg || status || "Timeout"}`);
    } else {
      console.error("Gemini interpretation error:", error);
    }

    // Attempt regex fallback if it matches a tool pattern
    const fallbackResult = regexFallback(command);
    if (fallbackResult.type === "function_call") {
      return fallbackResult;
    }

    return {
      type: "clarification",
      clarification: {
        message: "The AI service is currently experiencing exceptionally high demand. Please try your request again in a minute.",
      },
    };
  }
}
