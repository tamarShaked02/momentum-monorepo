import { Telegraf } from "telegraf";
import { env } from "../config/env.js";
import prisma from "../config/db.js";
import { logTelegramActivity } from "../services/telegramActivityLogger.js";
import { interpretCommand } from "../ai/aiInterpreter.js";
import { commandEngine } from "../ai/commandEngine.js";

const bot = env.BOT_TOKEN ? new Telegraf(env.BOT_TOKEN) : null;

// Map to store pending confirmation tokens per chatId (for business owner)
const pendingConfirmations = new Map<string, string>();

// Map to store customer appointment booking state per chatId
type BookingState = {
  step: "awaiting_date" | "awaiting_time" | "awaiting_title" | "confirming";
  date?: string;
  time?: string;
  title?: string;
  customerId: string;
  userId: string;
};
const customerBookingState = new Map<string, BookingState>();

// ─── Persona Management ──────────────────────────────────────────────────────
export type ActivePersona =
  | { type: "owner"; id: string; businessName: string }
  | { type: "customer"; id: string; userId: string; businessName: string; customerName: string };

const activePersonas = new Map<string, ActivePersona>();

async function getAvailablePersonas(chatId: string) {
  const owners = await prisma.user.findMany({ where: { telegramChatId: chatId } });
  const customers = await prisma.customer.findMany({
    where: { telegramChatId: chatId },
    include: { user: { select: { id: true, businessName: true } } },
  });
  return { owners, customers };
}

async function getActivePersona(chatId: string): Promise<ActivePersona | null> {
  let persona = activePersonas.get(chatId);
  if (!persona) {
    const { owners, customers } = await getAvailablePersonas(chatId);
    if (owners.length > 0) {
      persona = { type: "owner", id: owners[0].id, businessName: owners[0].businessName || "Business" };
    } else if (customers.length > 0) {
      persona = {
        type: "customer",
        id: customers[0].id,
        userId: customers[0].userId,
        businessName: customers[0].user.businessName || "Business",
        customerName: customers[0].name,
      };
    }
    if (persona) activePersonas.set(chatId, persona);
  }
  return persona || null;
}

// ─── Helper: escape HTML ─────────────────────────────────────────────────────
const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

