import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import prisma from "../config/db.js";
import {
  generateCRMSuggestion,
  generateConversationSummary,
} from "../services/aiService.js";

/**
 * @swagger
 * tags:
 *   name: CRM AI Suggestions
 *   description: AI-powered CRM next-step suggestions and conversation summaries
 */

const router = Router();

/**
 * @swagger
 * /api/crm/suggestions/contact/{contactId}:
 *   get:
 *     summary: Get AI suggestion for a contact
 *     tags: [CRM AI Suggestions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: AI suggestion result
 *       404:
 *         description: Contact not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/suggestions/contact/:contactId",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { contactId } = req.params;

      // Verify the contact belongs to the user
      const contact = await prisma.customer.findFirst({
        where: { id: contactId, userId: req.userId! },
      });

      if (!contact) {
        res.status(404).json({ error: "Contact not found." });
        return;
      }

      const result = await generateCRMSuggestion(
        req.userId!,
        contactId,
        undefined,
      );
      res.json(result);
    } catch (error) {
      console.error("CRM suggestion error:", error);
      res.status(500).json({ error: "Failed to generate suggestion." });
    }
  },
);

/**
 * @swagger
 * /api/crm/suggestions/deal/{dealId}:
 *   get:
 *     summary: Get AI suggestion for a deal
 *     tags: [CRM AI Suggestions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dealId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: AI suggestion result
 *       404:
 *         description: Deal not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/suggestions/deal/:dealId",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { dealId } = req.params;

      // Verify the deal belongs to the user
      const deal = await prisma.deal.findFirst({
        where: { id: dealId, userId: req.userId! },
      });

      if (!deal) {
        res.status(404).json({ error: "Deal not found." });
        return;
      }

      const result = await generateCRMSuggestion(
        req.userId!,
        deal.contactId,
        dealId,
      );
      res.json(result);
    } catch (error) {
      console.error("CRM suggestion error:", error);
      res.status(500).json({ error: "Failed to generate suggestion." });
    }
  },
);

/**
 * @swagger
 * /api/crm/summaries/contact/{contactId}:
 *   get:
 *     summary: Get AI conversation summary for a contact
 *     tags: [CRM AI Suggestions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversation summary result
 *       404:
 *         description: Contact not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/summaries/contact/:contactId",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { contactId } = req.params;

      // Verify the contact belongs to the user
      const contact = await prisma.customer.findFirst({
        where: { id: contactId, userId: req.userId! },
      });

      if (!contact) {
        res.status(404).json({ error: "Contact not found." });
        return;
      }

      const result = await generateConversationSummary(req.userId!, contactId);
      res.json(result);
    } catch (error) {
      console.error("CRM summary error:", error);
      res
        .status(500)
        .json({ error: "Failed to generate conversation summary." });
    }
  },
);

export default router;
