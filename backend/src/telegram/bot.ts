import { Telegraf } from "telegraf";
import { env } from "../config/env.js";
import prisma from "../config/db.js";
import { logTelegramActivity } from "../services/telegramActivityLogger.js";
import { interpretCommand } from "../ai/aiInterpreter.js";
import { commandEngine } from "../ai/commandEngine.js";

const bot = env.BOT_TOKEN ? new Telegraf(env.BOT_TOKEN) : null;

// Map to store pending confirmation tokens per chatId
const pendingConfirmations = new Map<string, string>();

if (bot) {
  bot.start((ctx) => {
    ctx.reply(
      "Welcome to Momentum! 🚀\nI am your unified AI Business Assistant. You can send me natural language commands to schedule appointments, manage tasks, check inventory, add customers, view analytics, and more!\n\nExamples:\n• 'Book haircut for tomorrow at 3pm'\n• 'Add a new task: Send marketing email'\n• 'Search for customer Jane'",
    );
  });

  // Handle inline keyboard button clicks
  bot.on("callback_query", async (ctx) => {
    const data = (ctx.callbackQuery as any).data;
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    const token = pendingConfirmations.get(chatId);
    if (!token) {
      await ctx.reply("No pending action found or confirmation expired.");
      await ctx.answerCbQuery();
      return;
    }

    pendingConfirmations.delete(chatId);

    // Get the user by telegramChatId for bot operations
    const user = await prisma.user.findFirst({ where: { telegramChatId: chatId } });
    if (!user) {
      await ctx.reply("Error: Your account is not linked. Please send a message to link your account.");
      await ctx.answerCbQuery();
      return;
    }
    const businessUserId = user.id;

    try {
      const confirmed = data === "confirm_yes";
      const result = await commandEngine.confirm(token, confirmed, businessUserId);

      let replyText = "";
      if (result.success) {
        if (confirmed) {
          replyText = `✅ Action completed successfully!\n${result.message}`;
          if (result.data) {
            replyText += `\n\nDetails:\n${JSON.stringify(result.data, null, 2)}`;
          }
        } else {
          replyText = `❌ Action cancelled.\n${result.message}`;
        }
      } else {
        replyText = `⚠️ Error performing action: ${result.message}`;
      }

      await ctx.reply(replyText);

      // Log outbound activity
      await logTelegramActivity({
        userId: businessUserId,
        direction: "outbound",
        text: replyText,
      });
    } catch (err) {
      console.error("Callback query handling error:", err);
      await ctx.reply("An error occurred during confirmation.");
    }

    await ctx.answerCbQuery();
  });

  bot.on("contact", async (ctx) => {
    const contact = ctx.message.contact;
    const chatId = ctx.chat.id.toString();

    if (!contact.phone_number) {
      await ctx.reply("Invalid contact shared.");
      return;
    }

    const phoneNumber = contact.phone_number.replace(/\D/g, "");
    
    // Find matching user by phone
    const usersWithPhone = await prisma.user.findMany({ where: { phone: { not: null } } });
    const matchedUser = usersWithPhone.find(u => {
      const dbPhone = u.phone!.replace(/\D/g, "");
      return dbPhone === phoneNumber || phoneNumber.endsWith(dbPhone) || dbPhone.endsWith(phoneNumber);
    });

    if (matchedUser) {
      await prisma.user.update({
        where: { id: matchedUser.id },
        data: { telegramChatId: chatId }
      });
      await ctx.reply("✅ Account successfully linked! You can now send me commands like 'Add a task' or 'Check my schedule'.", {
        reply_markup: { remove_keyboard: true }
      });
    } else {
      await ctx.reply(`❌ No business account found with the phone number ${contact.phone_number}.\n\nPlease update your phone number in the Momentum web settings and share your contact again.`, {
        reply_markup: { remove_keyboard: true }
      });
    }
  });

  // Handle all text messages
  bot.on("text", async (ctx) => {
    const text = ctx.message.text;
    const chatId = ctx.chat.id.toString();
    const userName =
      ctx.from.first_name +
      (ctx.from.last_name ? " " + ctx.from.last_name : "");

    try {
      const user = await prisma.user.findFirst({ where: { telegramChatId: chatId } });
      if (!user) {
        await ctx.reply("Your Telegram account is not linked to a Momentum business account. Please click the button below to share your phone number so we can link your account.", {
          reply_markup: {
            keyboard: [
              [{ text: "📱 Share Contact to Link Account", request_contact: true }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        });
        return;
      }
      const businessUserId = user.id;

      // Log inbound Telegram message activity
      await logTelegramActivity({
        userId: businessUserId,
        direction: "inbound",
        text,
      });

      // Process command via AI Interpreter
      const interpretResult = await interpretCommand(text, businessUserId);

      if (interpretResult.type === "function_call" && interpretResult.functionCall) {
        const result = await commandEngine.execute(interpretResult.functionCall, businessUserId);

        if (result.type === "confirmation_required") {
          pendingConfirmations.set(chatId, result.confirmationToken || "");
          const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const replyText = `⚠️ <b>Confirmation Required</b>\n${escapeHtml(result.confirmationDescription || "Are you sure you want to proceed?")}`;
          
          await ctx.reply(replyText, {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "👍 Yes, proceed", callback_data: "confirm_yes" },
                  { text: "👎 No, cancel", callback_data: "confirm_no" },
                ],
              ],
            },
          });

          await logTelegramActivity({
            userId: businessUserId,
            direction: "outbound",
            text: replyText,
          });
        } else if (result.success) {
          const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          let replyText = `✅ <b>Command Executed</b>\n${escapeHtml(result.message)}`;
          if (result.data) {
            replyText += `\n\n<b>Result Details</b>:\n<pre><code class="language-json">${escapeHtml(JSON.stringify(result.data, null, 2))}</code></pre>`;
          }

          await ctx.reply(replyText, { parse_mode: "HTML" });

          await logTelegramActivity({
            userId: businessUserId,
            direction: "outbound",
            text: replyText,
          });
        } else {
          const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const replyText = `❌ <b>Error</b>: ${escapeHtml(result.message)}`;
          await ctx.reply(replyText, { parse_mode: "HTML" });

          await logTelegramActivity({
            userId: businessUserId,
            direction: "outbound",
            text: replyText,
          });
        }
      } else if (interpretResult.type === "clarification" && interpretResult.clarification) {
        const replyText = interpretResult.clarification.message;
        await ctx.reply(replyText);

        await logTelegramActivity({
          userId: businessUserId,
          direction: "outbound",
          text: replyText,
        });
      } else {
        const replyText = interpretResult.unknownMessage || "I'm sorry, I didn't catch that. Try asking to book an appointment or check list of tasks.";
        await ctx.reply(replyText);

        await logTelegramActivity({
          userId: businessUserId,
          direction: "outbound",
          text: replyText,
        });
      }
    } catch (error) {
      console.error("Telegram bot error:", error);
      await ctx.reply("Sorry, something went wrong. Please try again.");
    }
  });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

export default bot;
