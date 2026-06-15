import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createTaskSchema } from "../validation/schemas.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import prisma from "../config/db.js";
import { crmEventBus } from "../services/eventBus.js";

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Task management endpoints
 */

const router = Router();

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: List all tasks for the authenticated user
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_progress, done]
 *         description: Filter by status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: contactId
 *         schema:
 *           type: string
 *         description: Filter by linked contact ID
 *       - in: query
 *         name: dealId
 *         schema:
 *           type: string
 *         description: Filter by linked deal ID
 *     responses:
 *       200:
 *         description: List of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { status, category, contactId, dealId } = req.query;
      const where: any = { userId: req.userId! };
      if (status) where.status = status as string;
      if (category) where.category = category as string;
      if (contactId) where.contactId = contactId as string;
      if (dealId) where.dealId = dealId as string;

      // When filtering by contact or deal, order by due date ascending (null last)
      const isLinkedQuery = !!(contactId || dealId);
      const orderBy = isLinkedQuery
        ? [{ dueDate: "asc" as const }]
        : [
            { status: "asc" as const },
            { priority: "asc" as const },
            { dueDate: "asc" as const },
          ];

      const pagination = getPagination(req);

      if (pagination) {
        const [tasks, total] = await Promise.all([
          prisma.task.findMany({
            where,
            orderBy,
            skip: pagination.skip,
            take: pagination.take,
          }),
          prisma.task.count({ where }),
        ]);
        res.json(paginatedResponse(tasks, total, pagination));
      } else {
        const tasks = await prisma.task.findMany({
          where,
          orderBy,
        });

        // For linked queries, sort nulls last (Prisma doesn't support nulls last natively in all cases)
        if (isLinkedQuery) {
          tasks.sort((a, b) => {
            if (a.dueDate === null && b.dueDate === null) return 0;
            if (a.dueDate === null) return 1;
            if (b.dueDate === null) return -1;
            return a.dueDate.getTime() - b.dueDate.getTime();
          });
        }

        res.json(tasks);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks." });
    }
  },
);

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TaskBody'
 *     responses:
 *       201:
 *         description: Task created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Title is required or linked entity not found
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  authMiddleware,
  validate(createTaskSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        title,
        description,
        status,
        priority,
        category,
        dueDate,
        contactId,
        dealId,
      } = req.body;
      if (!title) {
        res.status(400).json({ error: "Title is required." });
        return;
      }

      // Validate contactId if provided
      if (contactId) {
        const contact = await prisma.customer.findFirst({
          where: { id: contactId, userId: req.userId! },
        });
        if (!contact) {
          res.status(400).json({
            error: "Linked contact not found or does not belong to user.",
          });
          return;
        }
      }

      // Validate dealId if provided
      if (dealId) {
        const deal = await prisma.deal.findFirst({
          where: { id: dealId, userId: req.userId! },
        });
        if (!deal) {
          res.status(400).json({
            error: "Linked deal not found or does not belong to user.",
          });
          return;
        }
      }

      const task = await prisma.task.create({
        data: {
          userId: req.userId!,
          title,
          description: description || null,
          status: status || "pending",
          priority: priority || "medium",
          category: category || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          contactId: contactId || null,
          dealId: dealId || null,
        },
      });
      res.status(201).json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to create task." });
    }
  },
);

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     summary: Update a task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TaskBody'
 *     responses:
 *       200:
 *         description: Updated task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.put(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { title, description, status, priority, category, dueDate } =
        req.body;

      // Fetch the existing task first to check status change
      const existingTask = await prisma.task.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });

      if (!existingTask) {
        res.status(404).json({ error: "Not found." });
        return;
      }

      const result = await prisma.task.updateMany({
        where: { id: req.params.id, userId: req.userId! },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(status !== undefined && { status }),
          ...(priority !== undefined && { priority }),
          ...(category !== undefined && { category }),
          ...(dueDate !== undefined && {
            dueDate: dueDate ? new Date(dueDate) : null,
          }),
        },
      });
      if (result.count === 0) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      const updated = await prisma.task.findUnique({
        where: { id: req.params.id },
      });

      // If status changed to "done" and task is linked to a contact or deal, log activity and emit event
      if (
        updated &&
        status === "done" &&
        existingTask.status !== "done" &&
        (updated.contactId || updated.dealId)
      ) {
        // Create task_completed activity
        await prisma.activity.create({
          data: {
            userId: req.userId!,
            type: "task_completed",
            description: `Task "${updated.title}" completed`,
            contactId: updated.contactId,
            dealId: updated.dealId,
            isSystem: true,
            metadata: {
              taskId: updated.id,
              taskTitle: updated.title,
              completedAt: new Date().toISOString(),
            },
          },
        });

        // Emit taskCompleted event
        crmEventBus.emitTaskCompleted(req.userId!, {
          id: updated.id,
          userId: updated.userId,
          title: updated.title,
          status: updated.status,
          contactId: updated.contactId,
          dealId: updated.dealId,
        });
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update task." });
    }
  },
);

/**
 * @swagger
 * /api/tasks/{id}:
 *   delete:
 *     summary: Delete a task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.delete(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await prisma.task.deleteMany({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (result.count === 0) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      res.json({ message: "Task deleted." });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task." });
    }
  },
);

export default router;
