import { Router, Request, Response } from 'express';
import bot from '../telegram/bot.js';

const router = Router();

// POST /api/telegram/webhook
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    if (bot) {
      await bot.handleUpdate(req.body);
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.sendStatus(500);
  }
});

export default router;
