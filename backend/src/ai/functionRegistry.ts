import { z } from "zod";
import prisma from "../config/db.js";
import { resolveRelativeDate } from "./dateResolver.js";

export type FunctionClassification = "read" | "write" | "destructive";

export interface FunctionDefinition {
  action: string;
  module: string;
  description: string;
  classification: FunctionClassification;
  parameters: z.ZodObject<any>;
  handler: (params: any, userId: string) => Promise<any>;
}

// Global registry instance placeholder
export const registryFunctions = new Map<string, FunctionDefinition>();

export const functionRegistry = {
  functions: registryFunctions,
  getByAction(action: string): FunctionDefinition | undefined {
    return registryFunctions.get(action);
  },
  getByModule(module: string): FunctionDefinition[] {
    return Array.from(registryFunctions.values()).filter((f) => f.module === module);
  },
  getAllDeclarations(): any[] {
    return Array.from(registryFunctions.values()).map((f) => {
      // Convert Zod schema to Gemini function declaration compatible format
      const properties: Record<string, any> = {};
      const required: string[] = [];
      const shape = f.parameters.shape;

      for (const [key, value] of Object.entries(shape)) {
        let type = "string";
        let description = "";
        let enumValues: string[] | undefined;

        let currentType: any = value;
        // Unwrap optional/nullable
        while (currentType && (currentType._def?.typeName === "ZodOptional" || currentType._def?.typeName === "ZodNullable")) {
          currentType = currentType._def.innerType;
        }

        if (currentType._def?.typeName === "ZodNumber") {
          type = "number";
        } else if (currentType._def?.typeName === "ZodBoolean") {
          type = "boolean";
        } else if (currentType._def?.typeName === "ZodArray") {
          let elementType = "string";
          const inner = currentType._def.type;
          let innerType = inner;
          while (innerType && (innerType._def?.typeName === "ZodOptional" || innerType._def?.typeName === "ZodNullable")) {
            innerType = innerType._def.innerType;
          }
          if (innerType._def?.typeName === "ZodNumber") {
            elementType = "number";
          } else if (innerType._def?.typeName === "ZodBoolean") {
            elementType = "boolean";
          } else if (innerType._def?.typeName === "ZodRecord" || innerType._def?.typeName === "ZodObject") {
            elementType = "object";
          }
          properties[key] = {
            type: "array",
            description: (value as any).description || "",
            items: {
              type: elementType,
            },
          };
          if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodNullable)) {
            required.push(key);
          }
          continue;
        } else if (currentType._def?.typeName === "ZodEnum") {
          type = "string";
          enumValues = currentType._def.values;
        }

        // Extract description from Zod metadata if any
        description = (value as any).description || "";

        properties[key] = {
          type,
          description,
          ...(enumValues ? { enum: enumValues } : {}),
        };

        if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodNullable)) {
          required.push(key);
        }
      }

      return {
        name: f.action,
        description: f.description,
        parameters: {
          type: "object",
          properties,
          required,
        },
      };
    });
  },
  findSimilar(action: string): string[] {
    const list = Array.from(registryFunctions.keys());
    // Find up to 3 keys that share prefix or contain part of string
    return list
      .filter((k) => k.includes(action) || action.includes(k))
      .slice(0, 3);
  },
};

// Helper: Find customer by name or email
async function findOrCreateCustomer(name: string, userId: string): Promise<any> {
  let customer = await prisma.customer.findFirst({
    where: {
      userId,
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        userId,
        name,
        lifecycleStage: "lead",
      },
    });
  }
  return customer;
}

// ----------------------------------------
// 1. Scheduling Module Functions
// ----------------------------------------

registryFunctions.set("book_appointment", {
  action: "book_appointment",
  module: "scheduling",
  description: "Schedule a new appointment for a customer.",
  classification: "write",
  parameters: z.object({
    title: z.string().describe("The appointment service or title, e.g. 'Haircut'"),
    date: z.string().describe("The date of the appointment, e.g. 'tomorrow', '2026-06-16'"),
    time: z.string().describe("The time of the appointment, e.g. '3:00 PM', '14:00'"),
    duration: z.number().optional().describe("Duration in minutes (default 60)"),
    customerName: z.string().optional().describe("Name of the customer"),
  }),
  handler: async (params, userId) => {
    let customerId: string | null = null;
    if (params.customerName) {
      const customer = await findOrCreateCustomer(params.customerName, userId);
      customerId = customer.id;
    }
    const resolvedDate = resolveRelativeDate(`${params.date} at ${params.time}`);
    const duration = params.duration || 60;
    const endTime = new Date(resolvedDate);
    endTime.setMinutes(endTime.getMinutes() + duration);

    return await prisma.appointment.create({
      data: {
        userId,
        title: params.title,
        startTime: resolvedDate,
        endTime,
        customerId,
        status: "scheduled",
        source: "telegram",
      },
      include: { customer: true },
    });
  },
});

registryFunctions.set("cancel_appointment", {
  action: "cancel_appointment",
  module: "scheduling",
  description: "Cancel an existing appointment.",
  classification: "destructive",
  parameters: z.object({
    appointmentId: z.string().optional().describe("Specific ID of the appointment"),
    title: z.string().optional().describe("Title/Service of the appointment to cancel"),
    date: z.string().optional().describe("Date of the appointment to cancel"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.appointmentId) {
      whereClause.id = params.appointmentId;
    } else if (params.title) {
      whereClause.title = { contains: params.title, mode: "insensitive" };
      if (params.date) {
        const resolvedDate = resolveRelativeDate(params.date);
        const dayStart = new Date(resolvedDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        whereClause.startTime = { gte: dayStart, lt: dayEnd };
      }
    } else {
      throw new Error("Either appointmentId or title is required to cancel an appointment.");
    }

    const appointment = await prisma.appointment.findFirst({ where: whereClause });
    if (!appointment) throw new Error("Appointment not found.");

    await prisma.appointment.delete({ where: { id: appointment.id } });
    return { id: appointment.id, message: "Appointment cancelled successfully." };
  },
});

registryFunctions.set("reschedule_appointment", {
  action: "reschedule_appointment",
  module: "scheduling",
  description: "Reschedule an existing appointment to a new date and time.",
  classification: "write",
  parameters: z.object({
    appointmentId: z.string().optional().describe("Specific ID of the appointment"),
    title: z.string().optional().describe("Title of the appointment to reschedule"),
    date: z.string().optional().describe("Current date of the appointment"),
    newDate: z.string().describe("New date, e.g. 'next Monday'"),
    newTime: z.string().describe("New time, e.g. '4pm'"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.appointmentId) {
      whereClause.id = params.appointmentId;
    } else if (params.title) {
      whereClause.title = { contains: params.title, mode: "insensitive" };
      if (params.date) {
        const resolvedDate = resolveRelativeDate(params.date);
        const dayStart = new Date(resolvedDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        whereClause.startTime = { gte: dayStart, lt: dayEnd };
      }
    } else {
      throw new Error("Either appointmentId or title is required to reschedule.");
    }

    const appointment = await prisma.appointment.findFirst({ where: whereClause });
    if (!appointment) throw new Error("Appointment not found.");

    const newStart = resolveRelativeDate(`${params.newDate} at ${params.newTime}`);
    const durationMs = appointment.endTime.getTime() - appointment.startTime.getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);

    return await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        startTime: newStart,
        endTime: newEnd,
      },
    });
  },
});

