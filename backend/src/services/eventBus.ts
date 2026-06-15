import { EventEmitter } from "events";
import type {
  AutomationTriggerType,
  Contact,
  Deal,
  Stage,
} from "../types/crm.js";

/**
 * Appointment shape used in event bus emissions.
 * Mirrors the Prisma Appointment model fields relevant to CRM events.
 */
export interface AppointmentEvent {
  id: string;
  userId: string;
  customerId: string | null;
  title: string;
  startTime: Date;
  endTime: Date;
  status: string;
  price: number | null;
  notes: string | null;
}

/**
 * Task shape used in event bus emissions.
 * Mirrors the Prisma Task model fields relevant to CRM events.
 */
export interface TaskEvent {
  id: string;
  userId: string;
  title: string;
  status: string;
  contactId: string | null;
  dealId: string | null;
}

/**
 * In-process CRM event bus built on Node.js EventEmitter.
 * Provides typed emission methods for CRM domain events that trigger
 * the automation engine.
 */
class CRMEventBus extends EventEmitter {
  /**
   * Emitted when a deal moves from one pipeline stage to another.
   */
  emitDealStageChanged(
    userId: string,
    deal: Deal,
    fromStage: Stage,
    toStage: Stage,
  ): void {
    const eventType: AutomationTriggerType = "deal_stage_changed";
    this.emit(eventType, { userId, deal, fromStage, toStage });
  }

  /**
   * Emitted when a new deal is created.
   */
  emitDealCreated(userId: string, deal: Deal): void {
    const eventType: AutomationTriggerType = "deal_created";
    this.emit(eventType, { userId, deal });
  }

  /**
   * Emitted when a contact's lifecycle stage changes.
   */
  emitContactLifecycleChanged(
    userId: string,
    contact: Contact,
    from: string,
    to: string,
  ): void {
    const eventType: AutomationTriggerType = "contact_lifecycle_changed";
    this.emit(eventType, { userId, contact, from, to });
  }

  /**
   * Emitted when an appointment is marked as completed.
   */
  emitAppointmentCompleted(
    userId: string,
    appointment: AppointmentEvent,
    contact: Contact,
  ): void {
    const eventType: AutomationTriggerType = "appointment_completed";
    this.emit(eventType, { userId, appointment, contact });
  }

  /**
   * Emitted when a deal has had no activity or stage change
   * for longer than the configured stale threshold.
   */
  emitDealStale(userId: string, deal: Deal): void {
    const eventType: AutomationTriggerType = "deal_stale";
    this.emit(eventType, { userId, deal });
  }

  /**
   * Emitted when a linked task is completed.
   * Note: "task_completed" is not in AutomationTriggerType but is used
   * for activity logging on the contact/deal timeline.
   */
  emitTaskCompleted(userId: string, task: TaskEvent): void {
    this.emit("task_completed", { userId, task });
  }
}

export const crmEventBus = new CRMEventBus();
