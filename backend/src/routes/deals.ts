import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createDealSchema,
  updateDealSchema,
  updateDealStageSchema,
  createDealItemSchema,
  updateDealItemSchema,
} from "../validation/crmSchemas.js";
import prisma from "../config/db.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { crmEventBus } from "../services/eventBus.js";

const router = Router();

/**
 * GET /api/deals
 * List deals with optional filters: pipelineId, stageId, contactId, minValue, maxValue.
 * Supports pagination.
 */
router.get(
  "/",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { pipelineId, stageId, contactId, minValue, maxValue } = req.query;

      const where: Record<string, unknown> = { userId: req.userId! };

      if (pipelineId) {
        where.pipelineId = pipelineId as string;
      }
      if (stageId) {
        where.stageId = stageId as string;
      }
      if (contactId) {
        where.contactId = contactId as string;
      }
      if (minValue || maxValue) {
        const valueFilter: Record<string, number> = {};
        if (minValue) {
          valueFilter.gte = parseFloat(minValue as string);
        }
        if (maxValue) {
          valueFilter.lte = parseFloat(maxValue as string);
        }
        where.value = valueFilter;
      }

      const pagination = getPagination(req);

      if (pagination) {
        const [deals, total] = await Promise.all([
          prisma.deal.findMany({
            where,
            include: {
              stage: true,
              pipeline: true,
              contact: true,
            },
            orderBy: { createdAt: "desc" },
            skip: pagination.skip,
            take: pagination.take,
          }),
          prisma.deal.count({ where }),
        ]);

        res.json(paginatedResponse(deals, total, pagination));
      } else {
        const deals = await prisma.deal.findMany({
          where,
          include: {
            stage: true,
            pipeline: true,
            contact: true,
          },
          orderBy: { createdAt: "desc" },
        });

        res.json(deals);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deals." });
    }
  },
);

/**
 * GET /api/deals/:id
 * Get deal detail with activities and linked tasks.
 */
router.get(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const deal = await prisma.deal.findFirst({
        where: { id: req.params.id, userId: req.userId! },
        include: {
          stage: true,
          pipeline: { include: { stages: { orderBy: { position: "asc" } } } },
          contact: true,
          items: { include: { inventoryItem: true } },
          activities: { orderBy: { createdAt: "desc" }, take: 20 },
          linkedTasks: { orderBy: { dueDate: "asc" } },
        },
      });

      if (!deal) {
        res.status(404).json({ error: "Deal not found." });
        return;
      }

      res.json(deal);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deal." });
    }
  },
);

/**
 * POST /api/deals
 * Create a new deal. Emits deal_created event.
 */
router.post(
  "/",
  authMiddleware,
  validate(createDealSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        title,
        contactId,
        pipelineId,
        stageId,
        value,
        expectedCloseDate,
        winProbability,
      } = req.body;

      // Verify contact belongs to user
      const contact = await prisma.customer.findFirst({
        where: { id: contactId, userId: req.userId! },
      });
      if (!contact) {
        res.status(400).json({ error: "Contact not found." });
        return;
      }

      // Verify pipeline belongs to user
      const pipeline = await prisma.pipeline.findFirst({
        where: { id: pipelineId, userId: req.userId! },
      });
      if (!pipeline) {
        res.status(400).json({ error: "Pipeline not found." });
        return;
      }

      // Verify stage belongs to the pipeline
      const stage = await prisma.stage.findFirst({
        where: { id: stageId, pipelineId },
      });
      if (!stage) {
        res
          .status(400)
          .json({ error: "Stage not found in the specified pipeline." });
        return;
      }

      const deal = await prisma.deal.create({
        data: {
          userId: req.userId!,
          title,
          contactId,
          pipelineId,
          stageId,
          value: value ?? null,
          expectedCloseDate: expectedCloseDate
            ? new Date(expectedCloseDate)
            : null,
          winProbability: winProbability ?? null,
        },
        include: {
          stage: true,
          pipeline: true,
          contact: true,
        },
      });

      // Emit deal_created event
      crmEventBus.emitDealCreated(req.userId!, deal as any);

      res.status(201).json(deal);
    } catch (error) {
      res.status(500).json({ error: "Failed to create deal." });
    }
  },
);

/**
 * PUT /api/deals/:id
 * Update deal fields.
 */
