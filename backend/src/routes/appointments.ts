import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createAppointmentSchema } from "../validation/schemas.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import prisma from "../config/db.js";
import { pushToGoogle } from "../services/syncEngine.js";
import { crmEventBus } from "../services/eventBus.js";

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

      // Non-blocking: push to Google Calendar if user has a token
      prisma.googleCalendarToken
        .findUnique({ where: { userId: req.userId! } })
        .then((token) => {
          if (token) {
            pushToGoogle(req.userId!, appointment, "create").catch((err) => {
              console.error("Google Calendar sync (create) failed:", err);
            });
          }
        })
        .catch((err) => {
          console.error("Google Calendar token check failed:", err);
        });
    } catch (error) {
      console.error("Create appointment error:", error);
      res.status(500).json({ error: "Failed to create appointment." });
    }
  },
);

/**
 * @swagger
 * /api/appointments/from-contact/{contactId}:
 *   post:
 *     summary: Create a new appointment pre-populated with a customer (from contact profile)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *         description: The customer/contact ID to link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppointmentBody'
 *     responses:
 *       201:
 *         description: Appointment created with pre-populated customer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Title, startTime, and endTime are required
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Contact not found
 */
router.post(
  "/from-contact/:contactId",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { contactId } = req.params;
      const { title, startTime, endTime, status, source, price, notes } =
        req.body;

      if (!title || !startTime || !endTime) {
        res
          .status(400)
          .json({ error: "Title, startTime, and endTime are required." });
        return;
      }

      // Verify the contact exists and belongs to the user
      const contact = await prisma.customer.findFirst({
        where: { id: contactId, userId: req.userId! },
      });

      if (!contact) {
        res.status(404).json({ error: "Contact not found." });
        return;
      }

      const appointment = await prisma.appointment.create({
        data: {
          userId: req.userId!,
          title,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          customerId: contactId,
          status: status || "scheduled",
          source: source || "manual",
          price: price != null ? Number(price) : null,
          notes: notes || null,
        },
        include: { customer: { select: { id: true, name: true } } },
      });

      res.status(201).json(appointment);

      // Non-blocking: push to Google Calendar if user has a token
      prisma.googleCalendarToken
        .findUnique({ where: { userId: req.userId! } })
        .then((token) => {
          if (token) {
            pushToGoogle(req.userId!, appointment, "create").catch((err) => {
              console.error("Google Calendar sync (create) failed:", err);
            });
          }
        })
        .catch((err) => {
          console.error("Google Calendar token check failed:", err);
        });
    } catch (error) {
      console.error("Create appointment from contact error:", error);
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

      // Fetch existing appointment to detect status change
      const existing = await prisma.appointment.findFirst({
        where: { id, userId: req.userId! },
      });

      if (!existing) {
        res.status(404).json({ error: "Appointment not found." });
        return;
      }

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

      // If status changed to "completed" and appointment has a linked customer, create activity
      if (
        updated &&
        status === "completed" &&
        existing.status !== "completed" &&
        updated.customerId
      ) {
        await prisma.activity.create({
          data: {
            userId: req.userId!,
            type: "appointment",
            description: `Appointment "${updated.title}" completed`,
            contactId: updated.customerId,
            isSystem: true,
            metadata: {
              appointmentId: updated.id,
              title: updated.title,
              date: updated.startTime.toISOString(),
              price: updated.price,
            },
          },
        });

        // Fetch the contact for the event emission
        const contact = await prisma.customer.findUnique({
          where: { id: updated.customerId },
        });

        if (contact) {
          crmEventBus.emitAppointmentCompleted(
            req.userId!,
            {
              id: updated.id,
              userId: req.userId!,
              customerId: updated.customerId,
              title: updated.title,
              startTime: updated.startTime,
              endTime: updated.endTime,
              status: updated.status,
              price: updated.price,
              notes: updated.notes,
            },
            contact as any,
          );
        }
      }

      res.json(updated);

      // Non-blocking: push to Google Calendar if user has a token
      if (updated) {
        prisma.googleCalendarToken
          .findUnique({ where: { userId: req.userId! } })
          .then((token) => {
            if (token) {
              pushToGoogle(req.userId!, updated, "update").catch((err) => {
                console.error("Google Calendar sync (update) failed:", err);
              });
            }
          })
          .catch((err) => {
            console.error("Google Calendar token check failed:", err);
          });
      }
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

      // Fetch the appointment before deleting to get googleEventId for sync
      const appointment = await prisma.appointment.findFirst({
        where: { id, userId: req.userId! },
      });

      if (!appointment) {
        res.status(404).json({ error: "Appointment not found." });
        return;
      }

      await prisma.appointment.delete({
        where: { id },
      });

      res.json({ message: "Appointment cancelled successfully." });

      // Non-blocking: push delete to Google Calendar if user has a token
      prisma.googleCalendarToken
        .findUnique({ where: { userId: req.userId! } })
        .then((token) => {
          if (token) {
            pushToGoogle(req.userId!, appointment, "delete").catch((err) => {
              console.error("Google Calendar sync (delete) failed:", err);
            });
          }
        })
        .catch((err) => {
          console.error("Google Calendar token check failed:", err);
        });
    } catch (error) {
      console.error("Delete appointment error:", error);
      res.status(500).json({ error: "Failed to delete appointment." });
    }
  },
);

export default router;
