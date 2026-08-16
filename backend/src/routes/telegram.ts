import { Router, Request, Response } from 'express';
import bot from '../telegram/bot.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import prisma from '../config/db.js';
import { logTelegramActivity } from '../services/telegramActivityLogger.js';

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

/**
 * GET /api/telegram/status
 * Returns the current user's Telegram connection status and customer stats.
 */
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { telegramChatId: true, phone: true, businessName: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Count customers with linked Telegram
    const linkedCustomersCount = await prisma.customer.count({
      where: { userId: req.userId!, telegramChatId: { not: null } },
    });

    const totalCustomers = await prisma.customer.count({
      where: { userId: req.userId! },
    });

    const botUsername = process.env.BOT_USERNAME || null;

    res.json({
      ownerConnected: !!user.telegramChatId,
      ownerPhone: user.phone,
      linkedCustomersCount,
      totalCustomers,
      botUsername,
      botInviteLink: botUsername ? `https://t.me/${botUsername}` : null,
    });
  } catch (error) {
    console.error('Telegram status error:', error);
    res.status(500).json({ error: 'Failed to fetch Telegram status.' });
  }
});

/**
 * POST /api/telegram/disconnect
 * Unlinks the business owner's Telegram account.
 */
router.post('/disconnect', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.user.update({
      where: { id: req.userId! },
      data: { telegramChatId: null },
    });
    res.json({ message: 'Telegram account disconnected.' });
  } catch (error) {
    console.error('Telegram disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Telegram.' });
  }
});

/**
 * POST /api/telegram/send-notification
 * Send a custom notification message to a specific customer via Telegram.
 * Body: { customerId: string, message: string }
 */
router.post('/send-notification', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!bot) {
      res.status(503).json({ error: 'Telegram bot is not configured.' });
      return;
    }

    const { customerId, message } = req.body;

    if (!customerId || !message) {
      res.status(400).json({ error: 'customerId and message are required.' });
      return;
    }

    if (typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'Message cannot be empty.' });
      return;
    }

    // Verify the customer belongs to this user
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, userId: req.userId! },
      select: { id: true, name: true, telegramChatId: true },
    });

    if (!customer) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    if (!customer.telegramChatId) {
      res.status(400).json({
        error: 'This customer has not linked their Telegram account.',
        customerName: customer.name,
      });
      return;
    }

    // Send the message via the bot
    await bot!.telegram.sendMessage(customer.telegramChatId!, message, { parse_mode: 'HTML' });

    // Log the activity
    await logTelegramActivity({
      userId: req.userId!,
      contactId: customer.id,
      direction: 'outbound',
      text: message,
    });

    res.json({
      success: true,
      message: `Notification sent to ${customer.name}.`,
      customerId: customer.id,
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification.' });
  }
});

/**
 * POST /api/telegram/send-campaign
 * Send a marketing campaign message to all customers who have Telegram linked
 * and match the campaign's audience filters.
 * Body: { campaignId: string }
 */
router.post('/send-campaign', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!bot) {
      res.status(503).json({ error: 'Telegram bot is not configured.' });
      return;
    }

    const { campaignId } = req.body;

    if (!campaignId) {
      res.status(400).json({ error: 'campaignId is required.' });
      return;
    }

    // Fetch the campaign
    const campaign = await prisma.marketingCampaign.findFirst({
      where: { id: campaignId, userId: req.userId! },
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found.' });
      return;
    }

    if (!campaign.telegramContent) {
      res.status(400).json({ error: 'This campaign has no Telegram content. Add a Telegram message before sending.' });
      return;
    }

    // Build audience filter
    const where: any = { userId: req.userId!, telegramChatId: { not: null } };
    const andConditions: any[] = [];

    if (campaign.audienceTags.length > 0) {
      andConditions.push({
        tags: {
          some: {
            tag: {
              name: { in: campaign.audienceTags, mode: 'insensitive' },
              userId: req.userId!,
            },
          },
        },
      });
    }

    if (campaign.audienceLifecycleStages.length > 0) {
      andConditions.push({
        lifecycleStage: {
          in: campaign.audienceLifecycleStages.map((s: string) => s.toLowerCase()),
        },
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const customers = await prisma.customer.findMany({
      where,
      select: { id: true, name: true, telegramChatId: true },
    });

    if (customers.length === 0) {
      res.status(400).json({
        error: 'No customers with linked Telegram accounts match this campaign audience.',
      });
      return;
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const customer of customers) {
      try {
        await bot!.telegram.sendMessage(customer.telegramChatId!, campaign.telegramContent!, {
          parse_mode: 'HTML',
        });

        await logTelegramActivity({
          userId: req.userId!,
          contactId: customer.id,
          direction: 'outbound',
          text: campaign.telegramContent,
        });

        sent++;
      } catch (err: any) {
        console.error(`Failed to send to customer ${customer.id}:`, err.message);
        errors.push(`${customer.name}: ${err.message}`);
        failed++;
      }
    }

    // Mark campaign as sent
    await prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: { status: 'sent', lastSentAt: new Date() },
    });

    res.json({
      success: true,
      sent,
      failed,
      total: customers.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Send campaign error:', error);
    res.status(500).json({ error: 'Failed to send campaign.' });
  }
});

/**
 * GET /api/telegram/linked-customers
 * Returns all customers who have linked their Telegram accounts.
 */
router.get('/linked-customers', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customers = await prisma.customer.findMany({
      where: { userId: req.userId!, telegramChatId: { not: null } },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        telegramChatId: true,
        lifecycleStage: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(customers);
  } catch (error) {
    console.error('Linked customers error:', error);
    res.status(500).json({ error: 'Failed to fetch linked customers.' });
  }
});

export default router;
