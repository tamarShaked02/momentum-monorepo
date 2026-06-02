import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import prisma from '../config/db.js';

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Task management endpoints
 */

const router = Router();

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: List all tasks for the authenticated user
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_progress, done]
 *         description: Filter by status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: List of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, category } = req.query;
    const where: any = { userId: req.userId! };
    if (status) where.status = status as string;
    if (category) where.category = category as string;
    const tasks = await prisma.task.findMany({ where, orderBy: [{ status: 'asc' }, { priority: 'asc' }, { dueDate: 'asc' }] });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
});

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TaskBody'
 *     responses:
 *       201:
 *         description: Task created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Title is required
 *       401:
 *         description: Unauthorized
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, status, priority, category, dueDate } = req.body;
    if (!title) { res.status(400).json({ error: 'Title is required.' }); return; }
    const task = await prisma.task.create({
      data: { userId: req.userId!, title, description: description || null, status: status || 'pending', priority: priority || 'medium', category: category || null, dueDate: dueDate ? new Date(dueDate) : null },
    });
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     summary: Update a task
 *     tags: [Tasks]
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
 *             $ref: '#/components/schemas/TaskBody'
 *     responses:
 *       200:
 *         description: Updated task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, status, priority, category, dueDate } = req.body;
    const result = await prisma.task.updateMany({
      where: { id: req.params.id, userId: req.userId! },
      data: { ...(title !== undefined && { title }), ...(description !== undefined && { description }), ...(status !== undefined && { status }), ...(priority !== undefined && { priority }), ...(category !== undefined && { category }), ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }) },
    });
    if (result.count === 0) { res.status(404).json({ error: 'Not found.' }); return; }
    const updated = await prisma.task.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   delete:
 *     summary: Delete a task
 *     tags: [Tasks]
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
 *         description: Task deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await prisma.task.deleteMany({ where: { id: req.params.id, userId: req.userId! } });
    if (result.count === 0) { res.status(404).json({ error: 'Not found.' }); return; }
    res.json({ message: 'Task deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

export default router;
