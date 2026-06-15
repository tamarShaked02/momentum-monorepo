import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
  toggleAutomationRuleSchema,
} from "../validation/crmSchemas.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import prisma from "../config/db.js";
import { crmEventBus } from "../services/eventBus.js";

/**
 * @swagger
 * tags:
 *   name: AutomationRules
 *   description: CRM automation rules management endpoints
 */

const router = Router();

/** Maximum number of automation rules per user */
const MAX_RULES_PER_USER = 50;

/** Default stale deal threshold in days */
const DEFAULT_STALE_THRESHOLD_DAYS = 14;

/**
 * @swagger
 * /api/automation-rules:
 *   get:
 *     summary: List user's automation rules
 *     tags: [AutomationRules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of automation rules
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const where = { userId: req.userId! };
      const pagination = getPagination(req) || {
        skip: 0,
        take: 50,
        page: 1,
        pageSize: 50,
      };

      const [rules, total] = await Promise.all([
        prisma.automationRule.findMany({
          where,
          orderBy: { position: "asc" },
          skip: pagination.skip,
          take: pagination.take,
        }),
        prisma.automationRule.count({ where }),
      ]);

      res.json(paginatedResponse(rules, total, pagination));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch automation rules." });
    }
  },
);

/**
 * @swagger
 * /api/automation-rules:
 *   post:
 *     summary: Create an automation rule
 *     tags: [AutomationRules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, trigger, actions]
 *             properties:
 *               name:
 *                 type: string
 *               trigger:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                   params:
 *                     type: object
 *               actions:
 *                 type: array
 *                 items:
 *                   type: object
 *               enabled:
 *                 type: boolean
 *               position:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Automation rule created
 *       400:
 *         description: Validation error or rule limit exceeded
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  authMiddleware,
  validate(createAutomationRuleSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Check rule limit per user
      const existingCount = await prisma.automationRule.count({
        where: { userId: req.userId! },
      });

      if (existingCount >= MAX_RULES_PER_USER) {
        res.status(400).json({
          error: `Maximum of ${MAX_RULES_PER_USER} automation rules per user exceeded.`,
        });
        return;
      }

      const { name, trigger, actions, enabled, position } = req.body;

      // Determine position: use provided or append to end
      let rulePosition = position;
      if (rulePosition === undefined) {
        const lastRule = await prisma.automationRule.findFirst({
          where: { userId: req.userId! },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        rulePosition = lastRule ? lastRule.position + 1 : 0;
      }

      const rule = await prisma.automationRule.create({
        data: {
          userId: req.userId!,
          name,
          trigger,
          actions,
          enabled: enabled !== undefined ? enabled : true,
          position: rulePosition,
        },
      });

      res.status(201).json(rule);
    } catch (error) {
      res.status(500).json({ error: "Failed to create automation rule." });
    }
  },
);

/**
 * @swagger
 * /api/automation-rules/{id}:
 *   put:
 *     summary: Update an automation rule
 *     tags: [AutomationRules]
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
 *     responses:
 *       200:
 *         description: Updated automation rule
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Rule not found
 */
router.put(
  "/:id",
  authMiddleware,
  validate(updateAutomationRuleSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const existing = await prisma.automationRule.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });

      if (!existing) {
        res.status(404).json({ error: "Automation rule not found." });
        return;
      }

      const { name, trigger, actions, enabled, position } = req.body;
      const data: any = {};

      if (name !== undefined) data.name = name;
      if (trigger !== undefined) data.trigger = trigger;
      if (actions !== undefined) data.actions = actions;
      if (enabled !== undefined) data.enabled = enabled;
      if (position !== undefined) data.position = position;

      const updated = await prisma.automationRule.update({
        where: { id: req.params.id },
        data,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update automation rule." });
    }
  },
);

/**
 * @swagger
 * /api/automation-rules/{id}/toggle:
 *   patch:
 *     summary: Enable or disable an automation rule
 *     tags: [AutomationRules]
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
 *             required: [enabled]
 *             properties:
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Rule toggled
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Rule not found
 */
