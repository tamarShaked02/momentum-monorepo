import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createActivitySchema,
  updateActivitySchema,
} from "../validation/crmSchemas.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import prisma from "../config/db.js";

/**
 * @swagger
 * tags:
 *   name: Activities
 *   description: CRM activity timeline endpoints
 */

const router = Router();

/**
 * @swagger
 * /api/activities:
 *   get:
 *     summary: List activities (filterable by type, contact, deal)
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Comma-separated activity types to filter
 *       - in: query
 *         name: contactId
 *         schema:
 *           type: string
 *         description: Filter by contact ID
 *       - in: query
 *         name: dealId
 *         schema:
 *           type: string
 *         description: Filter by deal ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number (default 1)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         description: Items per page (default 20, max 100)
 *     responses:
 *       200:
 *         description: Paginated list of activities
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { type, contactId, dealId } = req.query;
      const where: any = { userId: req.userId! };

      // Filter by activity types (comma-separated)
      if (type) {
        const types = (type as string).split(",").map((t) => t.trim());
        where.type = { in: types };
      }

      // Filter by contactId
      if (contactId) {
        where.contactId = contactId as string;
      }

      // Filter by dealId
      if (dealId) {
        where.dealId = dealId as string;
      }

      const pagination = getPagination(req) || {
        skip: 0,
        take: 20,
        page: 1,
        pageSize: 20,
      };

      const [activities, total] = await Promise.all([
        prisma.activity.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: pagination.skip,
          take: pagination.take,
        }),
        prisma.activity.count({ where }),
      ]);

      res.json(paginatedResponse(activities, total, pagination));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities." });
    }
  },
);

/**
 * @swagger
 * /api/activities:
 *   post:
 *     summary: Log a manual activity (note, call, email, meeting)
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [call, email, meeting, note, status_change, deal_stage_change, appointment, telegram_message, task_completed]
 *               description:
 *                 type: string
 *               contactId:
 *                 type: string
 *               dealId:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Activity created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  authMiddleware,
  validate(createActivitySchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { type, description, contactId, dealId, metadata } = req.body;

      // For type "note", reject empty/whitespace-only description
      if (type === "note") {
        if (!description || description.trim().length === 0) {
          res.status(400).json({ error: "Note description cannot be empty." });
          return;
        }
      }

      const activity = await prisma.activity.create({
        data: {
          userId: req.userId!,
          type,
          description: description || null,
          contactId: contactId || null,
          dealId: dealId || null,
          metadata: metadata || null,
          isSystem: false,
        },
      });

      res.status(201).json(activity);
    } catch (error) {
      res.status(500).json({ error: "Failed to create activity." });
    }
  },
);

/**
 * @swagger
 * /api/activities/{id}:
 *   put:
 *     summary: Edit a user-created activity (non-system only)
 *     tags: [Activities]
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
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Activity updated
 *       400:
 *         description: Validation error or empty description
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Cannot edit system-generated activity
 *       404:
 *         description: Activity not found
 */
router.put(
  "/:id",
  authMiddleware,
  validate(updateActivitySchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const activity = await prisma.activity.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });

      if (!activity) {
        res.status(404).json({ error: "Activity not found." });
        return;
      }

      // System activities are immutable
      if (activity.isSystem) {
        res
          .status(403)
          .json({ error: "Cannot edit system-generated activity." });
        return;
      }

      const { description } = req.body;

      // Reject empty/whitespace-only description
      if (description !== undefined && description !== null) {
        if (description.trim().length === 0) {
          res.status(400).json({ error: "Description cannot be empty." });
          return;
        }
      }

      const updated = await prisma.activity.update({
        where: { id: req.params.id },
        data: {
          description: description !== undefined ? description : undefined,
        },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update activity." });
    }
  },
);

/**
 * @swagger
 * /api/activities/{id}:
 *   delete:
 *     summary: Delete a user-created activity (non-system only)
 *     tags: [Activities]
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
 *         description: Activity deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Cannot delete system-generated activity
 *       404:
 *         description: Activity not found
 */
router.delete(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const activity = await prisma.activity.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });

      if (!activity) {
        res.status(404).json({ error: "Activity not found." });
        return;
      }

      // System activities are immutable
      if (activity.isSystem) {
        res
          .status(403)
          .json({ error: "Cannot delete system-generated activity." });
        return;
      }

      await prisma.activity.delete({
        where: { id: req.params.id },
      });

      res.json({ message: "Activity deleted." });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete activity." });
    }
  },
);

export default router;