registryFunctions.set("list_appointments", {
  action: "list_appointments",
  module: "scheduling",
  description: "List scheduled appointments with optional filters.",
  classification: "read",
  parameters: z.object({
    startDate: z.string().optional().describe("Filter start date, e.g. 'today'"),
    endDate: z.string().optional().describe("Filter end date, e.g. 'next week'"),
    customerName: z.string().optional().describe("Filter by customer name"),
  }),
  handler: async (params, userId) => {
    const where: any = { userId };
    if (params.startDate) {
      const resolvedStart = resolveRelativeDate(params.startDate);
      where.startTime = { ...where.startTime, gte: resolvedStart };
    }
    if (params.endDate) {
      const resolvedEnd = resolveRelativeDate(params.endDate);
      where.startTime = { ...where.startTime, lte: resolvedEnd };
    }
    if (params.customerName) {
      where.customer = {
        name: { contains: params.customerName, mode: "insensitive" },
      };
    }

    return await prisma.appointment.findMany({
      where,
      include: { customer: true },
      orderBy: { startTime: "asc" },
    });
  },
});

registryFunctions.set("check_availability", {
  action: "check_availability",
  module: "scheduling",
  description: "Check available time slots on a specific date.",
  classification: "read",
  parameters: z.object({
    date: z.string().describe("The date to check, e.g. 'tomorrow'"),
    duration: z.number().optional().describe("Slot duration in minutes (default 60)"),
  }),
  handler: async (params, userId) => {
    const targetDate = resolveRelativeDate(params.date);
    targetDate.setHours(0, 0, 0, 0);

    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        userId,
        startTime: { gte: targetDate, lt: nextDate },
        status: { not: "cancelled" },
      },
      orderBy: { startTime: "asc" },
    });

    const durationMin = params.duration || 60;
    const slots = [];
    const startHour = 8;
    const endHour = 18;

    let current = new Date(targetDate);
    current.setHours(startHour, 0, 0, 0);
    const endLimit = new Date(targetDate);
    endLimit.setHours(endHour, 0, 0, 0);

    while (true) {
      const slotStart = new Date(current);
      const slotEnd = new Date(current);
      slotEnd.setMinutes(slotEnd.getMinutes() + durationMin);
      if (slotEnd > endLimit) break;

      const isBooked = existingAppointments.some((apt) => {
        const aptStart = new Date(apt.startTime);
        const aptEnd = new Date(apt.endTime);
        return aptStart < slotEnd && aptEnd > slotStart;
      });

      slots.push({
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        available: !isBooked,
      });

      current.setMinutes(current.getMinutes() + durationMin);
    }

    return { date: params.date, slots };
  },
});

// ----------------------------------------
// 2. CRM Module Functions
// ----------------------------------------

registryFunctions.set("add_customer", {
  action: "add_customer",
  module: "crm",
  description: "Create a new customer in the CRM.",
  classification: "write",
  parameters: z.object({
    name: z.string().describe("Customer's full name"),
    phone: z.string().optional().describe("Customer's phone number"),
    email: z.string().optional().describe("Customer's email address"),
  }),
  handler: async (params, userId) => {
    return await prisma.customer.create({
      data: {
        userId,
        name: params.name,
        phone: params.phone || null,
        email: params.email || null,
        lifecycleStage: "lead",
      },
    });
  },
});

registryFunctions.set("update_customer", {
  action: "update_customer",
  module: "crm",
  description: "Update details of an existing customer.",
  classification: "write",
  parameters: z.object({
    customerId: z.string().optional().describe("Specific ID of the customer"),
    name: z.string().optional().describe("Current name of the customer to find them"),
    field: z.string().describe("Field to update (e.g. 'phone', 'email', 'company', 'lifecycleStage')"),
    value: z.string().describe("New value for the field"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.customerId) {
      whereClause.id = params.customerId;
    } else if (params.name) {
      whereClause.name = { equals: params.name, mode: "insensitive" };
    } else {
      throw new Error("Either customerId or name is required to update customer.");
    }

    const customer = await prisma.customer.findFirst({ where: whereClause });
    if (!customer) throw new Error("Customer not found.");

    return await prisma.customer.update({
      where: { id: customer.id },
      data: { [params.field]: params.value },
    });
  },
});

registryFunctions.set("search_customers", {
  action: "search_customers",
  module: "crm",
  description: "Search customers by name, email, phone, or company.",
  classification: "read",
  parameters: z.object({
    query: z.string().describe("Search keyword"),
  }),
  handler: async (params, userId) => {
    // Property 7: Case-insensitive substring match in name, email, phone, or company
    return await prisma.customer.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: params.query, mode: "insensitive" } },
          { email: { contains: params.query, mode: "insensitive" } },
          { phone: { contains: params.query, mode: "insensitive" } },
          { company: { contains: params.query, mode: "insensitive" } },
        ],
      },
    });
  },
});

