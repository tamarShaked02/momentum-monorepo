import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import prisma from '../config/db.js';

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Aggregated dashboard summary endpoint
 */

const router = Router();

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     summary: Get a personalized dashboard summary for the authenticated user
 *     description: Returns context-aware widgets (scheduling, CRM, inventory, tasks, analytics) based on the user's enabled modules.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary with active module widgets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     businessName:
 *                       type: string
 *                     businessType:
 *                       type: string
 *                 moduleConfig:
 *                   type: object
 *                 widgets:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User or module config not found
 */
router.get('/summary', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { moduleConfig: true },
    });

    if (!user || !user.moduleConfig) {
      res.status(404).json({ error: 'User or module config not found.' });
      return;
    }

    const config = user.moduleConfig;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const widgets: any = {};

    // Context-aware greeting
    const hour = now.getHours();
    let greeting = 'Good evening';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';

    widgets.greeting = `${greeting}, ${user.businessName || 'there'}!`;

    // Scheduling widget
    if (config.schedulingEnabled) {
      const todayAppointments = await prisma.appointment.findMany({
        where: {
          userId: req.userId!,
          startTime: { gte: todayStart, lt: todayEnd },
          status: { not: 'cancelled' },
        },
        include: { customer: { select: { name: true } } },
        orderBy: { startTime: 'asc' },
      });

      const upcomingAppointments = todayAppointments.filter(a => new Date(a.startTime) >= now);

      widgets.scheduling = {
        totalToday: todayAppointments.length,
        upcoming: upcomingAppointments.slice(0, 3).map(a => ({
          id: a.id,
          title: a.title,
          startTime: a.startTime,
          endTime: a.endTime,
          customerName: a.customer?.name || 'Walk-in',
          status: a.status,
        })),
        nextAppointment: upcomingAppointments[0] ? {
          id: upcomingAppointments[0].id,
          title: upcomingAppointments[0].title,
          startTime: upcomingAppointments[0].startTime,
          customerName: upcomingAppointments[0].customer?.name || 'Walk-in',
        } : null,
      };
    }

    // CRM widget
    if (config.crmEnabled) {
      const recentCustomers = await prisma.customer.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, createdAt: true },
      });

      const totalCustomers = await prisma.customer.count({ where: { userId: req.userId! } });

      widgets.crm = {
        totalCustomers,
        recentCustomers,
      };
    }

    // Inventory widget
    if (config.inventoryEnabled) {
      const lowStockItems = await prisma.inventoryItem.findMany({
        where: {
          userId: req.userId!,
          quantity: { lte: prisma.inventoryItem.fields.lowThreshold as any },
        },
      });

      // Workaround: fetch all and filter in JS since Prisma doesn't support field-to-field comparison easily
      const allItems = await prisma.inventoryItem.findMany({ where: { userId: req.userId! } });
      const criticalLow = allItems.filter(item => item.quantity <= item.lowThreshold);

      widgets.inventory = {
        totalItems: allItems.length,
        criticalLowCount: criticalLow.length,
        criticalItems: criticalLow.slice(0, 5).map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          lowThreshold: item.lowThreshold,
        })),
      };
    }

    // Tasks widget
    if (config.tasksEnabled) {
      const todayTasks = await prisma.task.findMany({
        where: {
          userId: req.userId!,
          status: { in: ['pending', 'in_progress'] },
        },
        orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
        take: 5,
      });

      const taskCounts = {
        pending: await prisma.task.count({ where: { userId: req.userId!, status: 'pending' } }),
        in_progress: await prisma.task.count({ where: { userId: req.userId!, status: 'in_progress' } }),
        completed: await prisma.task.count({ where: { userId: req.userId!, status: 'completed' } }),
      };

      widgets.tasks = {
        counts: taskCounts,
        pendingTasks: todayTasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          category: t.category,
          dueDate: t.dueDate,
        })),
      };
    }

    // Analytics widget
    if (config.analyticsEnabled) {
      const last7Days = new Date(now);
      last7Days.setDate(last7Days.getDate() - 7);

      const weekAppointments = await prisma.appointment.count({
        where: {
          userId: req.userId!,
          startTime: { gte: last7Days },
          status: 'completed',
        },
      });

      const totalAppointments = await prisma.appointment.count({
        where: { userId: req.userId! },
      });

      widgets.analytics = {
        weekCompletedAppointments: weekAppointments,
        totalAppointments,
        // Revenue would need a payment model in production — using appointment count as proxy
      };
    }

    res.json({
      user: {
        businessName: user.businessName,
        businessType: user.businessType,
      },
      moduleConfig: config,
      widgets,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard summary.' });
  }
});

export default router;
