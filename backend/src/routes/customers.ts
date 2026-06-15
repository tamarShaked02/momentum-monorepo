import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createContactSchema,
  updateContactSchema,
  createTagSchema,
} from "../validation/crmSchemas.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import prisma from "../config/db.js";
import { crmEventBus } from "../services/eventBus.js";

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: CRM customer management endpoints
 */

const router = Router();

// Valid sort fields for the contacts list
const VALID_SORT_FIELDS = [
  "name",
  "email",
  "company",
  "lifecycleStage",
  "createdAt",
] as const;
type SortField = (typeof VALID_SORT_FIELDS)[number];

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: List all customers (with advanced search, sorting, pagination)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Partial case-insensitive search on name, email, phone, company
 *       - in: query
 *         name: lifecycleStage
 *         schema:
 *           type: string
 *         description: Exact match on lifecycle stage
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated tag names for exact match filtering
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort field (name, email, company, lifecycleStage, createdAt)
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of customers
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { search, lifecycleStage, tags, sortBy, sortOrder } = req.query;
      const where: any = { userId: req.userId! };

      // Advanced search: partial case-insensitive match on name, email, phone, company
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: "insensitive" } },
          { email: { contains: search as string, mode: "insensitive" } },
          { phone: { contains: search as string, mode: "insensitive" } },
          { company: { contains: search as string, mode: "insensitive" } },
        ];
      }

      // Exact match on lifecycle stage
      if (lifecycleStage) {
        where.lifecycleStage = lifecycleStage as string;
      }

      // Exact match on tags (comma-separated)
      if (tags) {
        const tagNames = (tags as string).split(",").map((t) => t.trim());
        where.tags = {
          some: {
            tag: {
              name: { in: tagNames },
              userId: req.userId!,
            },
          },
        };
      }

      // Sorting
      let orderBy: any = { name: "asc" };
      if (sortBy && VALID_SORT_FIELDS.includes(sortBy as SortField)) {
        const order = sortOrder === "desc" ? "desc" : "asc";
        orderBy = { [sortBy as string]: order };
      }

      // Pagination (default 20, max 100) - getPagination handles this
      const pagination = getPagination(req);

      if (pagination) {
        const [customers, total] = await Promise.all([
          prisma.customer.findMany({
            where,
            include: {
              tags: { include: { tag: true } },
              _count: { select: { appointments: true } },
            },
            orderBy,
            skip: pagination.skip,
            take: pagination.take,
          }),
          prisma.customer.count({ where }),
        ]);
        res.json(paginatedResponse(customers, total, pagination));
      } else {
        // Default pagination when no page/pageSize params (backwards compat with default 20)
        const [customers, total] = await Promise.all([
          prisma.customer.findMany({
            where,
            include: {
              tags: { include: { tag: true } },
              _count: { select: { appointments: true } },
            },
            orderBy,
            take: 20,
          }),
          prisma.customer.count({ where }),
        ]);
        res.json(
          paginatedResponse(customers, total, {
            skip: 0,
            take: 20,
            page: 1,
            pageSize: 20,
          }),
        );
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers." });
    }
  },
);

/**
 * @swagger
 * /api/customers/{id}/history:
 *   get:
 *     summary: Get appointment history for a customer
 *     tags: [Customers]
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
 *         description: Customer with appointment history
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer not found
 */
router.get(
  "/:id/history",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!customer) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      const appointments = await prisma.appointment.findMany({
        where: { customerId: req.params.id, userId: req.userId! },
        orderBy: { startTime: "desc" },
      });
      res.json({ customer, appointments, totalVisits: appointments.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch history." });
    }
  },
);

/**
 * @swagger
 * /api/customers/{id}/activities:
 *   get:
 *     summary: Get activity timeline for a contact
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Comma-separated activity types to filter
 *     responses:
 *       200:
 *         description: Paginated activities
 *       404:
 *         description: Contact not found
 */
