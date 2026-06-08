import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createCustomerSchema } from "../validation/schemas.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import prisma from "../config/db.js";

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: CRM customer management endpoints
 */

const router = Router();

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: List all customers (with optional search)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, email, or phone
 *     responses:
 *       200:
 *         description: List of customers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Customer'
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { search } = req.query;
      const where: any = { userId: req.userId! };
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: "insensitive" } },
          { email: { contains: search as string, mode: "insensitive" } },
          { phone: { contains: search as string } },
        ];
      }

      const pagination = getPagination(req);

      if (pagination) {
        const [customers, total] = await Promise.all([
          prisma.customer.findMany({
            where,
            include: { _count: { select: { appointments: true } } },
            orderBy: { name: "asc" },
            skip: pagination.skip,
            take: pagination.take,
          }),
          prisma.customer.count({ where }),
        ]);
        res.json(paginatedResponse(customers, total, pagination));
      } else {
        const customers = await prisma.customer.findMany({
          where,
          include: { _count: { select: { appointments: true } } },
          orderBy: { name: "asc" },
        });
        res.json(customers);
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 customer:
 *                   $ref: '#/components/schemas/Customer'
 *                 appointments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Appointment'
 *                 totalVisits:
 *                   type: integer
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
 * /api/customers/{id}:
 *   get:
 *     summary: Get a single customer by ID
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
 *         description: Customer details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
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
        include: { appointments: { orderBy: { startTime: "desc" }, take: 20 } },
      });
      if (!customer) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer." });
    }
  },
);

/**
 * @swagger
 * /api/customers:
 *   post:
 *     summary: Create a new customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerBody'
 *     responses:
 *       201:
 *         description: Customer created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
 *       400:
 *         description: Name is required
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  authMiddleware,
  validate(createCustomerSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, email, phone, telegramChatId, notes } = req.body;
      if (!name) {
        res.status(400).json({ error: "Name is required." });
        return;
      }
      const customer = await prisma.customer.create({
        data: {
          userId: req.userId!,
          name,
          email: email || null,
          phone: phone || null,
          telegramChatId: telegramChatId || null,
          notes: notes || null,
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
 *     summary: Update a customer
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
 *             $ref: '#/components/schemas/CustomerBody'
 *     responses:
 *       200:
 *         description: Updated customer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.put(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, email, phone, notes } = req.body;
      const result = await prisma.customer.updateMany({
        where: { id: req.params.id, userId: req.userId! },
        data: {
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
          ...(notes !== undefined && { notes }),
        },
      });
      if (result.count === 0) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      const updated = await prisma.customer.findUnique({
        where: { id: req.params.id },
      });
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