router.patch(
  "/:id/toggle",
  authMiddleware,
  validate(toggleAutomationRuleSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const existing = await prisma.automationRule.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });

      if (!existing) {
        res.status(404).json({ error: "Automation rule not found." });
        return;
      }

      const { enabled } = req.body;

      const updated = await prisma.automationRule.update({
        where: { id: req.params.id },
        data: { enabled },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle automation rule." });
    }
  },
);

/**
 * @swagger
 * /api/automation-rules/{id}:
 *   delete:
 *     summary: Delete an automation rule
 *     tags: [AutomationRules]
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
 *         description: Rule deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Rule not found
 */
router.delete(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await prisma.automationRule.deleteMany({
        where: { id: req.params.id, userId: req.userId! },
      });

      if (result.count === 0) {
        res.status(404).json({ error: "Automation rule not found." });
        return;
      }

      res.json({ message: "Automation rule deleted." });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete automation rule." });
    }
  },
);

/**
 * @swagger
 * /api/automation-rules/{id}/logs:
 *   get:
 *     summary: Get execution logs for an automation rule
 *     tags: [AutomationRules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated execution logs in reverse chronological order
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Rule not found
 */
router.get(
  "/:id/logs",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Verify the rule belongs to the user
      const rule = await prisma.automationRule.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });

      if (!rule) {
        res.status(404).json({ error: "Automation rule not found." });
        return;
      }

      const pagination = getPagination(req) || {
        skip: 0,
        take: 20,
        page: 1,
        pageSize: 20,
      };

      const where = { ruleId: req.params.id };

      const [logs, total] = await Promise.all([
        prisma.automationRuleLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: pagination.skip,
          take: pagination.take,
        }),
        prisma.automationRuleLog.count({ where }),
      ]);

      res.json(paginatedResponse(logs, total, pagination));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch automation rule logs." });
    }
  },
);

/**
 * @swagger
 * /api/automation-rules/check-stale-deals:
 *   post:
 *     summary: Check for stale deals and emit deal_stale events
 *     tags: [AutomationRules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               thresholdDays:
 *                 type: integer
 *                 description: Number of days of inactivity to consider a deal stale (default 14)
 *     responses:
 *       200:
 *         description: Stale deals detected and events emitted
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/check-stale-deals",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const thresholdDays =
        req.body.thresholdDays && Number.isInteger(req.body.thresholdDays)
          ? Math.min(365, Math.max(1, req.body.thresholdDays))
          : DEFAULT_STALE_THRESHOLD_DAYS;

      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);

      // Find open deals belonging to the user that have no activity or stage change
      // since the threshold date
      const staleDeals = await prisma.deal.findMany({
        where: {
          userId: req.userId!,
          status: "open",
          // Deal hasn't been updated (stage change updates updatedAt) since threshold
          updatedAt: { lt: thresholdDate },
          // No activities since the threshold
          activities: {
            none: {
              createdAt: { gte: thresholdDate },
            },
          },
        },
        include: {
          stage: true,
          pipeline: true,
          contact: true,
        },
      });

      // Emit deal_stale event for each stale deal
      for (const deal of staleDeals) {
        crmEventBus.emitDealStale(req.userId!, {
          id: deal.id,
          userId: deal.userId,
          title: deal.title,
          value: deal.value,
          expectedCloseDate: deal.expectedCloseDate,
          winProbability: deal.winProbability,
          pipelineId: deal.pipelineId,
          stageId: deal.stageId,
          contactId: deal.contactId,
          status: deal.status as any,
          closedAt: deal.closedAt,
          createdAt: deal.createdAt,
          updatedAt: deal.updatedAt,
        });
      }

      res.json({
        message: `Stale deal check completed.`,
        staleDealsCount: staleDeals.length,
        thresholdDays,
        staleDeals: staleDeals.map((d) => ({
          id: d.id,
          title: d.title,
          lastUpdated: d.updatedAt,
          stage: d.stage?.name,
          pipeline: d.pipeline?.name,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check for stale deals." });
    }
  },
);

export default router;
