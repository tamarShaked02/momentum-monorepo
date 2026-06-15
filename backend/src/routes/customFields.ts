import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createCustomFieldSchema,
  updateCustomFieldSchema,
} from "../validation/crmSchemas.js";
import prisma from "../config/db.js";

/**
 * @swagger
 * tags:
 *   name: Custom Fields
 *   description: Custom field definitions and values for contacts
 */

const router = Router();

/** Maximum number of custom fields a user can create */
const MAX_CUSTOM_FIELDS_PER_USER = 30;

/**
 * @swagger
 * /api/custom-fields:
 *   get:
 *     summary: List user's custom field definitions
 *     tags: [Custom Fields]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of custom field definitions
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const fields = await prisma.customField.findMany({
        where: { userId: req.userId! },
        orderBy: { position: "asc" },
      });
      res.json(fields);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch custom fields." });
    }
  },
);

/**
 * @swagger
 * /api/custom-fields:
 *   post:
 *     summary: Create a custom field definition
 *     tags: [Custom Fields]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, fieldType]
 *             properties:
 *               name:
 *                 type: string
 *               fieldType:
 *                 type: string
 *                 enum: [text, number, date, dropdown]
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *               position:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Custom field created
 *       400:
 *         description: Validation error or limit exceeded
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  authMiddleware,
  validate(createCustomFieldSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, fieldType, options, position } = req.body;

      // Check max custom fields per user limit
      const existingCount = await prisma.customField.count({
        where: { userId: req.userId! },
      });

      if (existingCount >= MAX_CUSTOM_FIELDS_PER_USER) {
        res.status(400).json({
          error: `Maximum of ${MAX_CUSTOM_FIELDS_PER_USER} custom fields allowed.`,
        });
        return;
      }

      // Dropdown fields must have options; non-dropdown fields should not
      if (fieldType === "dropdown" && (!options || options.length === 0)) {
        res.status(400).json({
          error: "Dropdown fields must have at least one option.",
        });
        return;
      }

      const field = await prisma.customField.create({
        data: {
          userId: req.userId!,
          name,
          fieldType,
          options: fieldType === "dropdown" ? options || [] : [],
          position: position ?? existingCount,
        },
      });

      res.status(201).json(field);
    } catch (error) {
      res.status(500).json({ error: "Failed to create custom field." });
    }
  },
);

/**
 * @swagger
 * /api/custom-fields/{id}:
 *   put:
 *     summary: Update a custom field definition
 *     tags: [Custom Fields]
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
 *               fieldType:
 *                 type: string
 *                 enum: [text, number, date, dropdown]
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *               position:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Custom field updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Custom field not found
 */
router.put(
  "/:id",
  authMiddleware,
  validate(updateCustomFieldSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, fieldType, options, position } = req.body;

      const existing = await prisma.customField.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });

      if (!existing) {
        res.status(404).json({ error: "Custom field not found." });
        return;
      }

      // Determine the effective fieldType (use new if provided, else existing)
      const effectiveFieldType = fieldType || existing.fieldType;

      // If changing to dropdown, must have options
      if (
        effectiveFieldType === "dropdown" &&
        fieldType === "dropdown" &&
        (!options || options.length === 0) &&
        existing.options.length === 0
      ) {
        res.status(400).json({
          error: "Dropdown fields must have at least one option.",
        });
        return;
      }

      const data: any = {};
      if (name !== undefined) data.name = name;
      if (fieldType !== undefined) data.fieldType = fieldType;
      if (options !== undefined) {
        data.options = effectiveFieldType === "dropdown" ? options : [];
      }
      if (position !== undefined) data.position = position;

      const updated = await prisma.customField.update({
        where: { id: req.params.id },
        data,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update custom field." });
    }
  },
);

/**
 * @swagger
 * /api/custom-fields/{id}:
 *   delete:
 *     summary: Delete a custom field definition (and all its values)
 *     tags: [Custom Fields]
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
 *         description: Custom field deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Custom field not found
 */
router.delete(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await prisma.customField.deleteMany({
        where: { id: req.params.id, userId: req.userId! },
      });

      if (result.count === 0) {
        res.status(404).json({ error: "Custom field not found." });
        return;
      }

      res.json({ message: "Custom field deleted." });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete custom field." });
    }
  },
);

// --- Custom Field Values on Contacts ---

/**
 * @swagger
 * /api/custom-fields/contacts/{contactId}/values:
 *   get:
 *     summary: Get custom field values for a contact
 *     tags: [Custom Fields]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Custom field values for the contact
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Contact not found
 */
router.get(
  "/contacts/:contactId/values",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Verify the contact belongs to the user
      const contact = await prisma.customer.findFirst({
        where: { id: req.params.contactId, userId: req.userId! },
      });

      if (!contact) {
        res.status(404).json({ error: "Contact not found." });
        return;
      }

      const values = await prisma.customFieldValue.findMany({
        where: { contactId: req.params.contactId },
        include: { customField: true },
      });

      res.json(values);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch custom field values." });
    }
  },
);

/**
 * @swagger
 * /api/custom-fields/contacts/{contactId}/values:
 *   put:
 *     summary: Set/update custom field values for a contact (upsert)
 *     tags: [Custom Fields]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
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
 *               values:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     customFieldId:
 *                       type: string
 *                     value:
 *                       type: string
 *     responses:
 *       200:
 *         description: Custom field values updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Contact not found
 */
router.put(
  "/contacts/:contactId/values",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { values } = req.body;

      if (!Array.isArray(values)) {
        res.status(400).json({ error: "Values must be an array." });
        return;
      }

      // Verify the contact belongs to the user
      const contact = await prisma.customer.findFirst({
        where: { id: req.params.contactId, userId: req.userId! },
      });

      if (!contact) {
        res.status(404).json({ error: "Contact not found." });
        return;
      }

      // Validate each entry has customFieldId and value
      for (const entry of values) {
        if (!entry.customFieldId || entry.value === undefined) {
          res.status(400).json({
            error:
              "Each value entry must have customFieldId and value properties.",
          });
          return;
        }
      }

      // Verify all custom fields belong to the user
      const fieldIds = values.map((v: any) => v.customFieldId);
      const fields = await prisma.customField.findMany({
        where: { id: { in: fieldIds }, userId: req.userId! },
      });

      if (fields.length !== fieldIds.length) {
        res.status(400).json({
          error: "One or more custom field IDs are invalid.",
        });
        return;
      }

      // Validate dropdown values against options
      for (const entry of values) {
        const field = fields.find((f) => f.id === entry.customFieldId);
        if (
          field &&
          field.fieldType === "dropdown" &&
          entry.value !== "" &&
          !field.options.includes(entry.value)
        ) {
          res.status(400).json({
            error: `Value "${entry.value}" is not a valid option for field "${field.name}".`,
          });
          return;
        }
      }

      // Upsert each value
      const results = await Promise.all(
        values.map((entry: { customFieldId: string; value: string }) =>
          prisma.customFieldValue.upsert({
            where: {
              customFieldId_contactId: {
                customFieldId: entry.customFieldId,
                contactId: req.params.contactId,
              },
            },
            update: { value: entry.value },
            create: {
              customFieldId: entry.customFieldId,
              contactId: req.params.contactId,
              value: entry.value,
            },
          }),
        ),
      );

      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to update custom field values." });
    }
  },
);

export default router;
