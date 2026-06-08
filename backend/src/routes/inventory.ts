import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createInventoryItemSchema } from "../validation/schemas.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import prisma from "../config/db.js";
import { checkAndCreateRestockTask } from "../services/inventoryTaskSync.js";

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Inventory management endpoints
 */

const router = Router();

/**
 * @swagger
 * /api/inventory:
 *   get:
 *     summary: List inventory items
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lowStock
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: If 'true', only return items at or below their low threshold
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: List of inventory items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/InventoryItem'
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { lowStock, category } = req.query;
      const where: any = {
        userId: req.userId!,
        ...(category ? { category: category as string } : {}),
      };

      const pagination = getPagination(req);

      if (lowStock === "true") {
        // Low stock filter: fetch all then filter (threshold is per-item)
        const items = await prisma.inventoryItem.findMany({
          where,
          orderBy: { name: "asc" },
        });
        const filtered = items.filter((i) => i.quantity <= i.lowThreshold);
        if (pagination) {
          const paged = filtered.slice(
            pagination.skip,
            pagination.skip + pagination.take,
          );
          res.json(paginatedResponse(paged, filtered.length, pagination));
        } else {
          res.json(filtered);
        }
        return;
      }

      if (pagination) {
        const [items, total] = await Promise.all([
          prisma.inventoryItem.findMany({
            where,
            orderBy: { name: "asc" },
            skip: pagination.skip,
            take: pagination.take,
          }),
          prisma.inventoryItem.count({ where }),
        ]);
        res.json(paginatedResponse(items, total, pagination));
      } else {
        const items = await prisma.inventoryItem.findMany({
          where,
          orderBy: { name: "asc" },
        });
        res.json(items);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inventory." });
    }
  },
);

/**
 * @swagger
 * /api/inventory:
 *   post:
 *     summary: Create a new inventory item
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InventoryBody'
 *     responses:
 *       201:
 *         description: Inventory item created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       400:
 *         description: Item name is required
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  authMiddleware,
  validate(createInventoryItemSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, sku, quantity, lowThreshold, price, category } = req.body;
      if (!name) {
        res.status(400).json({ error: "Item name is required." });
        return;
      }
      const item = await prisma.inventoryItem.create({
        data: {
          userId: req.userId!,
          name,
          sku: sku || null,
          quantity: quantity || 0,
          lowThreshold: lowThreshold || 5,
          price: price || null,
          category: category || null,
        },
      });
      // Record initial stock
      if (quantity && quantity > 0) {
        await prisma.inventoryHistory.create({
          data: {
            inventoryItemId: item.id,
            changeType: "restock",
            quantityChange: quantity,
            previousQty: 0,
            newQty: quantity,
            note: "Initial stock",
          },
        });
      }
      await checkAndCreateRestockTask(
        req.userId!,
        item.id,
        item.name,
        item.quantity,
        item.lowThreshold,
      );
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to create inventory item." });
    }
  },
);

/**
 * @swagger
 * /api/inventory/{id}:
 *   put:
 *     summary: Update an inventory item
 *     tags: [Inventory]
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
 *             $ref: '#/components/schemas/InventoryBody'
 *     responses:
 *       200:
 *         description: Updated inventory item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
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
      const existing = await prisma.inventoryItem.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!existing) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      const { name, sku, quantity, lowThreshold, price, category } = req.body;
      const previousQty = existing.quantity;
      const updated = await prisma.inventoryItem.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(sku !== undefined && { sku }),
          ...(quantity !== undefined && { quantity }),
          ...(lowThreshold !== undefined && { lowThreshold }),
          ...(price !== undefined && { price }),
          ...(category !== undefined && { category }),
        },
      });
      // Record quantity change
      if (quantity !== undefined && quantity !== previousQty) {
        const changeType = quantity > previousQty ? "restock" : "sale";
        await prisma.inventoryHistory.create({
          data: {
            inventoryItemId: updated.id,
            changeType,
            quantityChange: quantity - previousQty,
            previousQty,
            newQty: quantity,
          },
        });
        await checkAndCreateRestockTask(
          req.userId!,
          updated.id,
          updated.name,
          updated.quantity,
          updated.lowThreshold,
        );
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update inventory item." });
    }
  },
);

/**
 * @swagger
 * /api/inventory/{id}:
 *   delete:
 *     summary: Delete an inventory item
 *     tags: [Inventory]
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
 *         description: Item deleted
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
      const result = await prisma.inventoryItem.deleteMany({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (result.count === 0) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      res.json({ message: "Item deleted." });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete inventory item." });
    }
  },
);

export default router;
