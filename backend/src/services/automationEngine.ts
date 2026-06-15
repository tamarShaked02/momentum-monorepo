import prisma from "../config/db.js";
import { crmEventBus } from "./eventBus.js";
import bot from "../telegram/bot.js";
import { logTelegramActivity } from "./telegramActivityLogger.js";
import type {
  AutomationTriggerType,
  AutomationActionType,
} from "../types/crm.js";

// --- Interfaces ---

export interface AutomationEvent {
  type: AutomationTriggerType;
  userId: string;
  payload: Record<string, any>;
}

export interface AutomationAction {
  type: AutomationActionType;
  params: Record<string, any>;
}

// --- Constants ---

const MAX_CASCADE_DEPTH = 3;

// --- Automation Engine ---

class AutomationEngine {
  /**
   * Process an automation event by loading matching enabled rules
   * and executing their actions in position order.
   *
   * @param event - The triggering event
   * @param depth - Current cascade depth (default 0). Events beyond MAX_CASCADE_DEPTH are discarded.
   */
  async processEvent(event: AutomationEvent, depth: number = 0): Promise<void> {
    if (depth > MAX_CASCADE_DEPTH) {
      console.warn(
        `[AutomationEngine] Cascade depth ${depth} exceeds max ${MAX_CASCADE_DEPTH}. Discarding event: ${event.type}`,
      );
      return;
    }

    try {
      // Load enabled rules matching this trigger type, ordered by position ascending
      const rules = await prisma.automationRule.findMany({
        where: {
          userId: event.userId,
          enabled: true,
        },
        orderBy: { position: "asc" },
      });

      // Filter rules whose trigger type matches the event type
      const matchingRules = rules.filter((rule) => {
        const trigger = rule.trigger as {
          type: string;
          params?: Record<string, any>;
        };
        return trigger.type === event.type;
      });

      for (const rule of matchingRules) {
        const actions = rule.actions as unknown as AutomationAction[];

        for (const action of actions) {
          try {
            await this.executeAction(rule.id, action, event, depth);
            await this.logExecution(rule.id, action.type, true);
          } catch (error) {
            // Failure isolation: log the failure and continue with remaining actions
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            console.error(
              `[AutomationEngine] Action ${action.type} failed for rule ${rule.id}: ${errorMessage}`,
            );
            await this.logExecution(rule.id, action.type, false, errorMessage);
          }
        }
      }
    } catch (error) {
      console.error(
        `[AutomationEngine] Failed to process event ${event.type}:`,
        error,
      );
    }
  }

  /**
   * Execute a single automation action.
   */
  private async executeAction(
    ruleId: string,
    action: AutomationAction,
    event: AutomationEvent,
    depth: number,
  ): Promise<void> {
    switch (action.type) {
      case "create_task":
        await this.executeCreateTask(action, event);
        break;
      case "move_deal_to_stage":
        await this.executeMoveDealToStage(action, event, depth);
        break;
      case "change_contact_lifecycle":
        await this.executeChangeContactLifecycle(action, event, depth);
        break;
      case "send_telegram_message":
        await this.executeSendTelegramMessage(action, event);
        break;
      case "log_activity":
        await this.executeLogActivity(action, event);
        break;
      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  /**
   * Create a task with title from params, due date = now + offset days,
   * linked to deal/contact from event context.
   */
  private async executeCreateTask(
    action: AutomationAction,
    event: AutomationEvent,
  ): Promise<void> {
    const { title, dueDateOffsetDays } = action.params;
    const { userId, payload } = event;

    let dueDate: Date | undefined;
    if (dueDateOffsetDays != null) {
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + Number(dueDateOffsetDays));
    }

    await prisma.task.create({
      data: {
        userId,
        title: title || "Automated task",
        status: "pending",
        priority: "medium",
        dueDate: dueDate ?? null,
        contactId: payload.contactId || payload.contact?.id || null,
        dealId: payload.dealId || payload.deal?.id || null,
      },
    });
  }

  /**
   * Move a deal to a target stage, log activity, and emit deal_stage_changed event
   * (respecting cascade depth).
   */
  private async executeMoveDealToStage(
    action: AutomationAction,
    event: AutomationEvent,
    depth: number,
  ): Promise<void> {
    const { targetStageId } = action.params;
    const { userId, payload } = event;

    const dealId = payload.dealId || payload.deal?.id;
    if (!dealId) {
      throw new Error(
        "No deal ID available in event payload for move_deal_to_stage action",
      );
    }

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { stage: true },
    });
    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    const targetStage = await prisma.stage.findUnique({
      where: { id: targetStageId },
    });
    if (!targetStage) {
      throw new Error(`Target stage ${targetStageId} not found`);
    }

    const fromStage = deal.stage;

    // Update the deal's stage
    const updatedDeal = await prisma.deal.update({
      where: { id: dealId },
      data: { stageId: targetStageId },
    });

    // Log a stage-change activity
    await prisma.activity.create({
      data: {
        userId,
        type: "deal_stage_change",
        description: `Deal moved from "${fromStage.name}" to "${targetStage.name}" by automation`,
        metadata: {
          fromStageId: fromStage.id,
          fromStageName: fromStage.name,
          toStageId: targetStage.id,
          toStageName: targetStage.name,
        },
        contactId: deal.contactId,
        dealId: deal.id,
        isSystem: true,
      },
    });

