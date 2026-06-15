import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createPipelineSchema,
  updatePipelineSchema,
  createStageSchema,
  updateStageSchema,
} from "../validation/crmSchemas.js";
import prisma from "../config/db.js";

const router = Router();

// --- Default Pipeline Stages ---
const DEFAULT_STAGES = [
  { name: "Lead", position: 0, isTerminal: false, dealStatus: null },
  { name: "Qualified", position: 1, isTerminal: false, dealStatus: null },
  { name: "Proposal", position: 2, isTerminal: false, dealStatus: null },
  { name: "Negotiation", position: 3, isTerminal: false, dealStatus: null },
  { name: "Closed Won", position: 4, isTerminal: true, dealStatus: "won" },
  { name: "Closed Lost", position: 5, isTerminal: true, dealStatus: "lost" },
];

/**
 * GET /api/pipelines
 * List user's pipelines with stages. Creates a default pipeline on first access.
 */
router.get(
  "/",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      let pipelines = await prisma.pipeline.findMany({
        where: { userId: req.userId! },
        include: { stages: { orderBy: { position: "asc" } } },
        orderBy: { createdAt: "asc" },
      });

      // Create default pipeline if user has none
      if (pipelines.length === 0) {
        const defaultPipeline = await prisma.pipeline.create({
          data: {
            userId: req.userId!,
            name: "Sales Pipeline",
            isDefault: true,
            stages: {
              create: DEFAULT_STAGES,
            },
          },
          include: { stages: { orderBy: { position: "asc" } } },
        });
        pipelines = [defaultPipeline];
      }

      res.json(pipelines);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pipelines." });
    }
  },
);

/**
 * POST /api/pipelines
 * Create a new pipeline with stages.
 */
router.post(
  "/",
  authMiddleware,
  validate(createPipelineSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, stages } = req.body;

      const pipeline = await prisma.pipeline.create({
        data: {
          userId: req.userId!,
          name,
          stages: {
            create: stages.map(
              (
                stage: {
                  name: string;
                  isTerminal?: boolean;
                  dealStatus?: string | null;
                },
                index: number,
              ) => ({
                name: stage.name,
                position: index,
                isTerminal: stage.isTerminal || false,
                dealStatus: stage.dealStatus || null,
              }),
            ),
          },
        },
        include: { stages: { orderBy: { position: "asc" } } },
      });

      res.status(201).json(pipeline);
    } catch (error) {
      res.status(500).json({ error: "Failed to create pipeline." });
    }
  },
);

/**
 * PUT /api/pipelines/:id
 * Update pipeline name.
 */
router.put(
  "/:id",
  authMiddleware,
  validate(updatePipelineSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const pipeline = await prisma.pipeline.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!pipeline) {
        res.status(404).json({ error: "Pipeline not found." });
        return;
      }

      const updated = await prisma.pipeline.update({
        where: { id: req.params.id },
        data: { name: req.body.name },
        include: { stages: { orderBy: { position: "asc" } } },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update pipeline." });
    }
  },
);

/**
 * DELETE /api/pipelines/:id
 * Delete pipeline (only if no deals exist in it).
 */
router.delete(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const pipeline = await prisma.pipeline.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!pipeline) {
        res.status(404).json({ error: "Pipeline not found." });
        return;
      }

      const dealCount = await prisma.deal.count({
        where: { pipelineId: req.params.id },
      });
      if (dealCount > 0) {
        res.status(400).json({
          error:
            "Cannot delete pipeline that has deals. Remove or move all deals first.",
        });
        return;
      }

      await prisma.pipeline.delete({ where: { id: req.params.id } });
      res.json({ message: "Pipeline deleted." });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete pipeline." });
    }
  },
);

/**
 * POST /api/pipelines/:id/stages
 * Add a stage to a pipeline.
 */
