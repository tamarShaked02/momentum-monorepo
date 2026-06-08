import { z } from "zod";

export const createAppointmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  customerId: z.string().optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  source: z.enum(["manual", "telegram", "google"]).optional(),
  price: z.number().optional(),
  notes: z.string().optional(),
});

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export const createInventoryItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  sku: z.string().optional(),
  quantity: z.number().min(0, "Quantity must be at least 0").optional(),
  lowThreshold: z
    .number()
    .min(0, "Low threshold must be at least 0")
    .optional(),
  price: z.number().min(0, "Price must be at least 0").optional(),
  category: z.string().optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  category: z.string().optional(),
  dueDate: z.string().optional(),
});