    // Emit deal_stage_changed event for potential cascade (depth + 1)
    const cascadeEvent: AutomationEvent = {
      type: "deal_stage_changed",
      userId,
      payload: {
        deal: updatedDeal,
        dealId: updatedDeal.id,
        contactId: deal.contactId,
        fromStage,
        toStage: targetStage,
      },
    };
    await this.processEvent(cascadeEvent, depth + 1);
  }

  /**
   * Update a contact's lifecycle stage and emit contact_lifecycle_changed event
   * (respecting cascade depth).
   */
  private async executeChangeContactLifecycle(
    action: AutomationAction,
    event: AutomationEvent,
    depth: number,
  ): Promise<void> {
    const { targetLifecycleStage } = action.params;
    const { userId, payload } = event;

    const contactId = payload.contactId || payload.contact?.id;
    if (!contactId) {
      throw new Error(
        "No contact ID available in event payload for change_contact_lifecycle action",
      );
    }

    const contact = await prisma.customer.findUnique({
      where: { id: contactId },
    });
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`);
    }

    const fromStage = contact.lifecycleStage;

    await prisma.customer.update({
      where: { id: contactId },
      data: { lifecycleStage: targetLifecycleStage },
    });

    // Emit contact_lifecycle_changed event for potential cascade (depth + 1)
    const cascadeEvent: AutomationEvent = {
      type: "contact_lifecycle_changed",
      userId,
      payload: {
        contact: { ...contact, lifecycleStage: targetLifecycleStage },
        contactId,
        from: fromStage,
        to: targetLifecycleStage,
      },
    };
    await this.processEvent(cascadeEvent, depth + 1);
  }

  /**
   * Send a Telegram message to the contact's telegramChatId.
   * Skip if no chatId. Retry 3x with exponential backoff on failure.
   */
  private async executeSendTelegramMessage(
    action: AutomationAction,
    event: AutomationEvent,
  ): Promise<void> {
    const { message } = action.params;
    const { payload } = event;

    const contactId = payload.contactId || payload.contact?.id;
    if (!contactId) {
      throw new Error(
        "No contact ID available in event payload for send_telegram_message action",
      );
    }

    const contact = await prisma.customer.findUnique({
      where: { id: contactId },
    });
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`);
    }

    if (!contact.telegramChatId) {
      // Skip: no telegramChatId configured
      console.warn(
        `[AutomationEngine] Skipping Telegram message for contact ${contactId}: no telegramChatId`,
      );
      throw new Error(
        `Contact ${contactId} does not have a telegramChatId configured`,
      );
    }

    if (!bot) {
      throw new Error("Telegram bot is not configured (no BOT_TOKEN)");
    }

    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await bot.telegram.sendMessage(contact.telegramChatId, message || "");
        // Log outbound telegram_message activity on success
        await logTelegramActivity({
          userId: event.userId,
          contactId,
          direction: "outbound",
          text: (message as string) || "",
        });
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to send Telegram message after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Create an Activity record with type and description from params.
   */
  private async executeLogActivity(
    action: AutomationAction,
    event: AutomationEvent,
  ): Promise<void> {
    const { activityType, description } = action.params;
    const { userId, payload } = event;

    await prisma.activity.create({
      data: {
        userId,
        type: activityType || "note",
        description: description || "Automated activity",
        contactId: payload.contactId || payload.contact?.id || null,
        dealId: payload.dealId || payload.deal?.id || null,
        isSystem: true,
      },
    });
  }

  /**
   * Log a rule action execution to the AutomationRuleLog table.
   */
  private async logExecution(
    ruleId: string,
    actionType: string,
    success: boolean,
    error?: string,
  ): Promise<void> {
    try {
      await prisma.automationRuleLog.create({
        data: {
          ruleId,
          actionType,
          success,
          error: error ?? null,
        },
      });
    } catch (logError) {
      // Don't let logging failures break the automation flow
      console.error(
        `[AutomationEngine] Failed to log execution for rule ${ruleId}:`,
        logError,
      );
    }
  }
}

// --- Singleton instance ---

export const automationEngine = new AutomationEngine();

// --- Register event listeners on crmEventBus ---

function registerEventListeners(): void {
  const triggerTypes: AutomationTriggerType[] = [
    "deal_stage_changed",
    "deal_created",
    "deal_stale",
    "contact_lifecycle_changed",
    "appointment_completed",
  ];

  for (const triggerType of triggerTypes) {
    crmEventBus.on(triggerType, (eventPayload: Record<string, any>) => {
      const event: AutomationEvent = {
        type: triggerType,
        userId: eventPayload.userId,
        payload: eventPayload,
      };
      // Fire-and-forget — errors are handled internally by processEvent
      automationEngine.processEvent(event).catch((err) => {
        console.error(
          `[AutomationEngine] Unhandled error processing ${triggerType}:`,
          err,
        );
      });
    });
  }
}

// Register listeners on module load
registerEventListeners();
