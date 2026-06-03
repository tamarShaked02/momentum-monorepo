import dotenv from "dotenv";
dotenv.config();

export const env = {
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/momentum",
  JWT_SECRET: process.env.JWT_SECRET || "momentum-default-secret",
  BOT_TOKEN: process.env.BOT_TOKEN || null,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  PORT: parseInt(process.env.PORT || "3000", 10),
  USE_MOCK_AI: process.env.USE_MOCK_AI === "true",
  NODE_ENV: process.env.NODE_ENV || "development",
};
