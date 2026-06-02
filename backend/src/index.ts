import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import swaggerSpec from './config/swagger.js';
import authRoutes from './routes/auth.js';
import onboardingRoutes from './routes/onboarding.js';
import aiRoutes from './routes/ai.js';
import dashboardRoutes from './routes/dashboard.js';
import appointmentsRoutes from './routes/appointments.js';
import customersRoutes from './routes/customers.js';
import inventoryRoutes from './routes/inventory.js';
import tasksRoutes from './routes/tasks.js';
import marketingRoutes from './routes/marketing.js';
import telegramRoutes from './routes/telegram.js';
import bot from './telegram/bot.js';

const app = express();

app.use(cors());
app.use(express.json());

// Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Momentum API Docs',
  swaggerOptions: { persistAuthorization: true },
}));
// Raw OpenAPI spec JSON
app.get('/api/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/telegram', telegramRoutes);

// Health check
app.get('/', (_req, res) => {
  res.json({ status: 'Momentum API is running', version: '1.0.0' });
});

// Google Calendar sync placeholder
app.post('/api/appointments/sync', (_req, res) => {
  res.json({ message: 'Google Calendar sync is a placeholder for future implementation.' });
});

app.listen(env.PORT, () => {
  console.log(`🚀 Momentum API running on port ${env.PORT}`);
});

// Start Telegram bot in polling mode for development
if (bot && env.NODE_ENV !== 'production') {
  bot.launch().then(() => console.log('🤖 Telegram bot is running...'));
}

export default app;
