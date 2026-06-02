import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { processCommand } from '../services/aiService.js';

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
 *         description: Parsed command result from the AI
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Command text is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 */
router.post('/command', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { command } = req.body;

    if (!command) {
      res.status(400).json({ error: 'Command text is required.' });
      return;
    }

    const result = await processCommand(command);
    res.json(result);
  } catch (error) {
    console.error('AI command error:', error);
    res.status(500).json({ error: 'Failed to process command.' });
  }
});

export default router;
