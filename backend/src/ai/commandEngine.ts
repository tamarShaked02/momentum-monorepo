import { functionRegistry } from "./functionRegistry.js";
import { createConfirmationToken, validateConfirmationToken } from "./confirmationManager.js";
import { withAutoProvisioning } from "./autoProvisioner.js";
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

    // Execute handler with auto-provisioning
    try {
      const moduleName = definition.module || "general";
      const { result: resultData, systemNote } = await withAutoProvisioning(
        moduleName,
        userId,
        () => definition.handler(parameters, userId)
      );

      let message = `Successfully executed ${action}.`;
      if (action === "update_inventory_quantity" || action === "update_inventory") {
        const qty = resultData?.quantity ?? parameters.quantity;
        const name = resultData?.name ?? parameters.itemName ?? "item";
        message = `Successfully updated stock for ${name} (Quantity: ${qty}).`;
      } else if (action === "create_inventory_item" || action === "add_inventory_item") {
        const name = resultData?.name ?? parameters.name;
        const qty = resultData?.quantity ?? parameters.quantity ?? 0;
        message = `Successfully added ${qty > 0 ? qty + " " : ""}${name} to inventory.`;
      } else if (action === "create_task") {
        const title = resultData?.title ?? parameters.title;
        message = `Successfully created task: "${title}".`;
      } else if (action === "update_task_status" || action === "complete_task") {
        const title = resultData?.title ?? parameters.taskTitle ?? "Task";
        const status = resultData?.status ?? parameters.status ?? "done";
        message = `Successfully updated task "${title}" status to ${status}.`;
      } else if (action === "create_appointment" || action === "book_appointment" || action === "book_slot") {
        const title = resultData?.title ?? parameters.title;
        const date = parameters.date || "scheduled date";
        message = `Successfully booked appointment "${title}" for ${date}.`;
      } else if (action === "create_contact" || action === "add_customer") {
        const name = resultData?.name ?? parameters.name;
        message = `Successfully created contact: ${name}.`;
      } else if (action === "update_deal_stage" || action === "move_deal") {
        const title = resultData?.title ?? parameters.dealTitle ?? "Deal";
        const stage = resultData?.stage?.name ?? parameters.targetStage;
        message = `Successfully moved deal "${title}" to stage "${stage}".`;
      } else if (action === "create_marketing_campaign" || action === "create_campaign") {
        const name = resultData?.name ?? parameters.name;
        message = `Successfully created marketing campaign: "${name}".`;
      } else if (action === "update_campaign_status") {
        const name = resultData?.name ?? parameters.campaignName ?? "Campaign";
        const status = resultData?.status ?? parameters.status;
        message = `Successfully updated campaign "${name}" status to ${status}.`;
      } else if (action === "get_inventory_status") {
        if (!Array.isArray(resultData) || resultData.length === 0) {
          message = "No matching inventory items found.";
        } else {
          const itemSummary = resultData.map((i: any) => `${i.name}: ${i.quantity} in stock`).join(", ");
          message = `Inventory Status: ${itemSummary}.`;
        }
      } else if (action === "get_pending_tasks") {
        if (!Array.isArray(resultData) || resultData.length === 0) {
          message = "No pending tasks found.";
        } else {
          const taskSummary = resultData.map((t: any) => `"${t.title}" (${t.priority || "medium"} priority)`).join(", ");
          message = `Pending Tasks (${resultData.length}): ${taskSummary}.`;
        }
      } else if (action === "get_crm_summary") {
        const contactCount = resultData?.totalContacts ?? 0;
        const dealCount = resultData?.totalDeals ?? 0;
        message = `CRM Summary: ${contactCount} contact(s) and ${dealCount} deal(s) found.`;
      } else if (action === "get_marketing_campaigns") {
        if (!Array.isArray(resultData) || resultData.length === 0) {
          message = "No marketing campaigns found.";
        } else {
          const campaignSummary = resultData.map((c: any) => `"${c.name}" (${c.status})`).join(", ");
          message = `Marketing Campaigns (${resultData.length}): ${campaignSummary}.`;
        }
      }

      if (systemNote) {
        message += ` ${systemNote}`;
      }

      return {
        success: true,
        type: "result",
        data: resultData,
        message,
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
