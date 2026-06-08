import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createAppointmentSchema } from "../validation/schemas.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import prisma from "../config/db.js";

/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Appointment scheduling and availability endpoints
 */

const router = Router();

/**
 * @swagger
 * /api/appointments:
 *   get:
 *     summary: List appointments (optionally filtered by date range or status)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter appointments from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter appointments up to this date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, completed, cancelled]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of appointments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appointment'
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, status } = req.query;
      const where: any = { userId: req.userId! };

      if (startDate && endDate) {
        where.startTime = {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        };
      }
      if (status) {
        where.status = status as string;
      }

      const pagination = getPagination(req);

      if (pagination) {
        const [appointments, total] = await Promise.all([
          prisma.appointment.findMany({
            where,
            include: {
              customer: { select: { id: true, name: true, phone: true } },
            },
            orderBy: { startTime: "asc" },
            skip: pagination.skip,
            take: pagination.take,
          }),
          prisma.appointment.count({ where }),
        ]);
        res.json(paginatedResponse(appointments, total, pagination));
      } else {
        const appointments = await prisma.appointment.findMany({
          where,
          include: {
            customer: { select: { id: true, name: true, phone: true } },
          },
          orderBy: { startTime: "asc" },
        });
        res.json(appointments);
      }
    } catch (error) {
      console.error("Get appointments error:", error);
      res.status(500).json({ error: "Failed to fetch appointments." });
    }
  },
);

/**
 * @swagger
 * /api/appointments/availability:
 *   get:
 *     summary: Get available hourly slots for a specific date (8 AM – 6 PM)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date to check availability for (YYYY-MM-DD)
 *         example: "2026-06-01"
 *     responses:
 *       200:
 *         description: Available and booked time slots
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                 slots:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       startTime:
 *                         type: string
 *                         format: date-time
 *                       endTime:
 *                         type: string
 *                         format: date-time
 *                       available:
 *                         type: boolean
 *       400:
 *         description: Date query parameter is required
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/availability",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { date } = req.query;
      if (!date) {
        res
          .status(400)
          .json({ error: "Date query parameter is required (YYYY-MM-DD)." });
        return;
      }

      const targetDate = new Date(date as string);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const existingAppointments = await prisma.appointment.findMany({
        where: {
          userId: req.userId!,
          startTime: { gte: targetDate, lt: nextDate },
          status: { not: "cancelled" },
        },
        orderBy: { startTime: "asc" },
      });

      // Generate hourly slots from 8 AM to 6 PM
      const slots = [];
      for (let hour = 8; hour < 18; hour++) {
        const slotStart = new Date(targetDate);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(targetDate);
        slotEnd.setHours(hour + 1, 0, 0, 0);

        const isBooked = existingAppointments.some((apt) => {
          const aptStart = new Date(apt.startTime);
          const aptEnd = new Date(apt.endTime);
          return aptStart < slotEnd && aptEnd > slotStart;
        });

        slots.push({
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          available: !isBooked,
        });
      }

      res.json({ date: date as string, slots });
    } catch (error) {
      console.error("Availability error:", error);
      res.status(500).json({ error: "Failed to check availability." });
    }
  },
);

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Create a new appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppointmentBody'
 *     responses:
 *       201:
 *         description: Appointment created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Title, startTime, and endTime are required
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  authMiddleware,
  validate(createAppointmentSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        title,
        startTime,
        endTime,
        customerId,
        status,
        source,
        price,
        notes,
      } = req.body;

      if (!title || !startTime || !endTime) {
        res
          .status(400)
          .json({ error: "Title, startTime, and endTime are required." });
        return;
      }

      const appointment = await prisma.appointment.create({
        data: {
          userId: req.userId!,
          title,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          customerId: customerId || null,
          status: status || "scheduled",
          source: source || "manual",
          price: price != null ? Number(price) : null,
          notes: notes || null,
        },
        include: { customer: { select: { id: true, name: true } } },
      });

      res.status(201).json(appointment);
    } catch (error) {
      console.error("Create appointment error:", error);
      res.status(500).json({ error: "Failed to create appointment." });
    }
  },
);

/**
 * @swagger
 * /api/appointments/{id}:
 *   put:
 *     summary: Update an appointment
 *     tags: [Appointments]
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
 *             $ref: '#/components/schemas/AppointmentBody'
 *     responses:
 *       200:
 *         description: Updated appointment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Appointment not found
 */
router.put(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { title, startTime, endTime, customerId, status, price, notes } =
        req.body;

      const appointment = await prisma.appointment.updateMany({
        where: { id, userId: req.userId! },
        data: {
          ...(title !== undefined && { title }),
          ...(startTime !== undefined && { startTime: new Date(startTime) }),
          ...(endTime !== undefined && { endTime: new Date(endTime) }),
          ...(customerId !== undefined && { customerId }),
          ...(status !== undefined && { status }),
          ...(price !== undefined && {
            price: price != null ? Number(price) : null,
          }),
          ...(notes !== undefined && { notes }),
        },
      });

      if (appointment.count === 0) {
        res.status(404).json({ error: "Appointment not found." });
        return;
      }

      const updated = await prisma.appointment.findUnique({
        where: { id },
        include: { customer: { select: { id: true, name: true } } },
      });

      res.json(updated);
    } catch (error) {
      console.error("Update appointment error:", error);
      res.status(500).json({ error: "Failed to update appointment." });
    }
  },
);

/**
 * @swagger
 * /api/appointments/{id}:
 *   delete:
 *     summary: Cancel/delete an appointment
 *     tags: [Appointments]
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
 *         description: Appointment cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Appointment not found
 */
router.delete(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const result = await prisma.appointment.deleteMany({
        where: { id, userId: req.userId! },
      });

      if (result.count === 0) {
        res.status(404).json({ error: "Appointment not found." });
        return;
      }

      res.json({ message: "Appointment cancelled successfully." });
    } catch (error) {
      console.error("Delete appointment error:", error);
      res.status(500).json({ error: "Failed to delete appointment." });
    }
  },
);

export default router;
