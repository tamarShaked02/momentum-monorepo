import swaggerJSDoc from 'swagger-jsdoc';
import { env } from './env.js';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Momentum API',
      version: '1.0.0',
      description:
        'AI-powered business management platform API — covering auth, CRM, inventory, tasks, appointments, marketing, and more.',
      contact: {
        name: 'Momentum Support',
      },
    },
    servers: [
      {
        url: env.BACKEND_URL,
        description: 'API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token (obtained from /api/auth/login or /api/auth/register)',
        },
      },
      schemas: {
        // ── Auth ──────────────────────────────────────────────────
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'owner@mybiz.com' },
            password: { type: 'string', minLength: 6, example: 'secret123' },
            businessName: { type: 'string', example: 'My Business' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'owner@mybiz.com' },
            password: { type: 'string', example: 'secret123' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5...' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                businessName: { type: 'string', nullable: true },
                businessType: { type: 'string', nullable: true },
                moduleConfig: { type: 'object', nullable: true },
              },
            },
          },
        },
        // ── Task ─────────────────────────────────────────────────
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            title: { type: 'string', example: 'Follow up with client' },
            description: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['pending', 'in_progress', 'done'], example: 'pending' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'], example: 'medium' },
            category: { type: 'string', nullable: true, example: 'sales' },
            dueDate: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        TaskBody: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', example: 'Follow up with client' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'done'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            category: { type: 'string' },
            dueDate: { type: 'string', format: 'date-time' },
          },
        },
        // ── Customer ──────────────────────────────────────────────
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            name: { type: 'string', example: 'Jane Doe' },
            email: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            telegramChatId: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CustomerBody: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'Jane Doe' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            telegramChatId: { type: 'string' },
            notes: { type: 'string' },
          },
        },
        // ── Inventory ─────────────────────────────────────────────
        InventoryItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            name: { type: 'string', example: 'Blue T-Shirt (M)' },
            sku: { type: 'string', nullable: true },
            quantity: { type: 'integer', example: 42 },
            lowThreshold: { type: 'integer', example: 5 },
            price: { type: 'number', format: 'float', nullable: true, example: 29.99 },
            category: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        InventoryBody: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'Blue T-Shirt (M)' },
            sku: { type: 'string' },
            quantity: { type: 'integer', example: 42 },
            lowThreshold: { type: 'integer', example: 5 },
            price: { type: 'number', format: 'float', example: 29.99 },
            category: { type: 'string' },
          },
        },
        // ── Appointment ───────────────────────────────────────────
        Appointment: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            customerId: { type: 'string', nullable: true },
            title: { type: 'string', example: 'Haircut' },
            description: { type: 'string', nullable: true },
            startTime: { type: 'string', format: 'date-time' },
            endTime: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['scheduled', 'completed', 'cancelled'], example: 'scheduled' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        AppointmentBody: {
          type: 'object',
          required: ['title', 'startTime', 'endTime'],
          properties: {
            title: { type: 'string', example: 'Haircut' },
            description: { type: 'string' },
            customerId: { type: 'string' },
            startTime: { type: 'string', format: 'date-time' },
            endTime: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['scheduled', 'completed', 'cancelled'] },
          },
        },
        // ── Marketing ─────────────────────────────────────────────
        MarketingCampaign: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            name: { type: 'string', example: 'Summer Sale' },
            goal: { type: 'string', nullable: true },
            status: { type: 'string', example: 'draft' },
            channels: { type: 'array', items: { type: 'string' }, example: ['sms', 'email'] },
            smsContent: { type: 'string', nullable: true },
            emailContent: { type: 'string', nullable: true },
            socialContent: { type: 'string', nullable: true },
            scheduledAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        MarketingCampaignBody: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'Summer Sale' },
            goal: { type: 'string' },
            status: { type: 'string' },
            channels: { type: 'array', items: { type: 'string' } },
            smsContent: { type: 'string' },
            emailContent: { type: 'string' },
            socialContent: { type: 'string' },
            scheduledAt: { type: 'string', format: 'date-time' },
          },
        },
        // ── Shared ────────────────────────────────────────────────
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Something went wrong.' },
          },
        },
        MessageResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Operation successful.' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Scan all route files for JSDoc annotations
  apis: ['./src/routes/*.ts', './src/index.ts'],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
