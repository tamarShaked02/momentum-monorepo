import dotenv from "dotenv";
dotenv.config();

const PORT = parseInt(process.env.PORT || "3000", 10);
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

export const env = {
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/momentum",
  JWT_SECRET: process.env.JWT_SECRET || "momentum-default-secret",
  BOT_TOKEN: process.env.BOT_TOKEN || null,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  PORT,
  USE_MOCK_AI: process.env.USE_MOCK_AI === "true",
  NODE_ENV: process.env.NODE_ENV || "development",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  BACKEND_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_REDIRECT_URI:
    process.env.GOOGLE_REDIRECT_URI ||
    `${BACKEND_URL}/api/google-calendar/callback`,
};