router.get(
  "/:id/activities",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!customer) {
        res.status(404).json({ error: "Not found." });
        return;
      }

      const { type } = req.query;
      const where: any = { contactId: req.params.id, userId: req.userId! };

      // Filter by activity types
      if (type) {
        const types = (type as string).split(",").map((t) => t.trim());
        where.type = { in: types };
      }

      const pagination = getPagination(req) || {
        skip: 0,
        take: 20,
        page: 1,
        pageSize: 20,
      };

      const [activities, total] = await Promise.all([
        prisma.activity.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: pagination.skip,
          take: pagination.take,
        }),
        prisma.activity.count({ where }),
      ]);

      res.json(paginatedResponse(activities, total, pagination));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities." });
    }
  },
);

/**
 * @swagger
 * /api/customers/{id}/tasks:
 *   get:
 *     summary: Get linked tasks for a contact
 *     tags: [Customers]
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
 *         description: Tasks linked to the contact
 *       404:
 *         description: Contact not found
 */
router.get(
  "/:id/tasks",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!customer) {
        res.status(404).json({ error: "Not found." });
        return;
      }

      // Tasks ordered by due date ascending, nulls last
      const tasks = await prisma.task.findMany({
        where: { contactId: req.params.id, userId: req.userId! },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
      });

      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks." });
    }
  },
);

/**
 * @swagger
 * /api/customers/{id}/campaigns:
 *   get:
 *     summary: Get marketing campaigns where contact is part of the audience
 *     tags: [Customers]
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
 *         description: Campaigns associated with the contact's segment
 *       404:
 *         description: Contact not found
 */
router.get(
  "/:id/campaigns",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: req.params.id, userId: req.userId! },
        include: {
          tags: { include: { tag: true } },
        },
      });
      if (!customer) {
        res.status(404).json({ error: "Not found." });
        return;
      }

      // Get all campaigns for this user that have audience filters
      const campaigns = await prisma.marketingCampaign.findMany({
        where: {
          userId: req.userId!,
          OR: [
            { audienceTags: { isEmpty: false } },
            { audienceLifecycleStages: { isEmpty: false } },
          ],
        },
        orderBy: { createdAt: "desc" },
      });

      // Filter campaigns where this contact matches the audience criteria
      const contactTagNames = customer.tags.map((ct) =>
        ct.tag.name.toLowerCase(),
      );
      const contactLifecycle = customer.lifecycleStage.toLowerCase();

      const matchingCampaigns = campaigns.filter((campaign) => {
        const hasTags = campaign.audienceTags.length > 0;
        const hasLifecycle = campaign.audienceLifecycleStages.length > 0;

        // AND between filter types
        let matchesTags = true;
        let matchesLifecycle = true;

        // OR within tags: contact must have at least one of the campaign's audience tags
        if (hasTags) {
          matchesTags = campaign.audienceTags.some((tag) =>
            contactTagNames.includes(tag.toLowerCase()),
          );
        }

        // OR within lifecycle stages: contact's lifecycle must be one of the campaign's audience stages
        if (hasLifecycle) {
          matchesLifecycle = campaign.audienceLifecycleStages.some(
            (stage) => stage.toLowerCase() === contactLifecycle,
          );
        }

        return matchesTags && matchesLifecycle;
      });

      // Return only relevant fields
      const result = matchingCampaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        scheduledAt: c.scheduledAt,
      }));

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaigns." });
    }
  },
);

/**
 * @swagger
 * /api/customers/{id}/deals:
 *   get:
 *     summary: Get deals associated with a contact
 *     tags: [Customers]
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
 *         description: Deals associated with the contact
 *       404:
 *         description: Contact not found
 */
