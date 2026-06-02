import "dotenv/config";
import express from "express";
import cors from "cors";
import onboardingRoutes from "./routes/onboarding.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/onboarding", onboardingRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "momentum-core",
    timestamp: new Date().toISOString(),
    port: PORT,
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.send("Momentum Core Service is running.");
});

app.listen(PORT, () => {
  console.log(`Momentum Core Service is running on port ${PORT}`);
});
