import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { processOnboardingMessage } from "../services/aiService.js";
import prisma from "../config/db.js";

/**
 * @swagger
 * tags:
 *   name: Onboarding
 *   description: AI-guided business onboarding flow
 */

const router = Router();

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * @swagger
 * /api/onboarding/start:
 *   post:
 *     summary: Start the AI onboarding conversation
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Greeting message from the AI assistant
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/start",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      res.json({
        type: "greeting",
        message:
          "Hi! I'm your Momentum assistant. Tell me a bit about the business you're building — what do you do, and how do you work with your customers?",
      });
    } catch (error) {
      console.error("Onboarding start error:", error);
      res.status(500).json({ error: "Failed to start onboarding." });
    }
  },
);

/**
 * @swagger
 * /api/onboarding/message:
 *   post:
 *     summary: Send a message in the onboarding conversation
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [conversationHistory]
 *             properties:
 *               conversationHistory:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *     responses:
 *       200:
 *         description: AI response with module recommendations or follow-up questions
 *       400:
 *         description: Conversation history is required
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/message",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { conversationHistory } = req.body as {
        conversationHistory: ConversationMessage[];
      };

      if (
        !conversationHistory ||
        !Array.isArray(conversationHistory) ||
        conversationHistory.length === 0
      ) {
        res.status(400).json({ error: "Conversation history is required." });
        return;
      }

      // For returning users, inject current module context so AI knows what's already enabled
      const moduleConfig = await prisma.moduleConfig.findUnique({
        where: { userId: req.userId! },
      });

      let enrichedHistory = conversationHistory;
      if (moduleConfig) {
        const enabledModules: string[] = [];
        if (moduleConfig.schedulingEnabled) enabledModules.push("scheduling");
        if (moduleConfig.crmEnabled) enabledModules.push("crm");
        if (moduleConfig.inventoryEnabled) enabledModules.push("inventory");
        if (moduleConfig.tasksEnabled) enabledModules.push("tasks");
        if (moduleConfig.marketingEnabled) enabledModules.push("marketing");
        if (moduleConfig.analyticsEnabled) enabledModules.push("analytics");

        const systemContext: ConversationMessage = {
          role: "assistant",
          content: `[System context: This user already has these modules enabled: ${enabledModules.join(", ")}. They are returning to ADD or REMOVE modules. Only recommend modules they don't already have when they ask to add. When they ask to remove, include only the modules to remove. Always indicate in the recommendation whether it's an ADD or REMOVE operation.]`,
        };

        // Insert system context at the beginning, after the first greeting
        enrichedHistory = [systemContext, ...conversationHistory];
      }

      const aiResponse = await processOnboardingMessage(enrichedHistory);
      res.json(aiResponse);
    } catch (error) {
      console.error("Onboarding message error:", error);
      res.status(500).json({ error: "Failed to process onboarding message." });
    }
  },
);

/**
 * @swagger
 * /api/onboarding/confirm:
 *   post:
 *     summary: Confirm and save the recommended module configuration
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recommended_modules]
 *             properties:
 *               recommended_modules:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: scheduling
 *                     reason:
 *                       type: string
 *               businessType:
 *                 type: string
 *                 example: salon
 *               businessName:
 *                 type: string
 *                 example: Bella Hair Studio
 *     responses:
 *       200:
 *         description: Configuration saved successfully
 *       400:
 *         description: recommended_modules array is required
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/confirm",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { recommended_modules, businessType, businessName, mode } =
        req.body as {
          recommended_modules: Array<{ id: string; reason: string }>;
          businessType?: string;
          businessName?: string;
          mode?: "replace" | "add" | "remove";
        };

      if (!recommended_modules || !Array.isArray(recommended_modules)) {
        res
          .status(400)
          .json({ error: "recommended_modules array is required." });
        return;
      }

      const moduleIds = recommended_modules.map((m) => m.id);

      // Get existing config (if any) for merge modes
      const existingConfig = await prisma.moduleConfig.findUnique({
        where: { userId: req.userId! },
      });

      let configData: Record<string, boolean>;

      if (mode === "add" && existingConfig) {
        // ADD mode: keep existing modules enabled, add new ones
        configData = {
          schedulingEnabled:
            existingConfig.schedulingEnabled ||
            moduleIds.includes("scheduling"),
          crmEnabled: existingConfig.crmEnabled || moduleIds.includes("crm"),
          inventoryEnabled:
            existingConfig.inventoryEnabled || moduleIds.includes("inventory"),
          tasksEnabled:
            existingConfig.tasksEnabled || moduleIds.includes("tasks"),
          marketingEnabled:
            existingConfig.marketingEnabled || moduleIds.includes("marketing"),
          analyticsEnabled:
            existingConfig.analyticsEnabled || moduleIds.includes("analytics"),
        };
      } else if (mode === "remove" && existingConfig) {
        // REMOVE mode: disable specified modules, keep others unchanged
        configData = {
          schedulingEnabled: moduleIds.includes("scheduling")
            ? false
            : existingConfig.schedulingEnabled,
          crmEnabled: moduleIds.includes("crm")
            ? false
            : existingConfig.crmEnabled,
          inventoryEnabled: moduleIds.includes("inventory")
            ? false
            : existingConfig.inventoryEnabled,
          tasksEnabled: moduleIds.includes("tasks")
            ? false
            : existingConfig.tasksEnabled,
          marketingEnabled: moduleIds.includes("marketing")
            ? false
            : existingConfig.marketingEnabled,
          analyticsEnabled: moduleIds.includes("analytics")
            ? false
            : existingConfig.analyticsEnabled,
        };
      } else {
        // REPLACE mode (default): full overwrite
        configData = {
          schedulingEnabled: moduleIds.includes("scheduling"),
          crmEnabled: moduleIds.includes("crm"),
          inventoryEnabled: moduleIds.includes("inventory"),
          tasksEnabled: moduleIds.includes("tasks"),
          marketingEnabled: moduleIds.includes("marketing"),
          analyticsEnabled: moduleIds.includes("analytics"),
        };
      }

      const moduleConfig = await prisma.moduleConfig.upsert({
        where: { userId: req.userId! },
        create: {
          userId: req.userId!,
          ...configData,
        },
        update: configData,
      });

      await prisma.user.update({
        where: { id: req.userId! },
        data: {
          businessType: businessType || undefined,
          businessName: businessName || undefined,
        },
      });

      if (configData.tasksEnabled) {
        const existingTasks = await prisma.task.count({
          where: { userId: req.userId! },
        });
        if (existingTasks === 0) {
          await prisma.task.createMany({
            data: [
              {
                userId: req.userId!,
                title: "Set up your business profile",
                description: "Complete your business details in settings",
                status: "completed",
                priority: "high",
                category: "administrative",
              },
              {
                userId: req.userId!,
                title: "Add your first customer",
                description: "Go to CRM and add a customer record",
                status: "pending",
                priority: "high",
                category: "customer",
              },
              {
                userId: req.userId!,
                title: "Review your workspace",
                description: "Explore all the modules and customize your setup",
                status: "pending",
                priority: "medium",
                category: "administrative",
              },
            ],
          });
        }
      }

      res.json({
        message: "Business configuration saved successfully!",
        moduleConfig,
      });
    } catch (error) {
      console.error("Onboarding confirm error:", error);
      res.status(500).json({ error: "Failed to save configuration." });
    }
  },
);

export default router;