router.put(
  "/:id",
  authMiddleware,
  validate(updateDealSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const deal = await prisma.deal.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!deal) {
        res.status(404).json({ error: "Deal not found." });
        return;
      }

      const {
        title,
        contactId,
        pipelineId,
        stageId,
        value,
        expectedCloseDate,
        winProbability,
        status,
      } = req.body;

      // Verify contact if changing
      if (contactId) {
        const contact = await prisma.customer.findFirst({
          where: { id: contactId, userId: req.userId! },
        });
        if (!contact) {
          res.status(400).json({ error: "Contact not found." });
          return;
        }
      }

      // Verify pipeline if changing
      if (pipelineId) {
        const pipeline = await prisma.pipeline.findFirst({
          where: { id: pipelineId, userId: req.userId! },
        });
        if (!pipeline) {
          res.status(400).json({ error: "Pipeline not found." });
          return;
        }
      }

      // Verify stage if changing
      if (stageId) {
        const targetPipelineId = pipelineId || deal.pipelineId;
        const stage = await prisma.stage.findFirst({
          where: { id: stageId, pipelineId: targetPipelineId },
        });
        if (!stage) {
          res
            .status(400)
            .json({ error: "Stage not found in the specified pipeline." });
          return;
        }
      }

      const updateData: Record<string, unknown> = {};
      if (title !== undefined) updateData.title = title;
      if (contactId !== undefined) updateData.contactId = contactId;
      if (pipelineId !== undefined) updateData.pipelineId = pipelineId;
      if (stageId !== undefined) updateData.stageId = stageId;
      if (value !== undefined) updateData.value = value;
      if (expectedCloseDate !== undefined) {
        updateData.expectedCloseDate = expectedCloseDate
          ? new Date(expectedCloseDate)
          : null;
      }
      if (winProbability !== undefined)
        updateData.winProbability = winProbability;
      if (status !== undefined) updateData.status = status;

      const updated = await prisma.deal.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          stage: true,
          pipeline: true,
          contact: true,
        },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deal." });
    }
  },
);

/**
 * PATCH /api/deals/:id/stage
 * Move deal to a new stage (Kanban drag).
 * - Logs deal_stage_change activity with fromStage/toStage metadata.
 * - Emits deal_stage_changed event.
 * - Handles terminal stages: "won" → set status "won", closedAt, update contact lifecycle to "customer".
 *   "lost" → set status "lost", closedAt, do NOT change contact lifecycle.
 */
router.patch(
  "/:id/stage",
  authMiddleware,
  validate(updateDealStageSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const deal = await prisma.deal.findFirst({
        where: { id: req.params.id, userId: req.userId! },
        include: { stage: true },
      });
      if (!deal) {
        res.status(404).json({ error: "Deal not found." });
        return;
      }

      const { stageId } = req.body;

      // Verify target stage belongs to the deal's pipeline
      const toStage = await prisma.stage.findFirst({
        where: { id: stageId, pipelineId: deal.pipelineId },
      });
      if (!toStage) {
        res
          .status(400)
          .json({ error: "Stage not found in the deal's pipeline." });
        return;
      }

      // No-op if already in the same stage
      if (deal.stageId === stageId) {
        const dealWithIncludes = await prisma.deal.findFirst({
          where: { id: deal.id },
          include: { stage: true, pipeline: true, contact: true },
        });
        res.json(dealWithIncludes);
        return;
      }

      const fromStage = deal.stage;

      // Build update data
      const dealUpdateData: Record<string, unknown> = { stageId };

      // Handle terminal stages
      if (toStage.isTerminal && toStage.dealStatus === "won") {
        dealUpdateData.status = "won";
        dealUpdateData.closedAt = new Date();
      } else if (toStage.isTerminal && toStage.dealStatus === "lost") {
        dealUpdateData.status = "lost";
        dealUpdateData.closedAt = new Date();
      }

      // Update the deal stage
      const updatedDeal = await prisma.deal.update({
        where: { id: deal.id },
        data: dealUpdateData,
        include: { stage: true, pipeline: true, contact: true },
      });

      // Log deal_stage_change activity
      await prisma.activity.create({
        data: {
          userId: req.userId!,
          type: "deal_stage_change",
          description: `Deal moved from "${fromStage.name}" to "${toStage.name}"`,
          metadata: {
            fromStageId: fromStage.id,
            fromStageName: fromStage.name,
            toStageId: toStage.id,
            toStageName: toStage.name,
          },
          dealId: deal.id,
          contactId: deal.contactId,
          isSystem: true,
        },
      });

      // If closed won, update contact lifecycle to "customer"
      if (toStage.isTerminal && toStage.dealStatus === "won") {
        await prisma.customer.update({
          where: { id: deal.contactId },
          data: { lifecycleStage: "customer" },
        });
      }
      // If closed lost, do NOT change contact lifecycle

      // Emit deal_stage_changed event
      crmEventBus.emitDealStageChanged(
        req.userId!,
        updatedDeal as any,
        fromStage as any,
        toStage as any,
      );

      res.json(updatedDeal);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deal stage." });
    }
  },
);

