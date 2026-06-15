import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import prisma from "../config/db.js";
import { generateMarketingContent } from "../services/aiService.js";

/**
 * @swagger
 * tags:
 *   name: Marketing
 *   description: Marketing campaign and AI content generation endpoints
 */

const router = Router();

/**
 * @swagger
 * /api/marketing/automations:
 *   get:
 *     summary: List all marketing campaigns
 *     tags: [Marketing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of campaigns
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MarketingCampaign'
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/automations",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const where = { userId: req.userId! };
      const pagination = getPagination(req);

      if (pagination) {
        const [campaigns, total] = await Promise.all([
          prisma.marketingCampaign.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: pagination.skip,
            take: pagination.take,
          }),
          prisma.marketingCampaign.count({ where }),
        ]);
        res.json(paginatedResponse(campaigns, total, pagination));
      } else {
        const campaigns = await prisma.marketingCampaign.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });
        res.json(campaigns);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaigns." });
    }
  },
);

/**
 * @swagger
 * /api/marketing/automations:
 *   post:
 *     summary: Create a new marketing campaign
 *     tags: [Marketing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MarketingCampaignBody'
 *     responses:
 *       201:
 *         description: Campaign created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MarketingCampaign'
 *       400:
 *         description: Campaign name is required
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/automations",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        name,
        goal,
        channels,
        smsContent,
        emailContent,
        socialContent,
        scheduledAt,
        audienceTags,
        audienceLifecycleStages,
      } = req.body;
      if (!name) {
        res.status(400).json({ error: "Campaign name is required." });
        return;
      }
      const campaign = await prisma.marketingCampaign.create({
        data: {
          userId: req.userId!,
          name,
          goal: goal || null,
          channels: channels || [],
          smsContent: smsContent || null,
          emailContent: emailContent || null,
          socialContent: socialContent || null,
          audienceTags: audienceTags || [],
          audienceLifecycleStages: audienceLifecycleStages || [],
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        },
      });
      res.status(201).json(campaign);
    } catch (error) {
      res.status(500).json({ error: "Failed to create campaign." });
    }
  },
);

/**
 * @swagger
 * /api/marketing/automations/{id}:
 *   put:
 *     summary: Update a marketing campaign
 *     tags: [Marketing]
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
 *             $ref: '#/components/schemas/MarketingCampaignBody'
 *     responses:
 *       200:
 *         description: Updated campaign
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MarketingCampaign'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.put(
  "/automations/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        name,
        goal,
        status,
        channels,
        smsContent,
        emailContent,
        socialContent,
        scheduledAt,
        audienceTags,
        audienceLifecycleStages,
      } = req.body;
      const result = await prisma.marketingCampaign.updateMany({
        where: { id: req.params.id, userId: req.userId! },
        data: {
          ...(name !== undefined && { name }),
          ...(goal !== undefined && { goal }),
          ...(status !== undefined && { status }),
          ...(channels !== undefined && { channels }),
          ...(smsContent !== undefined && { smsContent }),
          ...(emailContent !== undefined && { emailContent }),
          ...(socialContent !== undefined && { socialContent }),
          ...(scheduledAt !== undefined && {
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          }),
          ...(audienceTags !== undefined && { audienceTags }),
          ...(audienceLifecycleStages !== undefined && {
            audienceLifecycleStages,
          }),
        },
      });
      if (result.count === 0) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      const updated = await prisma.marketingCampaign.findUnique({
        where: { id: req.params.id },
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update campaign." });
    }
  },
);

/**
 * @swagger
 * /api/marketing/automations/{id}:
 *   delete:
 *     summary: Delete a marketing campaign
 *     tags: [Marketing]
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
 *         description: Campaign deleted
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
  "/automations/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await prisma.marketingCampaign.deleteMany({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (result.count === 0) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      res.json({ message: "Campaign deleted." });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete campaign." });
    }
  },
);

/**
 * @swagger
 * /api/marketing/generate:
 *   post:
 *     summary: Generate AI marketing content from a brief
 *     tags: [Marketing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [brief]
 *             properties:
 *               brief:
 *                 type: string
 *                 example: Summer sale for our clothing line targeting young adults
 *               channels:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [sms, email]
 *     responses:
 *       200:
 *         description: Generated content for each channel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Campaign brief is required
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/generate",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { brief, channels } = req.body;
      if (!brief) {
        res.status(400).json({ error: "Campaign brief is required." });
        return;
      }
      const content = await generateMarketingContent(brief);
      res.json(content);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate content." });
    }
  },
);

/**
 * @swagger
 * /api/marketing/trigger/{event}:
 *   post:
 *     summary: Trigger an event-based marketing automation (placeholder)
 *     tags: [Marketing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: event
 *         required: true
 *         schema:
 *           type: string
 *         example: new_customer
 *     responses:
 *       200:
 *         description: Trigger acknowledged
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/trigger/:event",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { event } = req.params;
    res.json({
      message: `Trigger received for event: ${event}. Automation triggers are a placeholder for future implementation.`,
      event,
    });
  },
);

/**
 * Build a Prisma where clause for segment queries.
 * Logic: AND between filter types (tags AND lifecycleStages), OR within each type.
 */