if (bot) {
  // ──────────────────────────────────────────────────────────────────────────
  // /start command
  // ──────────────────────────────────────────────────────────────────────────
  bot.start(async (ctx) => {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    const persona = await getActivePersona(chatId);

    if (persona) {
      if (persona.type === "owner") {
        await ctx.reply(
          `Welcome back, ${persona.businessName}! 🚀\nI'm your AI Business Assistant. Send me natural language commands to manage your business.\n\nType /switch to change accounts if you manage or visit multiple businesses.`
        );
      } else {
        await ctx.reply(
          `Welcome back, ${persona.customerName}! 😊\n\nYou are currently interacting with <b>${escapeHtml(persona.businessName)}</b>.\n\nYou can:\n• Type <b>book appointment</b> to schedule a new appointment\n• Type <b>my appointments</b> to see your upcoming appointments\n\nType /switch to change accounts if you visit multiple businesses.`,
          { parse_mode: "HTML" }
        );
      }
      return;
    }

    // Unknown user – prompt to share contact
    await ctx.reply(
      "👋 Welcome to Momentum! To get started, please share your phone number so we can link your account.",
      {
        reply_markup: {
          keyboard: [[{ text: "📱 Share Contact to Link Account", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // /switch command
  // ──────────────────────────────────────────────────────────────────────────
  bot.command("switch", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const { owners, customers } = await getAvailablePersonas(chatId);

    if (owners.length === 0 && customers.length === 0) {
      await ctx.reply("No linked accounts found. Please share your contact to link an account.", {
        reply_markup: {
          keyboard: [[{ text: "📱 Share Contact to Link Account", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
      return;
    }

    if (owners.length === 1 && customers.length === 0) {
      await ctx.reply("You only have one account linked (Business Owner).");
      return;
    }

    if (owners.length === 0 && customers.length === 1) {
      await ctx.reply(`You only have one account linked (Customer at ${customers[0].user.businessName}).`);
      return;
    }

    const buttons = [];
    for (const owner of owners) {
      buttons.push([{ text: `🏢 Owner: ${owner.businessName || "My Business"}`, callback_data: `switch_owner_${owner.id}` }]);
    }
    for (const customer of customers) {
      buttons.push([{ text: `🛍️ Customer: ${customer.user.businessName || "Business"}`, callback_data: `switch_cust_${customer.id}` }]);
    }

    await ctx.reply("🔄 <b>Switch Account</b>\nWhich account would you like to use right now?", {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Contact sharing — links both business owners AND customers
  // ──────────────────────────────────────────────────────────────────────────
  bot.on("contact", async (ctx) => {
    const contact = ctx.message.contact;
    const chatId = ctx.chat.id.toString();

    if (!contact.phone_number) {
      await ctx.reply("Invalid contact shared.");
      return;
    }

    const normalizePhone = (p: string) => p.replace(/\D/g, "").replace(/^0+/, "");
    const phoneNumber = normalizePhone(contact.phone_number);

    let linkedCount = 0;

    // 1) Link Owner accounts
    const usersWithPhone = await prisma.user.findMany({ where: { phone: { not: null } } });
    const matchedOwners = usersWithPhone.filter((u) => {
      const dbPhone = normalizePhone(u.phone!);
      return dbPhone === phoneNumber || phoneNumber.endsWith(dbPhone) || dbPhone.endsWith(phoneNumber);
    });

    for (const owner of matchedOwners) {
      await prisma.user.update({ where: { id: owner.id }, data: { telegramChatId: chatId } });
      linkedCount++;
    }

    // 2) Link Customer accounts
    const customersWithPhone = await prisma.customer.findMany({ where: { phone: { not: null } }, include: { user: true } });
    const matchedCustomers = customersWithPhone.filter((c) => {
      const dbPhone = normalizePhone(c.phone!);
      return dbPhone === phoneNumber || phoneNumber.endsWith(dbPhone) || dbPhone.endsWith(phoneNumber);
    });

    for (const cust of matchedCustomers) {
      await prisma.customer.update({ where: { id: cust.id }, data: { telegramChatId: chatId } });
      linkedCount++;
    }

    if (linkedCount === 0) {
      await ctx.reply(
        `❌ No account found with the phone number ${contact.phone_number}.\n\nPlease make sure your phone number is saved in the system, then try again.`,
        { reply_markup: { remove_keyboard: true } }
      );
      return;
    }

    await ctx.reply(`✅ Successfully linked ${linkedCount} account(s)!`, { reply_markup: { remove_keyboard: true } });

    // If multiple accounts found, trigger /switch flow
    if (linkedCount > 1) {
      // simulate /switch
      activePersonas.delete(chatId); // clear cache
      const { owners, customers } = await getAvailablePersonas(chatId);
      const buttons = [];
      for (const owner of owners) {
        buttons.push([{ text: `🏢 Owner: ${owner.businessName || "My Business"}`, callback_data: `switch_owner_${owner.id}` }]);
      }
      for (const customer of customers) {
        buttons.push([{ text: `🛍️ Customer: ${customer.user.businessName || "Business"}`, callback_data: `switch_cust_${customer.id}` }]);
      }
      await ctx.reply("🔄 Since you have multiple linked accounts, please select which one you want to use right now:", {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons },
      });
    } else {
      activePersonas.delete(chatId);
      const persona = await getActivePersona(chatId);
      if (persona?.type === "owner") {
        await ctx.reply(
          `You are now connected as <b>Owner</b> of ${escapeHtml(persona.businessName)}.\nSend me natural language commands!`,
          { parse_mode: "HTML" }
        );
      } else if (persona?.type === "customer") {
        await ctx.reply(
          `You are now connected as a <b>Customer</b> for ${escapeHtml(persona.businessName)}.\nYou can type <b>book appointment</b>!`,
          { parse_mode: "HTML" }
        );
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Inline keyboard callback
  // ──────────────────────────────────────────────────────────────────────────
  bot.on("callback_query", async (ctx) => {
    const data = (ctx.callbackQuery as any).data;
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    // ── Switch persona handling ───────────────────────────────────────────
    if (data.startsWith("switch_owner_")) {
      const id = data.replace("switch_owner_", "");
      const owner = await prisma.user.findUnique({ where: { id } });
      if (owner) {
        activePersonas.set(chatId, { type: "owner", id: owner.id, businessName: owner.businessName || "Business" });
        await ctx.reply(`✅ Switched to <b>Owner: ${escapeHtml(owner.businessName || "Business")}</b>.\nReady for commands!`, { parse_mode: "HTML" });
      }
      await ctx.answerCbQuery();
      return;
    }

    if (data.startsWith("switch_cust_")) {
      const id = data.replace("switch_cust_", "");
      const customer = await prisma.customer.findUnique({ where: { id }, include: { user: true } });
      if (customer) {
        activePersonas.set(chatId, {
          type: "customer",
          id: customer.id,
          userId: customer.userId,
          businessName: customer.user.businessName || "Business",
          customerName: customer.name,
        });
        await ctx.reply(`✅ Switched to <b>Customer at ${escapeHtml(customer.user.businessName || "Business")}</b>.\nYou can type 'book appointment'.`, { parse_mode: "HTML" });
      }
      await ctx.answerCbQuery();
      return;
    }

    // ── Customer appointment booking confirmation ─────────────────────────
    if (data === "customer_book_confirm" || data === "customer_book_cancel") {
      const state = customerBookingState.get(chatId);
      if (!state || state.step !== "confirming") {
        await ctx.reply("Session expired. Please start again by typing 'book appointment'.");
        await ctx.answerCbQuery();
        return;
      }

      if (data === "customer_book_cancel") {
        customerBookingState.delete(chatId);
        await ctx.reply("❌ Booking cancelled. Type 'book appointment' to start again.");
        await ctx.answerCbQuery();
        return;
      }

      // Confirm booking
      const { date, time, title, customerId, userId } = state;
      customerBookingState.delete(chatId);

      try {
        const startDateTime = new Date(`${date}T${time}:00`);
        const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // +1 hour

        if (isNaN(startDateTime.getTime())) {
          await ctx.reply("❌ Invalid date/time. Please try again by typing 'book appointment'.");
          await ctx.answerCbQuery();
          return;
        }

        const appointment = await prisma.appointment.create({
          data: {
            userId,
            customerId,
            title: title!,
            startTime: startDateTime,
            endTime: endDateTime,
            status: "scheduled",
            source: "telegram",
          },
        });

        await logTelegramActivity({
          userId,
          contactId: customerId,
          direction: "inbound",
          text: `Customer booked appointment via Telegram: ${title} on ${date} at ${time}`,
        });

        const formatted = startDateTime.toLocaleString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        await ctx.reply(
          `✅ <b>Appointment Booked!</b>\n\n📅 <b>${escapeHtml(title!)}</b>\n🕐 ${formatted}\n\nWe'll send you a reminder before your appointment. See you soon! 😊\n\n<i>Tip: Type <b>my appointments</b> anytime to view your upcoming schedule!</i>`,
          { parse_mode: "HTML" }
        );

        // Notify the business owner if they're linked to Telegram
        const owner = await prisma.user.findUnique({
          where: { id: userId },
          select: { telegramChatId: true, businessName: true },
        });
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { name: true },
        });

        if (owner?.telegramChatId && customer) {
          await bot.telegram.sendMessage(
            owner.telegramChatId,
            `🔔 <b>New Appointment Booked!</b>\n\nCustomer: <b>${escapeHtml(customer.name)}</b>\nService: <b>${escapeHtml(title!)}</b>\n📅 ${formatted}\n\nBooked via Telegram.`,
            { parse_mode: "HTML" }
          );
        }
      } catch (err) {
        console.error("Customer booking error:", err);
        await ctx.reply("❌ Sorry, we couldn't complete your booking. Please contact us directly.");
      }

      await ctx.answerCbQuery();
      return;
    }

    // ── Owner confirmation flow ───────────────────────────────────────────
    const token = pendingConfirmations.get(chatId);
    if (!token) {
      await ctx.reply("No pending action found or confirmation expired.");
      await ctx.answerCbQuery();
      return;
    }

    pendingConfirmations.delete(chatId);

    const persona = await getActivePersona(chatId);
    if (!persona || persona.type !== "owner") {
      await ctx.reply("Error: You are not active as a business owner.");
      await ctx.answerCbQuery();
      return;
    }

    try {
      const confirmed = data === "confirm_yes";
      const result = await commandEngine.confirm(token, confirmed, persona.id);

      let replyText = "";
      let safeMsg = result.message || "";
      if (safeMsg.length > 1000) safeMsg = safeMsg.substring(0, 1000) + "... (truncated)";

      if (result.success) {
        if (confirmed) {
          replyText = `✅ Action completed successfully!\n${safeMsg}`;
          if (result.data) {
            const jsonStr = JSON.stringify(result.data, null, 2);
            if (jsonStr.length > 1500) {
              replyText += `\n\nDetails:\n${jsonStr.substring(0, 1500)}... (truncated)`;
            } else {
              replyText += `\n\nDetails:\n${jsonStr}`;
            }
          }
        } else {
          replyText = `❌ Action cancelled.\n${safeMsg}`;
        }
      } else {
        replyText = `⚠️ Error performing action: ${safeMsg}`;
      }

      await ctx.reply(replyText);
      await logTelegramActivity({ userId: persona.id, direction: "outbound", text: replyText.substring(0, 4000) });
    } catch (err) {
      console.error("Callback query handling error:", err);
      await ctx.reply("An error occurred during confirmation.");
    }

    await ctx.answerCbQuery();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Text messages — routes between owner commands and customer flows
  // ──────────────────────────────────────────────────────────────────────────
  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();
    const chatId = ctx.chat.id.toString();

    try {
      if (text.startsWith("/")) return; // handled by commands

      const persona = await getActivePersona(chatId);

      if (!persona) {
        await ctx.reply(
          "Your Telegram account is not linked to any Momentum profile. Please share your phone number to get started.",
          {
            reply_markup: {
              keyboard: [[{ text: "📱 Share Contact to Link Account", request_contact: true }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }
        );
        return;
      }

      if (persona.type === "customer") {
        await handleCustomerMessage(ctx, chatId, text, persona);
      } else if (persona.type === "owner") {
        await handleOwnerMessage(ctx, chatId, text, persona.id);
      }

    } catch (error) {
      console.error("Telegram bot error:", error);
      await ctx.reply("Sorry, something went wrong. Please try again.");
    }
  });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

// ─── Customer message handler ─────────────────────────────────────────────────
async function handleCustomerMessage(
  ctx: any,
  chatId: string,
  text: string,
  persona: { type: "customer"; id: string; userId: string; businessName: string; customerName: string }
) {
  const { id: customerId, customerName, userId, businessName } = persona;

  const lower = text.toLowerCase();

  // ── Global cancellations and overrides ─────────────────────────────────────
  if (lower === "cancel" || lower === "quit" || lower === "stop" || lower === "exit") {
    if (customerBookingState.has(chatId)) {
      customerBookingState.delete(chatId);
      await ctx.reply("❌ Booking cancelled.", { parse_mode: "HTML" });
    } else {
      await ctx.reply("Nothing to cancel! Type <b>book appointment</b> to start.", { parse_mode: "HTML" });
    }
    return;
  }

  // Handle "my appointments" explicitly and clear state if it exists
  if (
    lower.includes("my appointment") ||
    lower.includes("my booking") ||
    lower.includes("upcoming") ||
    lower.includes("schedule")
  ) {
    customerBookingState.delete(chatId);
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const appointments = await prisma.appointment.findMany({
      where: {
        customerId,
        userId,
        startTime: { gte: todayStart },
        status: { not: "cancelled" },
      },
      orderBy: { startTime: "asc" },
      take: 5,
    });

    if (appointments.length === 0) {
      await ctx.reply("You have no upcoming appointments. Type <b>book appointment</b> to schedule one! 😊", {
        parse_mode: "HTML",
      });
      return;
    }

    const list = appointments
      .map((apt, i) => {
        const dt = new Date(apt.startTime).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return `${i + 1}. <b>${escapeHtml(apt.title)}</b>\n   📅 ${dt}`;
      })
      .join("\n\n");

    await ctx.reply(`📋 <b>Your Upcoming Appointments</b>\n\n${list}`, {
      parse_mode: "HTML",
    });
    return;
  }

  // ── Trigger: booking request ─────────────────────────────────────────────
  if (
    lower.includes("book") ||
    lower.includes("appointment") ||
    lower.includes("reserve")
  ) {
    customerBookingState.set(chatId, {
      step: "awaiting_title",
      customerId,
      userId,
    });

    await ctx.reply(
      `Great, ${customerName}! 📅 Let's book an appointment at <b>${escapeHtml(businessName || "our business")}</b>.\n\nWhat service or appointment type would you like?\n<i>(e.g. Haircut, Massage, Consultation, etc.)</i>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // ── If there's an active booking state, advance the booking flow ─────────
  const state = customerBookingState.get(chatId);
  if (state) {
    await advanceBookingFlow(ctx, chatId, text, state, customerName);
    return;
  }

  // ── Default: friendly reply ───────────────────────────────────────────────
  await ctx.reply(
    `Hi ${customerName}! 😊 How can we help you?\n\nYou can:\n• Type <b>book appointment</b> to schedule a new appointment\n• Type <b>my appointments</b> to see your upcoming bookings\n• Type /switch to switch accounts`,
    { parse_mode: "HTML" }
  );
}

// ─── Booking conversation flow (multi-step) ──────────────────────────────────
async function advanceBookingFlow(
  ctx: any,
  chatId: string,
  text: string,
  state: BookingState,
  customerName: string
) {
  switch (state.step) {
    case "awaiting_title": {
      state.title = text;
      state.step = "awaiting_date";
      customerBookingState.set(chatId, state);

      await ctx.reply(
        `Got it — <b>${escapeHtml(text)}</b>!\n\n📅 What date would you like?\nPlease use the format: <b>YYYY-MM-DD</b>, or just say 'today' or 'tomorrow'.\n<i>e.g. ${new Date().toISOString().split("T")[0]}</i>`,
        { parse_mode: "HTML" }
      );
      break;
    }

    case "awaiting_date": {
      let parsedDateText = text.trim();
      const lowerText = parsedDateText.toLowerCase();
      
      const now = new Date();
      if (lowerText === "today") {
        parsedDateText = now.toISOString().split("T")[0];
      } else if (lowerText === "tomorrow") {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        parsedDateText = tomorrow.toISOString().split("T")[0];
      }

      // Basic date validation
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(parsedDateText)) {
        await ctx.reply(
          "❌ Please use the date format <b>YYYY-MM-DD</b>, or just say 'today' or 'tomorrow'.\n<i>e.g. 2026-09-15</i>",
          { parse_mode: "HTML" }
        );
        return;
      }

      const parsedDate = new Date(`${parsedDateText}T00:00:00`);
      if (isNaN(parsedDate.getTime())) {
        await ctx.reply("❌ Please enter a valid date.");
        return;
      }

      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);

      if (parsedDate < todayMidnight) {
        await ctx.reply("❌ You cannot book an appointment in the past. Please enter a valid future date.");
        return;
      }

      state.date = parsedDateText;
      state.step = "awaiting_time";
      customerBookingState.set(chatId, state);

      await ctx.reply(
        `Perfect! What time would you like your appointment?\nPlease use <b>HH:MM</b> format (24-hour)\n<i>e.g. 14:30 for 2:30 PM</i>`,
        { parse_mode: "HTML" }
      );
      break;
    }

    case "awaiting_time": {
      // Parse flexible time input (e.g. "2", "2pm", "14", "14:30")
      let parsedHour: number = -1;
      let parsedMinute: number = 0;
      
      const cleanTime = text.toLowerCase().replace(/\s/g, '');
      const pmMatch = cleanTime.match(/^(\d{1,2})(?::(\d{2}))?pm$/);
      const amMatch = cleanTime.match(/^(\d{1,2})(?::(\d{2}))?am$/);
      const plainMatch = cleanTime.match(/^(\d{1,2})(?::(\d{2}))?$/);
      
      if (pmMatch) {
         parsedHour = parseInt(pmMatch[1], 10);
         parsedMinute = pmMatch[2] ? parseInt(pmMatch[2], 10) : 0;
         if (parsedHour < 12) parsedHour += 12;
      } else if (amMatch) {
         parsedHour = parseInt(amMatch[1], 10);
         parsedMinute = amMatch[2] ? parseInt(amMatch[2], 10) : 0;
         if (parsedHour === 12) parsedHour = 0;
      } else if (plainMatch) {
         parsedHour = parseInt(plainMatch[1], 10);
         parsedMinute = plainMatch[2] ? parseInt(plainMatch[2], 10) : 0;
         // If they just say "2" or "4", assume PM for business hours (e.g., 1 to 7)
         if (parsedHour >= 1 && parsedHour <= 7) {
             parsedHour += 12;
         }
      }

      if (parsedHour < 0 || parsedHour > 23 || parsedMinute < 0 || parsedMinute > 59) {
        await ctx.reply(
          "❌ Please enter a valid time\n<i>e.g. 2pm, 14:30, 9am, or just 2</i>",
          { parse_mode: "HTML" }
        );
        return;
      }

      const formattedTime = `${parsedHour.toString().padStart(2, '0')}:${parsedMinute.toString().padStart(2, '0')}`;
      
      const startDateTime = new Date(`${state.date}T${formattedTime}:00`);
      if (startDateTime < new Date()) {
         await ctx.reply("❌ That time has already passed. Please select a future time.");
         return;
      }

      // Check for conflicts (assume 1 hr slot)
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
      const conflict = await prisma.appointment.findFirst({
        where: {
          userId: state.userId,
          status: { not: "cancelled" },
          startTime: { lt: endDateTime },
          endTime: { gt: startDateTime },
        }
      });

      if (conflict) {
         // Find alternatives
         const dayStart = new Date(startDateTime);
         dayStart.setHours(8, 0, 0, 0);
         const dayEnd = new Date(startDateTime);
         dayEnd.setHours(18, 0, 0, 0);
         
         const existingApts = await prisma.appointment.findMany({
            where: {
              userId: state.userId,
              status: { not: "cancelled" },
              startTime: { gte: dayStart, lt: dayEnd },
            },
            orderBy: { startTime: 'asc' }
         });

         let suggestions: string[] = [];
         let checkTime = new Date(startDateTime);
         
         // check later times
         for (let i = 1; i <= 4; i++) {
            checkTime = new Date(startDateTime.getTime() + i * 60 * 60 * 1000);
            const isConflicting = existingApts.some(apt => 
                apt.startTime < new Date(checkTime.getTime() + 60*60*1000) && 
                apt.endTime > checkTime
            );
            if (!isConflicting && checkTime > new Date() && checkTime.getHours() < 18) {
               suggestions.push(`${checkTime.getHours()}:${checkTime.getMinutes().toString().padStart(2, '0')}`);
               if (suggestions.length === 2) break;
            }
         }
         
         // check earlier times if needed
         if (suggestions.length < 2) {
            for (let i = 1; i <= 4; i++) {
               checkTime = new Date(startDateTime.getTime() - i * 60 * 60 * 1000);
               const isConflicting = existingApts.some(apt => 
                   apt.startTime < new Date(checkTime.getTime() + 60*60*1000) && 
                   apt.endTime > checkTime
               );
               if (!isConflicting && checkTime > new Date() && checkTime.getHours() >= 8) {
                  suggestions.push(`${checkTime.getHours()}:${checkTime.getMinutes().toString().padStart(2, '0')}`);
                  if (suggestions.length >= 2) break;
               }
            }
         }

         let textMsg = `❌ That time is already booked.`;
         if (suggestions.length > 0) {
            textMsg += ` How about <b>${suggestions.join('</b> or <b>')}</b>?\nJust type the time you prefer!`;
         } else {
            textMsg += ` Please choose another time or a different date.`;
         }

         await ctx.reply(textMsg, { parse_mode: "HTML" });
         return;
      }

      state.time = formattedTime;
      state.step = "confirming";
      customerBookingState.set(chatId, state);

      const dt = new Date(`${state.date}T${formattedTime}:00`).toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      await ctx.reply(
        `📋 <b>Booking Summary</b>\n\n🔹 Service: <b>${escapeHtml(state.title!)}</b>\n🕐 Date & Time: <b>${dt}</b>\n\nDoes this look correct?`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Yes, Book It!", callback_data: "customer_book_confirm" },
                { text: "❌ Cancel", callback_data: "customer_book_cancel" },
              ],
            ],
          },
        }
      );
      break;
    }

    case "confirming": {
      // They typed something instead of clicking a button
      await ctx.reply(
        "Please use the buttons above to confirm or cancel your booking.",
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Yes, Book It!", callback_data: "customer_book_confirm" },
                { text: "❌ Cancel", callback_data: "customer_book_cancel" },
              ],
            ],
          },
        }
      );
      break;
    }
  }
}

// ─── Business owner message handler ──────────────────────────────────────────
async function handleOwnerMessage(
  ctx: any,
  chatId: string,
  text: string,
  businessUserId: string
) {
  await logTelegramActivity({
    userId: businessUserId,
    direction: "inbound",
    text,
  });

  const interpretResult = await interpretCommand(text, businessUserId);

  if (interpretResult.type === "function_call" && interpretResult.functionCall) {
    const result = await commandEngine.execute(interpretResult.functionCall, businessUserId);

    if (result.type === "confirmation_required") {
      pendingConfirmations.set(chatId, result.confirmationToken || "");
      const replyText = `⚠️ <b>Confirmation Required</b>\n${escapeHtml(
        result.confirmationDescription || "Are you sure you want to proceed?"
      )}`;

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

      await logTelegramActivity({ userId: businessUserId, direction: "outbound", text: replyText });
    } else {
      let safeMsg = result.message || "";
      if (safeMsg.length > 1500) safeMsg = safeMsg.substring(0, 1500) + "... (truncated)";

      if (result.success) {
        let replyText = `✅ <b>Command Executed</b>\n${escapeHtml(safeMsg)}`;
        if (result.data) {
          const jsonStr = JSON.stringify(result.data, null, 2);
          if (jsonStr.length > 1500) {
            replyText += `\n\n<b>Result Details</b>:\n<pre><code class="language-json">${escapeHtml(
              jsonStr.substring(0, 1500)
            )}... (truncated)</code></pre>`;
          } else {
            replyText += `\n\n<b>Result Details</b>:\n<pre><code class="language-json">${escapeHtml(
              jsonStr
            )}</code></pre>`;
          }
        }

        await ctx.reply(replyText, { parse_mode: "HTML" });
        await logTelegramActivity({ userId: businessUserId, direction: "outbound", text: replyText.substring(0, 4000) });
      } else {
        const replyText = `❌ <b>Error</b>: ${escapeHtml(safeMsg)}`;
        await ctx.reply(replyText, { parse_mode: "HTML" });
        await logTelegramActivity({ userId: businessUserId, direction: "outbound", text: replyText.substring(0, 4000) });
      }
    }
  } else if (interpretResult.type === "clarification" && interpretResult.clarification) {
    const replyText = interpretResult.clarification.message;
    await ctx.reply(replyText);
    await logTelegramActivity({ userId: businessUserId, direction: "outbound", text: replyText });
  } else {
    const replyText =
      interpretResult.unknownMessage ||
      "I'm sorry, I didn't catch that. Try asking to book an appointment or check list of tasks.";
    await ctx.reply(replyText);
    await logTelegramActivity({ userId: businessUserId, direction: "outbound", text: replyText });
  }
}

export default bot;