router.get(
  "/:id/deals",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!customer) {
        res.status(404).json({ error: "Not found." });
        return;
      }

      const deals = await prisma.deal.findMany({
        where: { contactId: req.params.id, userId: req.userId! },
        include: { stage: true, pipeline: true },
        orderBy: { createdAt: "desc" },
      });

      res.json(deals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deals." });
    }
  },
);

/**
 * @swagger
 * /api/customers/{id}/tags:
 *   post:
 *     summary: Add a tag to a contact
 *     tags: [Customers]
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
 *               name:
 *                 type: string
 *               color:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tag added to contact
 *       400:
 *         description: Duplicate tag
 *       404:
 *         description: Contact not found
 */
router.post(
  "/:id/tags",
  authMiddleware,
  validate(createTagSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!customer) {
        res.status(404).json({ error: "Not found." });
        return;
      }

      const { name, color } = req.body;
      const normalizedName = name.toLowerCase();

      // Find or create the tag (case-insensitive check via unique constraint on userId+name)
      let tag = await prisma.tag.findFirst({
        where: {
          userId: req.userId!,
          name: { equals: normalizedName, mode: "insensitive" },
        },
      });

      if (!tag) {
        tag = await prisma.tag.create({
          data: {
            userId: req.userId!,
            name,
            color: color || null,
          },
        });
      }

      // Check if this tag is already assigned to the contact (case-insensitive duplicate check)
      const existingAssignment = await prisma.contactTag.findUnique({
        where: {
          contactId_tagId: {
            contactId: req.params.id,
            tagId: tag.id,
          },
        },
      });

      if (existingAssignment) {
        res
          .status(400)
          .json({ error: "Tag already assigned to this contact." });
        return;
      }

      // Create the assignment
      const contactTag = await prisma.contactTag.create({
        data: {
          contactId: req.params.id,
          tagId: tag.id,
        },
        include: { tag: true },
      });

      res.status(201).json(contactTag);
    } catch (error) {
      res.status(500).json({ error: "Failed to add tag." });
    }
  },
);

/**
 * @swagger
 * /api/customers/{id}/tags/{tagId}:
 *   delete:
 *     summary: Remove a tag from a contact
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tag removed from contact
 *       404:
 *         description: Tag assignment not found
 */
router.delete(
  "/:id/tags/:tagId",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Verify the contact belongs to the user
      const customer = await prisma.customer.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!customer) {
        res.status(404).json({ error: "Not found." });
        return;
      }

      // Delete the tag assignment
      const result = await prisma.contactTag.deleteMany({
        where: {
          contactId: req.params.id,
          tagId: req.params.tagId,
        },
      });

      if (result.count === 0) {
        res.status(404).json({ error: "Tag assignment not found." });
        return;
      }

      res.json({ message: "Tag removed from contact." });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove tag." });
    }
  },
);

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: Get enriched contact profile with revenue metrics
 *     tags: [Customers]
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
 *         description: Enriched customer profile with revenue metrics
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.get(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: req.params.id, userId: req.userId! },
        include: {
          tags: { include: { tag: true } },
          appointments: { orderBy: { startTime: "desc" }, take: 20 },
          deals: { include: { stage: true, pipeline: true } },
        },
      });
      if (!customer) {
        res.status(404).json({ error: "Not found." });
        return;
      }

      // Revenue metrics: sum of completed appointment prices + sum of won deal values
      const [appointmentRevenue, dealRevenue] = await Promise.all([
        prisma.appointment.aggregate({
          where: {
            customerId: req.params.id,
            userId: req.userId!,
            status: "completed",
          },
          _sum: { price: true },
        }),
        prisma.deal.aggregate({
          where: {
            contactId: req.params.id,
            userId: req.userId!,
            status: "won",
          },
          _sum: { value: true },
        }),
      ]);

      const totalAppointmentRevenue = appointmentRevenue._sum.price || 0;
      const totalDealRevenue = dealRevenue._sum.value || 0;
      const totalRevenue = totalAppointmentRevenue + totalDealRevenue;

      // Count of completed appointments
      const completedAppointmentsCount = await prisma.appointment.count({
        where: {
          customerId: req.params.id,
          userId: req.userId!,
          status: "completed",
        },
      });

      res.json({
        ...customer,
        revenueMetrics: {
          totalRevenue,
          appointmentRevenue: totalAppointmentRevenue,
          dealRevenue: totalDealRevenue,
          completedAppointments: completedAppointmentsCount,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer." });
    }
  },
);

