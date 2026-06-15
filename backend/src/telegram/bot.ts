import { Telegraf } from "telegraf";
import { env } from "../config/env.js";
import prisma from "../config/db.js";
import { logTelegramActivity } from "../services/telegramActivityLogger.js";

const bot = env.BOT_TOKEN ? new Telegraf(env.BOT_TOKEN) : null;

if (bot) {
  bot.start((ctx) => {
    ctx.reply(
      'Welcome to Momentum! 🚀\nSend me a message to book an appointment.\nFormat: "Book [service] on [date] at [time]"\nExample: "Book manicure on Friday at 2pm"',
    );
  });

  bot.on("text", async (ctx) => {
    const text = ctx.message.text;
    const chatId = ctx.chat.id.toString();
    const userName =
      ctx.from.first_name +
      (ctx.from.last_name ? " " + ctx.from.last_name : "");

    try {
      // Find or create customer by telegram chat ID
      // We need to find a user (business owner) who has this bot configured
      // For MVP, we use the first user or a default user
      const users = await prisma.user.findMany({ take: 1 });
      if (users.length === 0) {
        await ctx.reply("No business is set up yet. Please try again later.");
        return;
      }
      const businessUserId = users[0].id;

      let customer = await prisma.customer.findFirst({
        where: { telegramChatId: chatId, userId: businessUserId },
      });
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            userId: businessUserId,
            name: userName,
            telegramChatId: chatId,
          },
        });
      }

      // Log inbound Telegram message activity
      await logTelegramActivity({
        userId: businessUserId,
        contactId: customer.id,
        direction: "inbound",
        text,
      });

      // Simple booking parser
      const bookingRegex =
        /book\s+(.+?)\s+(?:on\s+)?(.+?)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
      const match = text.match(bookingRegex);

      if (match) {
        const [, service, dateStr, timeStr] = match;
        const now = new Date();
        // Simple date parsing
        let appointmentDate = new Date();
        const lower = dateStr.toLowerCase().trim();
        if (lower === "tomorrow") {
          appointmentDate.setDate(appointmentDate.getDate() + 1);
        } else if (lower === "today") {
          // keep today
        } else {
          const days = [
            "sunday",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
          ];
          const dayIdx = days.indexOf(lower);
          if (dayIdx >= 0) {
            const currentDay = appointmentDate.getDay();
            const diff = (dayIdx - currentDay + 7) % 7 || 7;
            appointmentDate.setDate(appointmentDate.getDate() + diff);
          }
        }

        // Parse time
        let hours = parseInt(timeStr);
        if (timeStr.toLowerCase().includes("pm") && hours < 12) hours += 12;
        if (timeStr.toLowerCase().includes("am") && hours === 12) hours = 0;
        appointmentDate.setHours(hours, 0, 0, 0);

        const endTime = new Date(appointmentDate);
        endTime.setHours(endTime.getHours() + 1);

        const appointment = await prisma.appointment.create({
          data: {
            userId: businessUserId,
            customerId: customer.id,
            title: service.trim(),
            startTime: appointmentDate,
            endTime: endTime,
            status: "scheduled",
            source: "telegram",
            notes: `Booked via Telegram by ${userName}`,
          },
        });

        const confirmationMsg = `✅ Appointment booked!\n📋 Service: ${service.trim()}\n📅 Date: ${appointmentDate.toLocaleDateString()}\n🕐 Time: ${appointmentDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}\n\nSee you then! 🎉`;
        await ctx.reply(confirmationMsg);

        // Log outbound reply activity
        await logTelegramActivity({
          userId: businessUserId,
          contactId: customer.id,
          direction: "outbound",
          text: confirmationMsg,
        });
      } else {
        const helpMsg =
          'To book an appointment, send:\n"Book [service] on [day] at [time]"\n\nExample: "Book manicure on Friday at 2pm"';
        await ctx.reply(helpMsg);

        // Log outbound reply activity
        await logTelegramActivity({
          userId: businessUserId,
          contactId: customer.id,
          direction: "outbound",
          text: helpMsg,
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
