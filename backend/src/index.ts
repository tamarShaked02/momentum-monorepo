import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import swaggerSpec from "./config/swagger.js";
import { generalLimiter } from "./middleware/rateLimit.js";
import authRoutes from "./routes/auth.js";
import onboardingRoutes from "./routes/onboarding.js";
import aiRoutes from "./routes/ai.js";
import dashboardRoutes from "./routes/dashboard.js";
import appointmentsRoutes from "./routes/appointments.js";
import customersRoutes from "./routes/customers.js";
import inventoryRoutes from "./routes/inventory.js";
import tasksRoutes from "./routes/tasks.js";
import marketingRoutes from "./routes/marketing.js";
import telegramRoutes from "./routes/telegram.js";
import googleCalendarRoutes from "./routes/googleCalendar.js";
import pipelinesRoutes from "./routes/pipelines.js";
import dealsRoutes from "./routes/deals.js";
import activitiesRoutes from "./routes/activities.js";
import customFieldsRoutes from "./routes/customFields.js";
import automationRulesRoutes from "./routes/automationRules.js";
import crmDashboardRoutes from "./routes/crmDashboard.js";
import crmSuggestionsRoutes from "./routes/crmSuggestions.js";
import "./services/automationEngine.js"; // Self-registers event listeners on import
import bot from "./telegram/bot.js";

const app = express();

// Trust reverse proxy (Nginx) for accurate IP tracking in rate limiter
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());
app.use(generalLimiter);

// Swagger UI
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Momentum API Docs",
    swaggerOptions: { persistAuthorization: true },
  }),
);
// Raw OpenAPI spec JSON
app.get("/api/docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/marketing", marketingRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/google-calendar", googleCalendarRoutes);
app.use("/api/pipelines", pipelinesRoutes);
app.use("/api/deals", dealsRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api/custom-fields", customFieldsRoutes);
app.use("/api/automation-rules", automationRulesRoutes);
app.use("/api/crm/dashboard", crmDashboardRoutes);
app.use("/api/crm", crmSuggestionsRoutes);

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "Momentum API is running", version: "1.0.0" });
});

app.listen(env.PORT, () => {
  console.log(`🚀 Momentum API running on port ${env.PORT}`);
});

// Start Telegram bot
if (bot) {
  if (env.NODE_ENV === "production") {
    const webhookUrl = `${env.BACKEND_URL}/telegram/webhook`;
    bot.telegram.setWebhook(webhookUrl)
      .then(() => console.log(`🤖 Telegram webhook set to ${webhookUrl}`))
      .catch((err) => console.error("Failed to set Telegram webhook:", err));
  } else {
    // Polling for development
    bot.launch().then(() => console.log("🤖 Telegram bot is running in polling mode..."));
  }
}

export default app;
