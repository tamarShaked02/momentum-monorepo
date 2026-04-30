import { Telegraf } from "telegraf";
import "dotenv/config";

// 2. Initialize the bot with the token from BotFather
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply(
    "Welcome! Send me a description of your business, and I will find the right project modules for you.",
  );
});

// 3. Listen for incoming text messages
bot.on("text", async (ctx) => {
  const userDescription = ctx.message.text;

  // Send a temporary status message
  const processingMsg = await ctx.reply(
    "Analyzing your business description... ⏳",
  );

  try {
    // 4. Send the POST request to your API
    const response = await fetch(
      "http://localhost:3000/api/onboarding/analyze",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description: userDescription }),
      },
    );

    if (!response.ok) {
      throw new Error(`API returned status: ${response.status}`);
    }

    const data = await response.json();

    // 5. Format the API response for Telegram
    let replyText = `*Summary:*\n${data.summary}\n\n*Recommended Modules:*\n`;
    console.log(data);
    data.recommended_modules.forEach((mod) => {
      replyText += `• *Module ID:* ${mod.id}\n  *Reason:* ${mod.reason}\n\n`;
    });

    // 6. Send the final result back (using Markdown for formatting)
    await ctx.replyWithMarkdown(replyText);
  } catch (error) {
    console.error("Error fetching modules:", error);
    await ctx.reply(
      "Oops! I encountered an error while analyzing your request. Please try again later.",
    );
  } finally {
    // Optional: Clean up by deleting the "Analyzing..." message
    try {
      await ctx.deleteMessage(processingMsg.message_id);
    } catch (e) {
      // Ignore if the message couldn't be deleted
    }
  }
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

export default bot;
