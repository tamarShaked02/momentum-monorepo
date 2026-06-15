import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import prisma from "../config/db.js";

/**
 * @swagger
 * tags:
 *   name: CRM Dashboard
 *   description: CRM pipeline metrics, forecasts, and funnel data
 */

const router = Router();

/**
 * @swagger
 * /api/crm/dashboard:
 *   get:
 *     summary: Get CRM dashboard metrics, forecast, funnel, and analytics
 *     tags: [CRM Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter deals with createdAt >= startDate
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter deals with createdAt <= endDate
 *     responses:
 *       200:
 *         description: Dashboard data with metrics, forecast, funnel, and analytics
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;

      // Build date filter for deals based on createdAt
      const dateFilter: Record<string, Date> = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate as string);
      }
      if (endDate) {
        dateFilter.lte = new Date(endDate as string);
      }

      const dealWhere: Record<string, unknown> = { userId: req.userId! };
      if (Object.keys(dateFilter).length > 0) {
        dealWhere.createdAt = dateFilter;
      }

      // Fetch all deals matching the user and date filter
      const deals = await prisma.deal.findMany({
        where: dealWhere,
        include: {
          stage: true,
        },
      });

      // --- Metrics ---
      const openDeals = deals.filter((d) => d.status === "open");
      const wonDeals = deals.filter((d) => d.status === "won");
      const lostDeals = deals.filter((d) => d.status === "lost");

      const totalPipelineValue = openDeals.reduce(
        (sum, d) => sum + (d.value ?? 0),
        0,
      );

      const weightedPipelineValue = openDeals.reduce((sum, d) => {
        const value = d.value ?? 0;
        const prob = d.winProbability ?? 0;
        return sum + (value * prob) / 100;
      }, 0);

      const dealsWon = wonDeals.length;
      const dealsLost = lostDeals.length;

      const winRate =
        dealsWon + dealsLost > 0
          ? (dealsWon / (dealsWon + dealsLost)) * 100
          : 0;

      // Average cycle duration: mean of (closedAt - createdAt) in days for closed deals
      const closedDeals = deals.filter((d) => d.closedAt !== null);
      let averageCycleDuration = 0;
      if (closedDeals.length > 0) {
        const totalDays = closedDeals.reduce((sum, d) => {
          const closedAt = new Date(d.closedAt!).getTime();
          const createdAt = new Date(d.createdAt).getTime();
          const diffDays = (closedAt - createdAt) / (1000 * 60 * 60 * 24);
          return sum + diffDays;
        }, 0);
        averageCycleDuration = totalDays / closedDeals.length;
      }

      // --- Forecast ---
      // For each open deal with expectedCloseDate, group by YYYY-MM month, sum weighted values
      const forecastMap = new Map<string, number>();
      for (const deal of openDeals) {
        if (!deal.expectedCloseDate) continue;
        const date = new Date(deal.expectedCloseDate);
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const weightedValue =
          ((deal.value ?? 0) * (deal.winProbability ?? 0)) / 100;
        forecastMap.set(month, (forecastMap.get(month) ?? 0) + weightedValue);
      }

      const forecast = Array.from(forecastMap.entries())
        .map(([month, weightedValue]) => ({ month, weightedValue }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // --- Funnel ---
      // Get all non-terminal stages for the user's pipelines, count deals and sum values
      const userPipelines = await prisma.pipeline.findMany({
        where: { userId: req.userId! },
        include: {
          stages: {
            where: { isTerminal: false },
            orderBy: { position: "asc" },
          },
        },
      });

      const funnel: Array<{
        stageId: string;
        stageName: string;
        dealCount: number;
        totalValue: number;
      }> = [];

      for (const pipeline of userPipelines) {
        for (const stage of pipeline.stages) {
          // Count deals in this stage that also match the date filter
          const stageDeals = deals.filter((d) => d.stageId === stage.id);
          funnel.push({
            stageId: stage.id,
            stageName: stage.name,
            dealCount: stageDeals.length,
            totalValue: stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0),
          });
        }
      }

      // --- Analytics module metrics ---
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const totalCustomers = await prisma.customer.count({
        where: { userId: req.userId! },
      });

      const newCustomersThisMonth = await prisma.customer.count({
        where: {
          userId: req.userId!,
          createdAt: { gte: startOfMonth },
        },
      });

      // Total pipeline value for analytics (all open deals, no date filter)
      const allOpenDeals = await prisma.deal.findMany({
        where: { userId: req.userId!, status: "open" },
      });
      const analyticsTotalPipelineValue = allOpenDeals.reduce(
        (sum, d) => sum + (d.value ?? 0),
        0,
      );

      // Total closed-won value (all won deals, no date filter)
      const allWonDeals = await prisma.deal.findMany({
        where: { userId: req.userId!, status: "won" },
      });
      const totalClosedWonValue = allWonDeals.reduce(
        (sum, d) => sum + (d.value ?? 0),
        0,
      );

      res.json({
        metrics: {
          totalPipelineValue,
          weightedPipelineValue,
          dealsWon,
          dealsLost,
          winRate,
          averageCycleDuration,
        },
        forecast,
        funnel,
        analytics: {
          totalCustomers,
          newCustomersThisMonth,
          totalPipelineValue: analyticsTotalPipelineValue,
          totalClosedWonValue: totalClosedWonValue,
        },
      });
    } catch (error) {
      console.error("CRM Dashboard error:", error);
      res.status(500).json({ error: "Failed to load CRM dashboard." });
    }
  },
);

export default router;
