import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSystemPrompt } from "../prompts/systemPrompt.js";

// Initialize Gemini client
const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  // Allow proceeding even without a key if we are going to use mock
  if (!apiKey && process.env.USE_MOCK_AI !== "true") {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }
  if (!apiKey) return null; // Handle mock case where no key is present
  return new GoogleGenerativeAI(apiKey);
};

const getMockResponse = (userDescription) => {
  // Simple heuristic for mock response
  const modules = [
    { id: "crm", reason: "Essential for managing client relationships." },
    { id: "tasks", reason: "Needed for operational workflow management." },
  ];

  if (
    userDescription.toLowerCase().includes("appointment") ||
    userDescription.toLowerCase().includes("schedul")
  ) {
    modules.push({
      id: "scheduling",
      reason: "Detected appointment needs from your description.",
    });
  }
  if (
    userDescription.toLowerCase().includes("sell") ||
    userDescription.toLowerCase().includes("product") ||
    userDescription.toLowerCase().includes("inventory")
  ) {
    modules.push({
      id: "inventory",
      reason: "Detected product/sales needs from your description.",
    });
  }

  return {
    recommended_modules: modules,
    summary:
      "I've analyzed your request and enabled a mock configuration for testing purposes (AI Quota Exceeded or Mock Mode enabled).",
  };
};

export const analyzeBusiness = async (userDescription) => {
  // Explicit mock mode
  if (process.env.USE_MOCK_AI === "true") {
    console.log("Using Mock AI Service");
    return getMockResponse(userDescription);
  }

  try {
    const genAI = getClient();
    if (!genAI) return getMockResponse(userDescription);

    // Use the available model found via list_models.js
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const systemPrompt = getSystemPrompt();

    const prompt = `${systemPrompt}\n\nUSER INPUT: "${userDescription}"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const cleanText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("Error in AI analysis:", error.message);

    // Debugging: List available models if the requested one is not found
    if (error.message.includes("404") || error.message.includes("not found")) {
      try {
        console.log("Attempting to list available models...");
        const genAI = getClient(); // Re-get client
        /* 
                   Note: The Node SDK might not expose listModels directly on the main instance 
                   depending on version, but typically it's configured on the GoogleGenerativeAI instance?
                   Actually, looking at SDK docs, usually it's a separate manager or via REST.
                   Let's stick to simple logging for now to avoid breaking more things.
                */
      } catch (listError) {
        console.error("Could not list models:", listError);
      }
    }

    return getMockResponse(userDescription);
  }
};
