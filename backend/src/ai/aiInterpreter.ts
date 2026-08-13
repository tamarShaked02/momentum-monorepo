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

  // List tasks: list tasks, show tasks
  if (lower.includes("tasks") || lower.includes("task")) {
    return {
      type: "function_call",
      functionCall: {
        action: "list_tasks",
        parameters: {},
      },
    };
  }

  return {
    type: "unknown",
    unknownMessage: "I'm not sure how to help with that. Try 'Create a marketing campaign Summer Sale' or 'Create a task Buy supplies'.",
  };
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
        "You are an active operational AI assistant for a business management platform. You MUST use function tools whenever a user requests an action (buying, adding, creating, updating, or deleting inventory, tasks, appointments, contacts, deals, or marketing campaigns). For example, if a user says they bought or added items (e.g. 'I bought 5 Shampoos' or 'Add 3 Fabric items'), you MUST call `update_inventory_quantity` or `create_inventory_item`. Do not reply with plain text alone when an active operation tool is available.",
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

    // We can run the command with a 15 second timeout limit
    const responsePromise = session.sendMessage(command);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 15000)
    );

    const result = await Promise.race([responsePromise, timeoutPromise]);
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
    console.error("Gemini interpretation error:", error);
    // If rate limit (429), retry once after 1s
    if (error.status === 429 || error.message?.includes("429")) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return await interpretCommand(command, userId);
      } catch (retryError) {
        console.error("Retry failed:", retryError);
      }
    }
    // Fallback to regex on any error
    return regexFallback(command);
  }
}
