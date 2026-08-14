import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { interpretCommand } from "../ai/aiInterpreter.js";
import { commandEngine } from "../ai/commandEngine.js";

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI-powered natural language command processing
 */

const router = Router();

/**
 * @swagger
 * /api/ai/command:
 *   post:
 *     summary: Process a natural language business command via AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [command]
 *             properties:
 *               command:
 *                 type: string
 *                 example: "Schedule a haircut for Jane tomorrow at 3pm"
 *     responses:
 *       200:
 *         description: Command result
 *       400:
 *         description: Command text is required
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/command",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { command } = req.body;

      if (!command) {
        res.status(400).json({ error: "Command text is required." });
        return;
      }

      const interpretResult = await interpretCommand(command, req.userId!);

      if (interpretResult.type === "function_call" && interpretResult.functionCall) {
        const executeResult = await commandEngine.execute(interpretResult.functionCall, req.userId!);
        res.json(executeResult);
        return;
      }

      if (interpretResult.type === "clarification" && interpretResult.clarification) {
        const isFallbackError =
          interpretResult.clarification.message.includes("high demand") ||
          interpretResult.clarification.message.includes("experiencing exceptionally high demand") ||
          interpretResult.clarification.message.includes("try your request again");

        res.json({
          success: !isFallbackError,
          type: isFallbackError ? "error" : "clarification",
          message: interpretResult.clarification.message,
        });
        return;
      }

      res.json({
        success: false,
        type: "unknown",
        message: interpretResult.unknownMessage || "Could not process or understand the command.",
      });
    } catch (error) {
      console.error("AI command error:", error);
      res.status(500).json({ error: "Failed to process command." });
    }
  },
);

/**
 * @swagger
 * /api/ai/confirm:
 *   post:
 *     summary: Confirm or cancel a gated destructive command
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, confirmed]
 *             properties:
 *               token:
 *                 type: string
 *               confirmed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Action resolution result
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/confirm",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { token, confirmed } = req.body;

      if (token === undefined || confirmed === undefined) {
        res.status(400).json({ error: "Both token and confirmed fields are required." });
        return;
      }

      const result = await commandEngine.confirm(token, confirmed, req.userId!);
      res.json(result);
    } catch (error) {
      console.error("AI confirmation error:", error);
      res.status(500).json({ error: "Failed to resolve confirmation." });
    }
  },
);

export default router;