/**
 * DELETE /api/deals/:id
 * Delete a deal.
 */
router.delete(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const deal = await prisma.deal.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!deal) {
        res.status(404).json({ error: "Deal not found." });
        return;
      }

      await prisma.deal.delete({ where: { id: req.params.id } });
      res.json({ message: "Deal deleted." });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete deal." });
    }
  },
);

// --- Deal Items ---

/**
 * Helper: Recalculate deal value from linked items.
 * Sets deal value to sum(qty × unitPrice) of all linked items.
 */
async function recalculateDealValue(dealId: string): Promise<void> {
  const items = await prisma.dealItem.findMany({ where: { dealId } });
  const totalValue = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  await prisma.deal.update({
    where: { id: dealId },
    data: { value: totalValue > 0 ? totalValue : null },
  });
}

/**
 * POST /api/deals/:id/items
 * Link an inventory item to a deal. Recalculates deal value.
 */
router.post(
  "/:id/items",
  authMiddleware,
  validate(createDealItemSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const deal = await prisma.deal.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!deal) {
        res.status(404).json({ error: "Deal not found." });
        return;
      }

      const { inventoryItemId, quantity, unitPrice } = req.body;

      // Verify inventory item belongs to user
      const inventoryItem = await prisma.inventoryItem.findFirst({
        where: { id: inventoryItemId, userId: req.userId! },
      });
      if (!inventoryItem) {
        res.status(400).json({ error: "Inventory item not found." });
        return;
      }

      // Check for existing link (unique constraint)
      const existing = await prisma.dealItem.findUnique({
        where: {
          dealId_inventoryItemId: {
            dealId: req.params.id,
            inventoryItemId,
          },
        },
      });
      if (existing) {
        res.status(400).json({ error: "Item is already linked to this deal." });
        return;
      }

      const dealItem = await prisma.dealItem.create({
        data: {
          dealId: req.params.id,
          inventoryItemId,
          quantity,
          unitPrice,
        },
        include: { inventoryItem: true },
      });

      // Recalculate deal value
      await recalculateDealValue(req.params.id);

      res.status(201).json(dealItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to link item to deal." });
    }
  },
);

/**
 * PUT /api/deals/:id/items/:itemId
 * Update linked item quantity/price. Recalculates deal value.
 */
router.put(
  "/:id/items/:itemId",
  authMiddleware,
  validate(updateDealItemSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Verify deal belongs to user
      const deal = await prisma.deal.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!deal) {
        res.status(404).json({ error: "Deal not found." });
        return;
      }

      // Verify deal item belongs to this deal
      const dealItem = await prisma.dealItem.findFirst({
        where: { id: req.params.itemId, dealId: req.params.id },
      });
      if (!dealItem) {
        res.status(404).json({ error: "Deal item not found." });
        return;
      }

      const { quantity, unitPrice } = req.body;

      const updateData: Record<string, unknown> = {};
      if (quantity !== undefined) updateData.quantity = quantity;
      if (unitPrice !== undefined) updateData.unitPrice = unitPrice;

      const updated = await prisma.dealItem.update({
        where: { id: req.params.itemId },
        data: updateData,
        include: { inventoryItem: true },
      });

      // Recalculate deal value
      await recalculateDealValue(req.params.id);

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deal item." });
    }
  },
);

/**
 * DELETE /api/deals/:id/items/:itemId
 * Unlink an inventory item from a deal. Recalculates deal value.
 */
router.delete(
  "/:id/items/:itemId",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Verify deal belongs to user
      const deal = await prisma.deal.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!deal) {
        res.status(404).json({ error: "Deal not found." });
        return;
      }

      // Verify deal item belongs to this deal
      const dealItem = await prisma.dealItem.findFirst({
        where: { id: req.params.itemId, dealId: req.params.id },
      });
      if (!dealItem) {
        res.status(404).json({ error: "Deal item not found." });
        return;
      }

      await prisma.dealItem.delete({ where: { id: req.params.itemId } });

      // Recalculate deal value
      await recalculateDealValue(req.params.id);

      res.json({ message: "Item unlinked from deal." });
    } catch (error) {
      res.status(500).json({ error: "Failed to unlink item from deal." });
    }
  },
);

export default router;
