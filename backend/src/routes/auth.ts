import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import { env } from "../config/env.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Email and password are required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: User with this email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/register",
  authLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { email, password, businessName } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required." });
        return;
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        res
          .status(409)
          .json({ error: "A user with this email already exists." });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          businessName: businessName || null,
        },
      });

      const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
        expiresIn: "7d",
      });

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          businessName: user.businessName,
          businessType: user.businessType,
        },
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: "Failed to register user." });
    }
  },
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in and receive a JWT token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Email and password are required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/login",
  authLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required." });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { moduleConfig: true },
      });

      if (!user) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }

      const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
        expiresIn: "7d",
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          businessName: user.businessName,
          businessType: user.businessType,
          moduleConfig: user.moduleConfig,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to log in." });
    }
  },
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get the currently authenticated user's profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 email: { type: string }
 *                 businessName: { type: string, nullable: true }
 *                 businessType: { type: string, nullable: true }
 *                 moduleConfig: { type: object, nullable: true }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get(
  "/me",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        include: { moduleConfig: true },
      });

      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      res.json({
        id: user.id,
        email: user.email,
        businessName: user.businessName,
        businessType: user.businessType,
        phone: user.phone,
        moduleConfig: user.moduleConfig,
      });
    } catch (error) {
      console.error("Get me error:", error);
      res.status(500).json({ error: "Failed to retrieve user profile." });
    }
  },
);

/**
 * PUT /api/auth/profile
 * Update the authenticated user's profile (business name).
 */
router.put(
  "/profile",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { businessName, phone } = req.body;

      const user = await prisma.user.update({
        where: { id: req.userId! },
        data: {
          ...(businessName !== undefined && { businessName }),
          ...(phone !== undefined && { phone }),
        },
        select: {
          id: true,
          email: true,
          businessName: true,
          businessType: true,
          phone: true,
        },
      });

      res.json(user);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Failed to update profile." });
    }
  },
);

/**
 * PUT /api/auth/password
 * Change the authenticated user's password.
 */
router.put(
  "/password",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res
          .status(400)
          .json({ error: "Current and new password are required." });
        return;
      }

      if (newPassword.length < 6) {
        res
          .status(400)
          .json({ error: "New password must be at least 6 characters." });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: req.userId! } });
      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        res.status(401).json({ error: "Current password is incorrect." });
        return;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: req.userId! },
        data: { password: hashedPassword },
      });

      res.json({ message: "Password changed successfully." });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password." });
    }
  },
);

export default router;