router.post(
  "/:id/stages",
  authMiddleware,
  validate(createStageSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const pipeline = await prisma.pipeline.findFirst({
        where: { id: req.params.id, userId: req.userId! },
        include: { stages: true },
      });
      if (!pipeline) {
        res.status(404).json({ error: "Pipeline not found." });
        return;
      }

      // Check stage count limit (max 20)
      if (pipeline.stages.length >= 20) {
        res
          .status(400)
          .json({ error: "Pipeline cannot have more than 20 stages." });
        return;
      }

      const { name, position, isTerminal, dealStatus } = req.body;

      // Shift existing stages at or after the requested position
      await prisma.stage.updateMany({
        where: {
          pipelineId: req.params.id,
          position: { gte: position },
        },
        data: { position: { increment: 1 } },
      });

      const stage = await prisma.stage.create({
        data: {
          pipelineId: req.params.id,
          name,
          position,
          isTerminal: isTerminal || false,
          dealStatus: dealStatus || null,
        },
      });

      res.status(201).json(stage);
    } catch (error) {
      res.status(500).json({ error: "Failed to add stage." });
    }
  },
);

/**
 * PUT /api/pipelines/:id/stages/:stageId
 * Rename and/or reorder a stage.
 */
router.put(
  "/:id/stages/:stageId",
  authMiddleware,
  validate(updateStageSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Verify pipeline ownership
      const pipeline = await prisma.pipeline.findFirst({
        where: { id: req.params.id, userId: req.userId! },
        include: { stages: { orderBy: { position: "asc" } } },
      });
      if (!pipeline) {
        res.status(404).json({ error: "Pipeline not found." });
        return;
      }

      const stage = pipeline.stages.find((s) => s.id === req.params.stageId);
      if (!stage) {
        res.status(404).json({ error: "Stage not found." });
        return;
      }

      const { name, position, isTerminal, dealStatus } = req.body;

      // If position is changing, reorder stages
      if (position !== undefined && position !== stage.position) {
        const oldPos = stage.position;
        const newPos = position;

        if (newPos > oldPos) {
          // Moving down: shift stages in (oldPos, newPos] up by -1
          await prisma.stage.updateMany({
            where: {
              pipelineId: req.params.id,
              position: { gt: oldPos, lte: newPos },
              id: { not: req.params.stageId },
            },
            data: { position: { decrement: 1 } },
          });
        } else {
          // Moving up: shift stages in [newPos, oldPos) down by +1
          await prisma.stage.updateMany({
            where: {
              pipelineId: req.params.id,
              position: { gte: newPos, lt: oldPos },
              id: { not: req.params.stageId },
            },
            data: { position: { increment: 1 } },
          });
        }
      }

      const updated = await prisma.stage.update({
        where: { id: req.params.stageId },
        data: {
          ...(name !== undefined && { name }),
          ...(position !== undefined && { position }),
          ...(isTerminal !== undefined && { isTerminal }),
          ...(dealStatus !== undefined && { dealStatus }),
        },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update stage." });
    }
  },
);

/**
 * DELETE /api/pipelines/:id/stages/:stageId
 * Delete a stage (cannot delete if stage has deals).
 */
router.delete(
  "/:id/stages/:stageId",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Verify pipeline ownership
      const pipeline = await prisma.pipeline.findFirst({
        where: { id: req.params.id, userId: req.userId! },
        include: { stages: true },
      });
      if (!pipeline) {
        res.status(404).json({ error: "Pipeline not found." });
        return;
      }

      const stage = pipeline.stages.find((s) => s.id === req.params.stageId);
      if (!stage) {
        res.status(404).json({ error: "Stage not found." });
        return;
      }

      // Check minimum stage count (must keep at least 2)
      if (pipeline.stages.length <= 2) {
        res
          .status(400)
          .json({ error: "Pipeline must have at least 2 stages." });
        return;
      }

      // Guard: cannot delete stage with deals
      const dealCount = await prisma.deal.count({
        where: { stageId: req.params.stageId },
      });
      if (dealCount > 0) {
        res.status(400).json({
          error:
            "Cannot delete stage that has deals. Reassign deals to another stage first.",
        });
        return;
      }

      const deletedPosition = stage.position;

      await prisma.stage.delete({ where: { id: req.params.stageId } });

      // Shift positions of stages after the deleted one
      await prisma.stage.updateMany({
        where: {
          pipelineId: req.params.id,
          position: { gt: deletedPosition },
        },
        data: { position: { decrement: 1 } },
      });

      res.json({ message: "Stage deleted." });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete stage." });
    }
  },
);

export default router;