registryFunctions.set("create_deal", {
  action: "create_deal",
  module: "crm",
  description: "Create a new sales deal linked to a customer.",
  classification: "write",
  parameters: z.object({
    title: z.string().describe("Deal title, e.g. 'Website project'"),
    customerName: z.string().describe("Name of the customer for the deal"),
    pipelineName: z.string().optional().describe("Pipeline name (optional)"),
    stageName: z.string().optional().describe("Pipeline stage name (optional)"),
    value: z.number().optional().describe("Monetary value of the deal"),
  }),
  handler: async (params, userId) => {
    const customer = await findOrCreateCustomer(params.customerName, userId);

    let pipeline = params.pipelineName
      ? await prisma.pipeline.findFirst({
          where: { userId, name: { equals: params.pipelineName, mode: "insensitive" } },
        })
      : await prisma.pipeline.findFirst({ where: { userId } });

    if (!pipeline) {
      // Create a default pipeline
      pipeline = await prisma.pipeline.create({
        data: { userId, name: params.pipelineName || "Sales Pipeline" },
      });
    }

    let stage = params.stageName
      ? await prisma.stage.findFirst({
          where: { pipelineId: pipeline.id, name: { equals: params.stageName, mode: "insensitive" } },
        })
      : await prisma.stage.findFirst({ where: { pipelineId: pipeline.id }, orderBy: { position: "asc" } });

    if (!stage) {
      stage = await prisma.stage.create({
        data: {
          pipelineId: pipeline.id,
          name: params.stageName || "Lead",
          position: 0,
        },
      });
    }

    return await prisma.deal.create({
      data: {
        userId,
        contactId: customer.id,
        pipelineId: pipeline.id,
        stageId: stage.id,
        title: params.title,
        value: params.value || null,
        status: "open",
      },
      include: { contact: true, stage: true, pipeline: true },
    });
  },
});

registryFunctions.set("move_deal", {
  action: "move_deal",
  module: "crm",
  description: "Move a deal to a different pipeline stage.",
  classification: "write",
  parameters: z.object({
    dealId: z.string().optional().describe("ID of the deal"),
    dealTitle: z.string().optional().describe("Title of the deal"),
    targetStage: z.string().describe("Name of the target stage to move to"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.dealId) {
      whereClause.id = params.dealId;
    } else if (params.dealTitle) {
      whereClause.title = { equals: params.dealTitle, mode: "insensitive" };
    } else {
      throw new Error("Either dealId or dealTitle is required to move deal.");
    }

    const deal = await prisma.deal.findFirst({ where: whereClause });
    if (!deal) throw new Error("Deal not found.");

    const stage = await prisma.stage.findFirst({
      where: {
        pipelineId: deal.pipelineId,
        name: { equals: params.targetStage, mode: "insensitive" },
      },
    });
    if (!stage) throw new Error(`Target stage '${params.targetStage}' not found in pipeline.`);

    return await prisma.deal.update({
      where: { id: deal.id },
      data: { stageId: stage.id },
      include: { stage: true },
    });
  },
});

registryFunctions.set("list_deals", {
  action: "list_deals",
  module: "crm",
  description: "List all deals, with optional filters.",
  classification: "read",
  parameters: z.object({
    stage: z.string().optional().describe("Filter by stage name"),
    customerName: z.string().optional().describe("Filter by customer name"),
    status: z.enum(["open", "won", "lost"]).optional().describe("Filter by deal status"),
  }),
  handler: async (params, userId) => {
    const where: any = { userId };
    if (params.stage) {
      where.stage = {
        name: { equals: params.stage, mode: "insensitive" },
      };
    }
    if (params.customerName) {
      where.contact = {
        name: { contains: params.customerName, mode: "insensitive" },
      };
    }
    if (params.status) {
      where.status = params.status;
    }

    return await prisma.deal.findMany({
      where,
      include: { contact: true, stage: true, pipeline: true },
    });
  },
});

// ----------------------------------------
// 3. Inventory Module Functions
// ----------------------------------------

registryFunctions.set("add_inventory_item", {
  action: "add_inventory_item",
  module: "inventory",
  description: "Add a new item to inventory.",
  classification: "write",
  parameters: z.object({
    name: z.string().describe("Inventory item name"),
    quantity: z.number().optional().describe("Initial stock quantity (default 0)"),
    category: z.string().optional().describe("Category of the item"),
    price: z.number().optional().describe("Selling price of the item"),
  }),
  handler: async (params, userId) => {
    return await prisma.inventoryItem.create({
      data: {
        userId,
        name: params.name,
        quantity: params.quantity || 0,
        category: params.category || null,
        price: params.price || null,
        lowThreshold: 5,
      },
    });
  },
});

registryFunctions.set("update_inventory", {
  action: "update_inventory",
  module: "inventory",
  description: "Update stock level or price of an inventory item.",
  classification: "write",
  parameters: z.object({
    itemId: z.string().optional().describe("ID of the inventory item"),
    itemName: z.string().optional().describe("Name of the item to find it"),
    quantity: z.number().optional().describe("New stock quantity"),
    price: z.number().optional().describe("New selling price"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.itemId) {
      whereClause.id = params.itemId;
    } else if (params.itemName) {
      whereClause.name = { equals: params.itemName, mode: "insensitive" };
    } else {
      throw new Error("Either itemId or itemName is required to update inventory.");
    }

    const item = await prisma.inventoryItem.findFirst({ where: whereClause });
    if (!item) throw new Error("Inventory item not found.");

    const updateData: any = {};
    if (params.quantity !== undefined) updateData.quantity = params.quantity;
    if (params.price !== undefined) updateData.price = params.price;

    return await prisma.inventoryItem.update({
      where: { id: item.id },
      data: updateData,
    });
  },
});

registryFunctions.set("check_stock", {
  action: "check_stock",
  module: "inventory",
  description: "Check stock details for a specific item or category.",
  classification: "read",
  parameters: z.object({
    itemName: z.string().optional().describe("Specific name of the item"),
    category: z.string().optional().describe("Category to check"),
  }),
  handler: async (params, userId) => {
    const where: any = { userId };
    if (params.itemName) {
      where.name = { contains: params.itemName, mode: "insensitive" };
    }
    if (params.category) {
      where.category = { equals: params.category, mode: "insensitive" };
    }
    return await prisma.inventoryItem.findMany({ where });
  },
});

registryFunctions.set("list_low_stock", {
  action: "list_low_stock",
  module: "inventory",
  description: "List all items in inventory that have low stock (at or below threshold).",
  classification: "read",
  parameters: z.object({}),
  handler: async (params, userId) => {
    // Property 6: low stock items. (quantity <= lowThreshold)
    const items = await prisma.inventoryItem.findMany({ where: { userId } });
    return items.filter((i) => i.quantity <= i.lowThreshold);
  },
});

registryFunctions.set("search_inventory", {
  action: "search_inventory",
  module: "inventory",
  description: "Search inventory items by name or category.",
  classification: "read",
  parameters: z.object({
    query: z.string().describe("Search query string"),
  }),
  handler: async (params, userId) => {
    // Property 7: search items. Case-insensitive substring match in name or category.
    return await prisma.inventoryItem.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: params.query, mode: "insensitive" } },
          { category: { contains: params.query, mode: "insensitive" } },
        ],
      },
    });
  },
});

// ----------------------------------------
// 4. Task Module Functions
// ----------------------------------------