function buildSegmentWhere(
  userId: string,
  tags?: string[],
  lifecycleStages?: string[],
): any {
  const where: any = { userId };
  const andConditions: any[] = [];

  // OR within tags: contact must have at least one of the specified tags
  if (tags && tags.length > 0) {
    andConditions.push({
      tags: {
        some: {
          tag: {
            name: { in: tags, mode: "insensitive" },
            userId,
          },
        },
      },
    });
  }

  // OR within lifecycle stages: contact must be one of the specified stages
  if (lifecycleStages && lifecycleStages.length > 0) {
    andConditions.push({
      lifecycleStage: { in: lifecycleStages.map((s) => s.toLowerCase()) },
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  return where;
}

/**
 * @swagger
 * /api/marketing/segments/query:
 *   post:
 *     summary: Query contacts matching segment filters (tags + lifecycle stages)
 *     tags: [Marketing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Tag names (OR within - contact must have at least one)
 *               lifecycleStages:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Lifecycle stages (OR within - contact must be one of these)
 *     responses:
 *       200:
 *         description: Matching contacts with count
 *       400:
 *         description: At least one filter criteria is required
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/segments/query",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { tags, lifecycleStages } = req.body;

      // Must provide at least one filter
      const hasTags = Array.isArray(tags) && tags.length > 0;
      const hasLifecycle =
        Array.isArray(lifecycleStages) && lifecycleStages.length > 0;

      if (!hasTags && !hasLifecycle) {
        res
          .status(400)
          .json({ error: "At least one filter criteria is required." });
        return;
      }

      const where = buildSegmentWhere(
        req.userId!,
        hasTags ? tags : undefined,
        hasLifecycle ? lifecycleStages : undefined,
      );

      const [contacts, count] = await Promise.all([
        prisma.customer.findMany({
          where,
          include: {
            tags: { include: { tag: true } },
          },
          orderBy: { name: "asc" },
        }),
        prisma.customer.count({ where }),
      ]);

      res.json({ contacts, count });
    } catch (error) {
      res.status(500).json({ error: "Failed to query segment." });
    }
  },
);

/**
 * @swagger
 * /api/marketing/segments/count:
 *   get:
 *     summary: Get count of contacts matching segment filters
 *     tags: [Marketing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated tag names
 *       - in: query
 *         name: lifecycleStages
 *         schema:
 *           type: string
 *         description: Comma-separated lifecycle stages
 *     responses:
 *       200:
 *         description: Count of matching contacts
 *       400:
 *         description: At least one filter criteria is required
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/segments/count",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { tags, lifecycleStages } = req.query;

      const tagList = tags
        ? (tags as string)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      const lifecycleList = lifecycleStages
        ? (lifecycleStages as string)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      if (tagList.length === 0 && lifecycleList.length === 0) {
        res
          .status(400)
          .json({ error: "At least one filter criteria is required." });
        return;
      }

      const where = buildSegmentWhere(
        req.userId!,
        tagList.length > 0 ? tagList : undefined,
        lifecycleList.length > 0 ? lifecycleList : undefined,
      );

      const count = await prisma.customer.count({ where });

      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "Failed to count segment." });
    }
  },
);

/**
 * @swagger
 * /api/marketing/automations/{id}:
 *   put:
 *     summary: Update a marketing campaign (with audience targeting)
 *     description: Also accepts audienceTags and audienceLifecycleStages for audience targeting
 *     tags: [Marketing]
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
 *               audienceTags:
 *                 type: array
 *                 items:
 *                   type: string
 *               audienceLifecycleStages:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Campaign updated with audience
 *       400:
 *         description: Audience must match at least one contact
 *       404:
 *         description: Not found
 */
router.put(
  "/automations/:id/audience",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { audienceTags, audienceLifecycleStages } = req.body;

      // Validate that at least one filter is provided
      const hasTags = Array.isArray(audienceTags) && audienceTags.length > 0;
      const hasLifecycle =
        Array.isArray(audienceLifecycleStages) &&
        audienceLifecycleStages.length > 0;

      if (!hasTags && !hasLifecycle) {
        res
          .status(400)
          .json({ error: "At least one audience filter is required." });
        return;
      }

      // Check that the campaign exists and belongs to the user
      const campaign = await prisma.marketingCampaign.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });

      if (!campaign) {
        res.status(404).json({ error: "Not found." });
        return;
      }

      // Verify that the audience has at least one matching contact (Req 9.4)
      const where = buildSegmentWhere(
        req.userId!,
        hasTags ? audienceTags : undefined,
        hasLifecycle ? audienceLifecycleStages : undefined,
      );

      const count = await prisma.customer.count({ where });

      if (count === 0) {
        res.status(400).json({
          error:
            "No contacts match the selected targeting criteria. At least one contact must match.",
          count: 0,
        });
        return;
      }

      // Update campaign audience
      const updated = await prisma.marketingCampaign.update({
        where: { id: req.params.id },
        data: {
          audienceTags: hasTags ? audienceTags : [],
          audienceLifecycleStages: hasLifecycle ? audienceLifecycleStages : [],
        },
      });

      res.json({ ...updated, audienceCount: count });
    } catch (error) {
      res.status(500).json({ error: "Failed to update campaign audience." });
    }
  },
);

export default router;
