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

export default router;