registryFunctions.set("create_task", {
  action: "create_task",
  module: "tasks",
  description: "Create a new task.",
  classification: "write",
  parameters: z.object({
    title: z.string().describe("Title of the task"),
    priority: z.enum(["low", "medium", "high"]).optional().describe("Priority level (low/medium/high)"),
    dueDate: z.string().optional().describe("Due date, e.g. 'tomorrow', '2026-06-20'"),
    category: z.string().optional().describe("Category label for the task"),
  }),
  handler: async (params, userId) => {
    const dueDate = params.dueDate ? resolveRelativeDate(params.dueDate) : null;
    return await prisma.task.create({
      data: {
        userId,
        title: params.title,
        priority: params.priority || "medium",
        dueDate,
        category: params.category || null,
        status: "pending",
      },
    });
  },
});

registryFunctions.set("complete_task", {
  action: "complete_task",
  module: "tasks",
  description: "Mark a task as completed.",
  classification: "write",
  parameters: z.object({
    taskId: z.string().optional().describe("Specific ID of the task"),
    taskTitle: z.string().optional().describe("Title of the task to mark complete"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.taskId) {
      whereClause.id = params.taskId;
    } else if (params.taskTitle) {
      whereClause.title = { equals: params.taskTitle, mode: "insensitive" };
    } else {
      throw new Error("Either taskId or taskTitle is required to complete a task.");
    }

    const task = await prisma.task.findFirst({ where: whereClause });
    if (!task) throw new Error("Task not found.");

    return await prisma.task.update({
      where: { id: task.id },
      data: { status: "done" },
    });
  },
});

registryFunctions.set("update_task", {
  action: "update_task",
  module: "tasks",
  description: "Update details of an existing task.",
  classification: "write",
  parameters: z.object({
    taskId: z.string().optional().describe("Specific ID of the task"),
    taskTitle: z.string().optional().describe("Current title of the task to find it"),
    title: z.string().optional().describe("New title for the task"),
    priority: z.enum(["low", "medium", "high"]).optional().describe("New priority level"),
    dueDate: z.string().optional().describe("New due date"),
    status: z.enum(["pending", "in_progress", "done"]).optional().describe("New status"),
    category: z.string().optional().describe("New category label"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.taskId) {
      whereClause.id = params.taskId;
    } else if (params.taskTitle) {
      whereClause.title = { equals: params.taskTitle, mode: "insensitive" };
    } else {
      throw new Error("Either taskId or taskTitle is required to update task.");
    }

    const task = await prisma.task.findFirst({ where: whereClause });
    if (!task) throw new Error("Task not found.");

    const updateData: any = {};
    if (params.title !== undefined) updateData.title = params.title;
    if (params.priority !== undefined) updateData.priority = params.priority;
    if (params.dueDate !== undefined) {
      updateData.dueDate = params.dueDate ? resolveRelativeDate(params.dueDate) : null;
    }
    if (params.status !== undefined) updateData.status = params.status;
    if (params.category !== undefined) updateData.category = params.category;

    return await prisma.task.update({
      where: { id: task.id },
      data: updateData,
    });
  },
});

registryFunctions.set("list_tasks", {
  action: "list_tasks",
  module: "tasks",
  description: "List tasks with filters.",
  classification: "read",
  parameters: z.object({
    status: z.enum(["pending", "in_progress", "done"]).optional().describe("Filter by status"),
    priority: z.enum(["low", "medium", "high"]).optional().describe("Filter by priority"),
    category: z.string().optional().describe("Filter by category"),
    dueBefore: z.string().optional().describe("Filter tasks due before this date"),
    dueAfter: z.string().optional().describe("Filter tasks due after this date"),
  }),
  handler: async (params, userId) => {
    const where: any = { userId };
    if (params.status) where.status = params.status;
    if (params.priority) where.priority = params.priority;
    if (params.category) where.category = { equals: params.category, mode: "insensitive" };

    if (params.dueBefore || params.dueAfter) {
      where.dueDate = {};
      if (params.dueBefore) {
        where.dueDate.lte = resolveRelativeDate(params.dueBefore);
      }
      if (params.dueAfter) {
        where.dueDate.gte = resolveRelativeDate(params.dueAfter);
      }
    }

    return await prisma.task.findMany({
      where,
      orderBy: { dueDate: "asc" },
    });
  },
});

registryFunctions.set("delete_task", {
  action: "delete_task",
  module: "tasks",
  description: "Permanently delete a task.",
  classification: "destructive",
  parameters: z.object({
    taskId: z.string().optional().describe("Specific ID of the task to delete"),
    taskTitle: z.string().optional().describe("Title of the task to delete"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.taskId) {
      whereClause.id = params.taskId;
    } else if (params.taskTitle) {
      whereClause.title = { equals: params.taskTitle, mode: "insensitive" };
    } else {
      throw new Error("Either taskId or taskTitle is required to delete task.");
    }

    const task = await prisma.task.findFirst({ where: whereClause });
    if (!task) throw new Error("Task not found.");

    await prisma.task.delete({ where: { id: task.id } });
    return { id: task.id, message: "Task deleted successfully." };
  },
});

// ----------------------------------------
// 5. Marketing Module Functions
// ----------------------------------------

registryFunctions.set("create_campaign", {
  action: "create_campaign",
  module: "marketing",
  description: "Create a marketing campaign.",
  classification: "write",
  parameters: z.object({
    name: z.string().describe("Campaign name"),
    goal: z.string().describe("Target goal of the campaign"),
    channel: z.enum(["sms", "email", "social"]).optional().describe("Campaign marketing channel"),
    audienceTags: z.array(z.string()).optional().describe("Tags defining targeting audience"),
    audienceStages: z.array(z.string()).optional().describe("Lifecycle stages defining targeting audience"),
  }),
  handler: async (params, userId) => {
    return await prisma.marketingCampaign.create({
      data: {
        userId,
        name: params.name,
        goal: params.goal,
        channels: params.channel ? [params.channel] : [],
        audienceTags: params.audienceTags || [],
        audienceLifecycleStages: params.audienceStages || [],
      },
    });
  },
});

registryFunctions.set("generate_content", {
  action: "generate_content",
  module: "marketing",
  description: "Generate campaign content for a specific channel.",
  classification: "write",
  parameters: z.object({
    campaignId: z.string().optional().describe("Campaign ID"),
    campaignName: z.string().optional().describe("Campaign Name"),
    channel: z.enum(["sms", "email", "social"]).describe("Channel to generate content for"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.campaignId) {
      whereClause.id = params.campaignId;
    } else if (params.campaignName) {
      whereClause.name = { equals: params.campaignName, mode: "insensitive" };
    } else {
      throw new Error("Either campaignId or campaignName is required.");
    }

    const campaign = await prisma.marketingCampaign.findFirst({ where: whereClause });
    if (!campaign) throw new Error("Campaign not found.");

    const generated = {
      sms: "🔥 Flash Sale! Special offer just for you. Book now!",
      email: {
        subject: "Exclusive Offer!",
        body: "Hi there!\n\nCheck out our latest discount.\n\nBest,",
      },
      social: "Special campaign alert! #sale #discount",
    };

    const updateData: any = {};
    if (params.channel === "sms") updateData.smsContent = generated.sms;
    else if (params.channel === "email") updateData.emailContent = JSON.stringify(generated.email);
    else if (params.channel === "social") updateData.socialContent = generated.social;

    return await prisma.marketingCampaign.update({
      where: { id: campaign.id },
      data: updateData,
    });
  },
});

registryFunctions.set("list_campaigns", {
  action: "list_campaigns",
  module: "marketing",
  description: "List marketing campaigns.",
  classification: "read",
  parameters: z.object({
    status: z.string().optional().describe("Filter by campaign status"),
    channel: z.string().optional().describe("Filter by campaign channel"),
  }),
  handler: async (params, userId) => {
    const where: any = { userId };
    if (params.status) where.status = params.status;
    if (params.channel) {
      where.channels = { has: params.channel };
    }
    return await prisma.marketingCampaign.findMany({ where });
  },
});

registryFunctions.set("get_campaign_stats", {
  action: "get_campaign_stats",
  module: "marketing",
  description: "Get performance stats for a campaign.",
  classification: "read",
  parameters: z.object({
    campaignId: z.string().optional().describe("Campaign ID"),
    campaignName: z.string().optional().describe("Campaign Name"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.campaignId) {
      whereClause.id = params.campaignId;
    } else if (params.campaignName) {
      whereClause.name = { equals: params.campaignName, mode: "insensitive" };
    } else {
      throw new Error("Either campaignId or campaignName is required.");
    }

    const campaign = await prisma.marketingCampaign.findFirst({ where: whereClause });
    if (!campaign) throw new Error("Campaign not found.");

    // Query matching contact count
    const contactWhere: any = { userId };
    const andConditions: any[] = [];
    if (campaign.audienceTags && campaign.audienceTags.length > 0) {
      andConditions.push({
        tags: {
          some: {
            tag: {
              name: { in: campaign.audienceTags },
              userId,
            },
          },
        },
      });
    }
    if (campaign.audienceLifecycleStages && campaign.audienceLifecycleStages.length > 0) {
      andConditions.push({
        lifecycleStage: { in: campaign.audienceLifecycleStages.map((s) => s.toLowerCase()) },
      });
    }
    if (andConditions.length > 0) {
      contactWhere.AND = andConditions;
    }

    const audienceCount = await prisma.customer.count({ where: contactWhere });

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      audienceCount,
      sentCount: audienceCount,
      openRate: 0.45,
      clickRate: 0.12,
    };
  },
});

// ----------------------------------------
// 6. Analytics Module Functions
// ----------------------------------------

registryFunctions.set("get_dashboard_metrics", {
  action: "get_dashboard_metrics",
  module: "analytics",
  description: "Retrieve dashboard summary metrics.",
  classification: "read",
  parameters: z.object({
    period: z.enum(["day", "week", "month"]).optional().describe("Time period"),
    startDate: z.string().optional().describe("Custom start date"),
    endDate: z.string().optional().describe("Custom end date"),
  }),
  handler: async (params, userId) => {
    const totalCustomers = await prisma.customer.count({ where: { userId } });
    const totalAppointments = await prisma.appointment.count({ where: { userId } });
    const pendingTasks = await prisma.task.count({ where: { userId, status: "pending" } });
    const lowStockItems = await prisma.inventoryItem.findMany({ where: { userId } });
    const lowStockCount = lowStockItems.filter((i) => i.quantity <= i.lowThreshold).length;

    return {
      totalCustomers,
      totalAppointments,
      pendingTasks,
      lowStockCount,
      greeting: "Hello, business owner!",
    };
  },
});

registryFunctions.set("get_revenue_report", {
  action: "get_revenue_report",
  module: "analytics",
  description: "Retrieve revenue reports based on completed appointments and won deals.",
  classification: "read",
  parameters: z.object({
    period: z.enum(["day", "week", "month"]).describe("Time period for report"),
    startDate: z.string().optional().describe("Start date for custom filter"),
    endDate: z.string().optional().describe("End date for custom filter"),
  }),
  handler: async (params, userId) => {
    const whereAppointments: any = { userId, status: "completed" };
    const whereDeals: any = { userId, status: "won" };

    if (params.startDate || params.endDate) {
      const start = params.startDate ? resolveRelativeDate(params.startDate) : new Date(0);
      const end = params.endDate ? resolveRelativeDate(params.endDate) : new Date();
      whereAppointments.startTime = { gte: start, lte: end };
      whereDeals.closedAt = { gte: start, lte: end };
    }

    const appointmentRevenue = await prisma.appointment.aggregate({
      where: whereAppointments,
      _sum: { price: true },
    });
    const dealRevenue = await prisma.deal.aggregate({
      where: whereDeals,
      _sum: { value: true },
    });

    const appointmentsTotal = appointmentRevenue._sum.price || 0;
    const dealsTotal = dealRevenue._sum.value || 0;

    return {
      appointmentsTotal,
      dealsTotal,
      revenueTotal: appointmentsTotal + dealsTotal,
    };
  },
});

registryFunctions.set("get_top_services", {
  action: "get_top_services",
  module: "analytics",
  description: "Get top services by appointment count.",
  classification: "read",
  parameters: z.object({
    period: z.string().optional().describe("Filtering period"),
    limit: z.number().optional().describe("Limit of top services to return"),
  }),
  handler: async (params, userId) => {
    const where: any = { userId };
    if (params.period) {
      const start = resolveRelativeDate(params.period);
      where.startTime = { gte: start };
    }

    const appointments = await prisma.appointment.findMany({ where });
    const counts: Record<string, number> = {};
    for (const apt of appointments) {
      counts[apt.title] = (counts[apt.title] || 0) + 1;
    }

    const limit = params.limit || 5;
    // Property 9: sorted descending by count, count equals actual count
    const services = Object.entries(counts)
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return services;
  },
});

registryFunctions.set("get_customer_insights", {
  action: "get_customer_insights",
  module: "analytics",
  description: "Get analytics insights about customers.",
  classification: "read",
  parameters: z.object({
    period: z.string().optional().describe("Period of insight analysis"),
  }),
  handler: async (params, userId) => {
    const customers = await prisma.customer.findMany({ where: { userId } });
    const stages: Record<string, number> = {};
    for (const c of customers) {
      stages[c.lifecycleStage] = (stages[c.lifecycleStage] || 0) + 1;
    }
    return {
      totalCustomers: customers.length,
      stages,
    };
  },
});

// ----------------------------------------
// 7. Automation Module Functions
// ----------------------------------------

registryFunctions.set("list_automations", {
  action: "list_automations",
  module: "automation",
  description: "List active and inactive automation rules.",
  classification: "read",
  parameters: z.object({}),
  handler: async (params, userId) => {
    return await prisma.automationRule.findMany({
      where: { userId },
      orderBy: { position: "asc" },
    });
  },
});

registryFunctions.set("enable_automation", {
  action: "enable_automation",
  module: "automation",
  description: "Enable an automation rule.",
  classification: "write",
  parameters: z.object({
    ruleId: z.string().optional().describe("Specific ID of the automation rule"),
    ruleName: z.string().optional().describe("Name of the automation rule to enable"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.ruleId) {
      whereClause.id = params.ruleId;
    } else if (params.ruleName) {
      whereClause.name = { equals: params.ruleName, mode: "insensitive" };
    } else {
      throw new Error("Either ruleId or ruleName is required.");
    }

    const rule = await prisma.automationRule.findFirst({ where: whereClause });
    if (!rule) throw new Error("Automation rule not found.");

    return await prisma.automationRule.update({
      where: { id: rule.id },
      data: { enabled: true },
    });
  },
});

registryFunctions.set("disable_automation", {
  action: "disable_automation",
  module: "automation",
  description: "Disable an automation rule.",
  classification: "write",
  parameters: z.object({
    ruleId: z.string().optional().describe("Specific ID of the automation rule"),
    ruleName: z.string().optional().describe("Name of the automation rule to disable"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.ruleId) {
      whereClause.id = params.ruleId;
    } else if (params.ruleName) {
      whereClause.name = { equals: params.ruleName, mode: "insensitive" };
    } else {
      throw new Error("Either ruleId or ruleName is required.");
    }

    const rule = await prisma.automationRule.findFirst({ where: whereClause });
    if (!rule) throw new Error("Automation rule not found.");

    return await prisma.automationRule.update({
      where: { id: rule.id },
      data: { enabled: false },
    });
  },
});

registryFunctions.set("create_automation", {
  action: "create_automation",
  module: "automation",
  description: "Create a new automation rule with trigger type, parameters, and actions.",
  classification: "write",
  parameters: z.object({
    name: z.string().describe("Name of the automation rule"),
    triggerType: z.string().describe("Type of the trigger (e.g. 'deal_stage_change')"),
    triggerParams: z.record(z.any()).optional().describe("Parameters for trigger setup"),
    actions: z.array(z.record(z.any())).describe("Actions to run when triggered"),
  }),
  handler: async (params, userId) => {
    const lastRule = await prisma.automationRule.findFirst({
      where: { userId },
      orderBy: { position: "desc" },
    });
    const position = lastRule ? lastRule.position + 1 : 0;

    return await prisma.automationRule.create({
      data: {
        userId,
        name: params.name,
        trigger: { type: params.triggerType, params: params.triggerParams || {} },
        actions: params.actions,
        enabled: true,
        position,
      },
    });
  },
});

// ----------------------------------------
// 8. Explicit Active Operation Modules & Aliases
// ----------------------------------------

registryFunctions.set("update_inventory_quantity", {
  action: "update_inventory_quantity",
  module: "inventory",
  description: "Increase, decrease, or set stock quantity for an inventory item by item name or ID.",
  classification: "write",
  parameters: z.object({
    itemId: z.string().optional().describe("ID of the inventory item"),
    itemName: z.string().optional().describe("Name of the item to update quantity for"),
    quantity: z.number().describe("The quantity value or amount to change"),
    changeType: z.enum(["set", "add", "subtract"]).optional().describe("Type of change: set exact stock, add stock, or subtract stock (default 'set')"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.itemId) {
      whereClause.id = params.itemId;
    } else if (params.itemName) {
      whereClause.name = { equals: params.itemName, mode: "insensitive" };
    } else {
      throw new Error("Either itemId or itemName is required to update stock quantity.");
    }

    let item = await prisma.inventoryItem.findFirst({ where: whereClause });
    if (!item && params.itemName) {
      return await prisma.inventoryItem.create({
        data: {
          userId,
          name: params.itemName,
          quantity: params.quantity,
          lowThreshold: 5,
        },
      });
    }
    if (!item) throw new Error("Inventory item not found.");

    let newQty = params.quantity;
    if (params.changeType === "add") {
      newQty = item.quantity + params.quantity;
    } else if (params.changeType === "subtract") {
      newQty = Math.max(0, item.quantity - params.quantity);
    }

    return await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: newQty },
    });
  },
});

registryFunctions.set("create_inventory_item", {
  action: "create_inventory_item",
  module: "inventory",
  description: "Create a new inventory product or item with name, stock quantity, category, and price.",
  classification: "write",
  parameters: z.object({
    name: z.string().describe("Inventory item name"),
    quantity: z.number().optional().describe("Initial stock quantity (default 0)"),
    category: z.string().optional().describe("Category of the item"),
    price: z.number().optional().describe("Selling price of the item"),
    sku: z.string().optional().describe("SKU code of the item"),
  }),
  handler: async (params, userId) => {
    return await prisma.inventoryItem.create({
      data: {
        userId,
        name: params.name,
        quantity: params.quantity || 0,
        category: params.category || null,
        price: params.price || null,
        sku: params.sku || null,
        lowThreshold: 5,
      },
    });
  },
});

registryFunctions.set("update_task_status", {
  action: "update_task_status",
  module: "tasks",
  description: "Update the status of a task to pending, in_progress, or done by task title or ID.",
  classification: "write",
  parameters: z.object({
    taskId: z.string().optional().describe("Specific ID of the task"),
    taskTitle: z.string().optional().describe("Title of the task to update status for"),
    status: z.enum(["pending", "in_progress", "done"]).describe("New status of the task"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.taskId) {
      whereClause.id = params.taskId;
    } else if (params.taskTitle) {
      whereClause.title = { equals: params.taskTitle, mode: "insensitive" };
    } else {
      throw new Error("Either taskId or taskTitle is required to update task status.");
    }

    const task = await prisma.task.findFirst({ where: whereClause });
    if (!task) throw new Error("Task not found.");

    return await prisma.task.update({
      where: { id: task.id },
      data: { status: params.status },
    });
  },
});

registryFunctions.set("create_appointment", {
  action: "create_appointment",
  module: "scheduling",
  description: "Create or schedule a new appointment or slot for a customer on a given date and time.",
  classification: "write",
  parameters: z.object({
    title: z.string().describe("Appointment service title, e.g. 'Haircut' or 'Consultation'"),
    date: z.string().describe("Date of appointment, e.g. 'tomorrow', '2026-08-15'"),
    time: z.string().describe("Time of appointment, e.g. '3:00 PM', '15:00'"),
    duration: z.number().optional().describe("Duration in minutes (default 60)"),
    customerName: z.string().optional().describe("Name of the customer"),
  }),
  handler: async (params, userId) => {
    let customerId: string | null = null;
    if (params.customerName) {
      const customer = await findOrCreateCustomer(params.customerName, userId);
      customerId = customer.id;
    }
    const resolvedDate = resolveRelativeDate(`${params.date} at ${params.time}`);
    const duration = params.duration || 60;
    const endTime = new Date(resolvedDate);
    endTime.setMinutes(endTime.getMinutes() + duration);

    return await prisma.appointment.create({
      data: {
        userId,
        title: params.title,
        startTime: resolvedDate,
        endTime,
        customerId,
        status: "scheduled",
        source: "ai",
      },
      include: { customer: true },
    });
  },
});

registryFunctions.set("book_slot", {
  action: "book_slot",
  module: "scheduling",
  description: "Book a specific time slot for an appointment or service booking request.",
  classification: "write",
  parameters: z.object({
    title: z.string().describe("Title or service for the slot booking"),
    date: z.string().describe("Date of slot, e.g. 'tomorrow'"),
    time: z.string().describe("Time of slot, e.g. '2:00 PM'"),
    duration: z.number().optional().describe("Duration in minutes"),
    customerName: z.string().optional().describe("Name of the customer booking the slot"),
  }),
  handler: async (params, userId) => {
    let customerId: string | null = null;
    if (params.customerName) {
      const customer = await findOrCreateCustomer(params.customerName, userId);
      customerId = customer.id;
    }
    const resolvedDate = resolveRelativeDate(`${params.date} at ${params.time}`);
    const duration = params.duration || 60;
    const endTime = new Date(resolvedDate);
    endTime.setMinutes(endTime.getMinutes() + duration);

    return await prisma.appointment.create({
      data: {
        userId,
        title: params.title,
        startTime: resolvedDate,
        endTime,
        customerId,
        status: "scheduled",
        source: "ai",
      },
      include: { customer: true },
    });
  },
});

registryFunctions.set("create_contact", {
  action: "create_contact",
  module: "crm",
  description: "Create a new contact or customer in the CRM with name, phone, email, company, or lifecycle stage.",
  classification: "write",
  parameters: z.object({
    name: z.string().describe("Contact's full name"),
    phone: z.string().optional().describe("Contact's phone number"),
    email: z.string().optional().describe("Contact's email address"),
    company: z.string().optional().describe("Contact's company name"),
    lifecycleStage: z.string().optional().describe("Lifecycle stage (lead, subscriber, customer, etc.)"),
  }),
  handler: async (params, userId) => {
    return await prisma.customer.create({
      data: {
        userId,
        name: params.name,
        phone: params.phone || null,
        email: params.email || null,
        company: params.company || null,
        lifecycleStage: params.lifecycleStage || "lead",
      },
    });
  },
});

registryFunctions.set("update_deal_stage", {
  action: "update_deal_stage",
  module: "crm",
  description: "Move or update the stage of a deal in the sales pipeline by deal title or ID.",
  classification: "write",
  parameters: z.object({
    dealId: z.string().optional().describe("ID of the deal"),
    dealTitle: z.string().optional().describe("Title of the deal to update"),
    targetStage: z.string().describe("Name of the target stage to move the deal into"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.dealId) {
      whereClause.id = params.dealId;
    } else if (params.dealTitle) {
      whereClause.title = { equals: params.dealTitle, mode: "insensitive" };
    } else {
      throw new Error("Either dealId or dealTitle is required to update deal stage.");
    }

    const deal = await prisma.deal.findFirst({ where: whereClause });
    if (!deal) throw new Error("Deal not found.");

    const stage = await prisma.stage.findFirst({
      where: {
        pipelineId: deal.pipelineId,
        name: { equals: params.targetStage, mode: "insensitive" },
      },
    });
    if (!stage) throw new Error(`Target stage '${params.targetStage}' not found.`);

    return await prisma.deal.update({
      where: { id: deal.id },
      data: { stageId: stage.id },
      include: { stage: true, contact: true },
    });
  },
});

registryFunctions.set("create_marketing_campaign", {
  action: "create_marketing_campaign",
  module: "marketing",
  description: "Create a new marketing campaign with parameters: name, type/channel, target audience/goal, and status.",
  classification: "write",
  parameters: z.object({
    name: z.string().describe("Name of the marketing campaign"),
    type: z.enum(["email", "sms", "social"]).optional().describe("Campaign marketing channel or type"),
    targetAudience: z.string().optional().describe("Target audience description, tags, or campaign goal"),
    status: z.enum(["draft", "active", "scheduled", "completed", "paused"]).optional().describe("Status of the campaign"),
  }),
  handler: async (params, userId) => {
    return await prisma.marketingCampaign.create({
      data: {
        userId,
        name: params.name,
        goal: params.targetAudience || null,
        channels: params.type ? [params.type] : [],
        status: params.status || "draft",
      },
    });
  },
});

registryFunctions.set("update_campaign_status", {
  action: "update_campaign_status",
  module: "marketing",
  description: "Update the status of a marketing campaign (draft, active, scheduled, completed, paused) by campaign name or ID.",
  classification: "write",
  parameters: z.object({
    campaignId: z.string().optional().describe("ID of the marketing campaign"),
    campaignName: z.string().optional().describe("Name of the marketing campaign to update"),
    status: z.enum(["draft", "active", "scheduled", "completed", "paused"]).describe("New status for the campaign"),
  }),
  handler: async (params, userId) => {
    let whereClause: any = { userId };
    if (params.campaignId) {
      whereClause.id = params.campaignId;
    } else if (params.campaignName) {
      whereClause.name = { equals: params.campaignName, mode: "insensitive" };
    } else {
      throw new Error("Either campaignId or campaignName is required.");
    }

    const campaign = await prisma.marketingCampaign.findFirst({ where: whereClause });
    if (!campaign) throw new Error("Campaign not found.");

    return await prisma.marketingCampaign.update({
      where: { id: campaign.id },
      data: { status: params.status },
    });
  },
});

// ----------------------------------------
// 9. Read-Only Data Retrieval Tools for Q&A
// ----------------------------------------

registryFunctions.set("get_inventory_status", {
  action: "get_inventory_status",
  module: "inventory",
  description: "Get stock quantities and status for inventory items, optionally filtered by item name or category. Use when the user asks 'how many', 'what is the stock', or 'check inventory'.",
  classification: "read",
  parameters: z.object({
    itemName: z.string().optional().describe("Filter by specific item name"),
    category: z.string().optional().describe("Filter by inventory category"),
  }),
  handler: async (params, userId) => {
    const where: any = { userId };
    if (params.itemName) {
      where.name = { contains: params.itemName, mode: "insensitive" };
    }
    if (params.category) {
      where.category = { equals: params.category, mode: "insensitive" };
    }
    const items = await prisma.inventoryItem.findMany({ where });
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      lowThreshold: item.lowThreshold,
      price: item.price,
      category: item.category,
      isLowStock: item.quantity <= item.lowThreshold,
    }));
  },
});

registryFunctions.set("get_pending_tasks", {
  action: "get_pending_tasks",
  module: "tasks",
  description: "Retrieve list of pending or active tasks, optionally filtered by status or date range. Use when the user asks 'what are my tasks', 'show pending tasks', or 'what do I need to do'.",
  classification: "read",
  parameters: z.object({
    status: z.enum(["pending", "in_progress", "done"]).optional().describe("Task status filter (default 'pending')"),
    dueBefore: z.string().optional().describe("Filter tasks due before specific date"),
  }),
  handler: async (params, userId) => {
    const where: any = { userId, status: params.status || "pending" };
    if (params.dueBefore) {
      where.dueDate = { lte: resolveRelativeDate(params.dueBefore) };
    }
    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueDate: "asc" },
    });
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      category: t.category,
    }));
  },
});