/**
 * @swagger
 * /api/customers:
 *   post:
 *     summary: Create a new customer with enriched fields
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               telegramChatId:
 *                 type: string
 *               notes:
 *                 type: string
 *               company:
 *                 type: string
 *               jobTitle:
 *                 type: string
 *               leadSource:
 *                 type: string
 *               lifecycleStage:
 *                 type: string
 *     responses:
 *       201:
 *         description: Customer created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  authMiddleware,
  validate(createContactSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        name,
        email,
        phone,
        telegramChatId,
        notes,
        company,
        jobTitle,
        leadSource,
        lifecycleStage,
      } = req.body;

      const customer = await prisma.customer.create({
        data: {
          userId: req.userId!,
          name,
          email: email || null,
          phone: phone || null,
          telegramChatId: telegramChatId || null,
          notes: notes || null,
          company: company || null,
          jobTitle: jobTitle || null,
          leadSource: leadSource || null,
          lifecycleStage: lifecycleStage || "lead",
        },
      });
      res.status(201).json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to create customer." });
    }
  },
);

/**
 * @swagger
 * /api/customers/{id}:
 *   put:
 *     summary: Update a customer (including lifecycle, company, etc.)
 *     tags: [Customers]
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
 *     responses:
 *       200:
 *         description: Updated customer
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.put(
  "/:id",
  authMiddleware,
  validate(updateContactSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        name,
        email,
        phone,
        notes,
        telegramChatId,
        company,
        jobTitle,
        leadSource,
        lifecycleStage,
      } = req.body;

      // Fetch current customer to detect lifecycle stage changes
      const existing = await prisma.customer.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });

      if (!existing) {
        res.status(404).json({ error: "Not found." });
        return;
      }

      const data: any = {};
      if (name !== undefined) data.name = name;
      if (email !== undefined) data.email = email;
      if (phone !== undefined) data.phone = phone;
      if (notes !== undefined) data.notes = notes;
      if (telegramChatId !== undefined) data.telegramChatId = telegramChatId;
      if (company !== undefined) data.company = company;
      if (jobTitle !== undefined) data.jobTitle = jobTitle;
      if (leadSource !== undefined) data.leadSource = leadSource;
      if (lifecycleStage !== undefined) data.lifecycleStage = lifecycleStage;

      const updated = await prisma.customer.update({
        where: { id: req.params.id },
        data,
      });

      // Emit lifecycle change event if the stage changed
      if (
        lifecycleStage !== undefined &&
        existing.lifecycleStage !== lifecycleStage
      ) {
        crmEventBus.emitContactLifecycleChanged(
          req.userId!,
          {
            id: updated.id,
            userId: updated.userId,
            name: updated.name,
            email: updated.email,
            phone: updated.phone,
            telegramChatId: updated.telegramChatId,
            notes: updated.notes,
            company: updated.company,
            jobTitle: updated.jobTitle,
            leadSource: updated.leadSource,
            lifecycleStage: updated.lifecycleStage as any,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
          },
          existing.lifecycleStage,
          lifecycleStage,
        );
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer." });
    }
  },
);

/**
 * @swagger
 * /api/customers/{id}:
 *   delete:
 *     summary: Delete a customer
 *     tags: [Customers]
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
 *         description: Customer deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.delete(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await prisma.customer.deleteMany({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (result.count === 0) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      res.json({ message: "Customer deleted." });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete customer." });
    }
  },
);

export default router;
