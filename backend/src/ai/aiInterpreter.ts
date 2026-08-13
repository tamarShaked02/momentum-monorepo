import { GoogleGenerativeAI } from "@google/generative-ai";
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

// Simple regex fallback for mock mode / failures
function regexFallback(command: string): InterpretResult {
  const lower = command.toLowerCase().trim();

  // Book appointment: book manicure on Friday at 2pm
  const bookRegex = /book\s+(.+?)\s+(?:on\s+)?(.+?)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  const bookMatch = lower.match(bookRegex);
  if (bookMatch) {
    return {
      type: "function_call",
      functionCall: {
        action: "book_appointment",
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
    unknownMessage: "I'm not sure how to help with that. Try 'Book an appointment for tomorrow at 3pm'.",
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
