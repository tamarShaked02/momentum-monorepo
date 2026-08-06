import { functionRegistry } from "./functionRegistry.js";
import { createConfirmationToken, validateConfirmationToken } from "./confirmationManager.js";
import { ZodError } from "zod";

export interface CommandResult {
  success: boolean;
  type: "result" | "confirmation_required" | "error" | "clarification";
  data?: any;
  message: string;
  confirmationToken?: string;
  confirmationDescription?: string;
  error?: {
    code: string;
    details?: any;
  };
}

export interface ExecuteOptions {
  skipConfirmation?: boolean;
}

export const commandEngine = {
  async execute(
    functionCall: { action: string; parameters: Record<string, any> },
    userId: string,
    options?: ExecuteOptions,
  ): Promise<CommandResult> {
    const { action, parameters } = functionCall;
    const definition = functionRegistry.getByAction(action);

    if (!definition) {
      const similar = functionRegistry.findSimilar(action);
      return {
        success: false,
        type: "error",
        message: `Unknown function: ${action}`,
        error: {
          code: "unknown_function",
          details: similar,
        },
      };
    }

    // Parameter validation using Zod
    try {
      definition.parameters.parse(parameters);
    } catch (err: any) {
      if (err instanceof ZodError) {
        const missing = err.errors
          .filter((e) => e.code === "invalid_type" && e.received === "undefined")
          .map((e) => e.path.join("."));
        const invalid = err.errors
          .filter((e) => !(e.code === "invalid_type" && e.received === "undefined"))
          .map((e) => e.path.join("."));

        return {
          success: false,
          type: "error",
          message: "Parameter validation failed.",
          error: {
            code: "validation_error",
            details: { missing, invalid },
          },
        };
      }
      return {
        success: false,
        type: "error",
        message: "Invalid parameters.",
        error: { code: "validation_error", details: err.message },
      };
    }

    // Destructive confirmation gating
    if (definition.classification === "destructive" && !options?.skipConfirmation) {
      const token = createConfirmationToken(action, parameters, userId);
      return {
        success: true,
        type: "confirmation_required",
        message: `Confirmation required for destructive action: ${action}`,
        confirmationToken: token,
        confirmationDescription: `Are you sure you want to perform: ${action}?`,
      };
    }

    // Execute handler
    try {
      const resultData = await definition.handler(parameters, userId);
      return {
        success: true,
        type: "result",
        data: resultData,
        message: `Successfully executed ${action}.`,
      };
    } catch (handlerErr: any) {
      console.error(`Handler execution error for ${action}:`, handlerErr);
      return {
        success: false,
        type: "error",
        message: handlerErr.message || "Execution error occurred in handler.",
        error: {
          code: "execution_error",
          details: handlerErr.message,
        },
      };
    }
  },

  async confirm(
    token: string,
    confirmed: boolean,
    userId: string,
  ): Promise<CommandResult> {
    const payload = validateConfirmationToken(token, userId);
    if (!payload) {
      return {
        success: false,
        type: "error",
        message: "Invalid or expired confirmation token.",
        error: {
          code: "invalid_token",
        },
      };
    }

    if (!confirmed) {
      return {
        success: true,
        type: "result",
        message: `Action '${payload.action}' cancelled by user.`,
      };
    }

    // Execute original action skipping confirmation
    return await this.execute(
      { action: payload.action, parameters: payload.parameters },
      userId,
      { skipConfirmation: true },
    );
  },
};
export type CommandEngine = typeof commandEngine;