registryFunctions.set("get_crm_summary", {
  action: "get_crm_summary",
  module: "crm",
  description: "Get CRM summary including contacts, deals, and sales pipeline stage totals, optionally filtered by stage or contact name. Use when user asks 'how many customers', 'show my deals', or 'CRM summary'.",
  classification: "read",
  parameters: z.object({
    contactName: z.string().optional().describe("Filter by contact name"),
    stageName: z.string().optional().describe("Filter by pipeline stage name"),
  }),
  handler: async (params, userId) => {
    const contactWhere: any = { userId };
    if (params.contactName) {
      contactWhere.name = { contains: params.contactName, mode: "insensitive" };
    }
    const contacts = await prisma.customer.findMany({
      where: contactWhere,
      take: 50,
    });

    const dealWhere: any = { userId };
    if (params.stageName) {
      dealWhere.stage = { name: { equals: params.stageName, mode: "insensitive" } };
    }
    const deals = await prisma.deal.findMany({
      where: dealWhere,
      include: { stage: true, contact: true },
      take: 50,
    });

    return {
      totalContacts: contacts.length,
      contacts: contacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        lifecycleStage: c.lifecycleStage,
      })),
      totalDeals: deals.length,
      deals: deals.map((d) => ({
        id: d.id,
        title: d.title,
        value: d.value,
        status: d.status,
        stage: d.stage?.name,
      })),
    };
  },
});

registryFunctions.set("get_marketing_campaigns", {
  action: "get_marketing_campaigns",
  module: "marketing",
  description: "List marketing campaigns with their channel, goal, and status, optionally filtered by status (draft, active, scheduled, completed, paused). Use when user asks 'show my campaigns', 'what active campaigns do I have', or 'campaign status'.",
  classification: "read",
  parameters: z.object({
    status: z.enum(["draft", "active", "scheduled", "completed", "paused"]).optional().describe("Status filter for campaigns"),
  }),
  handler: async (params, userId) => {
    const where: any = { userId };
    if (params.status) {
      where.status = params.status;
    }
    const campaigns = await prisma.marketingCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      goal: c.goal,
      status: c.status,
      channels: c.channels,
      createdAt: c.createdAt.toISOString(),
    }));
  },
});

const getFinancialSummaryHandler = async (params: any, userId: string) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const wonDeals = await prisma.deal.findMany({
    where: {
      userId,
      status: { equals: "won", mode: "insensitive" },
      updatedAt: { gte: startOfMonth },
    },
  });

  const allWonDeals = await prisma.deal.findMany({
    where: {
      userId,
      status: { equals: "won", mode: "insensitive" },
    },
  });

  const completedAppointments = await prisma.appointment.findMany({
    where: {
      userId,
      status: { equals: "completed", mode: "insensitive" },
    },
  });

  const monthlyDealRevenue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const totalDealRevenue = allWonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const appointmentRevenue = completedAppointments.reduce((sum, a) => sum + (a.price || 0), 0);

  const monthlyRevenue = monthlyDealRevenue || totalDealRevenue || appointmentRevenue || 0;
  const monthlyExpenses = 0;
  const monthlyProfit = monthlyRevenue - monthlyExpenses;

  return {
    monthlyRevenue,
    monthlyProfit,
    monthlyExpenses,
    totalDealsWon: wonDeals.length || allWonDeals.length,
    completedAppointmentsCount: completedAppointments.length,
    currency: "USD",
  };
};

registryFunctions.set("get_financial_summary", {
  action: "get_financial_summary",
  module: "analytics",
  description: "Use this tool to calculate and fetch raw financial numbers (like revenue, profit, or sales) when the user asks about their income. Use this to provide a direct numerical answer. DO NOT use export tools unless the user explicitly types 'export'.",
  classification: "read",
  parameters: z.object({
    period: z.string().optional().describe("Time period such as 'monthly', 'quarterly', 'yearly'"),
  }),
  handler: getFinancialSummaryHandler,
});

registryFunctions.set("get_monthly_profit", {
  action: "get_monthly_profit",
  module: "analytics",
  description: "Use this tool to calculate and fetch raw financial numbers (like revenue, profit, or sales) when the user asks about their income. Use this to provide a direct numerical answer. DO NOT use export tools unless the user explicitly types 'export'.",
  classification: "read",
  parameters: z.object({
    period: z.string().optional().describe("Time period such as 'monthly'"),
  }),
  handler: getFinancialSummaryHandler,
});


