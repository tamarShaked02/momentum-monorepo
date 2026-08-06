import prisma from "../config/db.js";

/**
 * Maximum text length for a Telegram message activity log.
 * Messages exceeding this length are truncated.
 */
const MAX_TELEGRAM_TEXT_LENGTH = 4096;

/**
 * Direction of a Telegram message relative to the system.
 */
export type TelegramMessageDirection = "inbound" | "outbound";

/**
 * Parameters for logging a Telegram message activity.
 */
export interface LogTelegramActivityParams {
  userId: string;
  contactId?: string | null;
  direction: TelegramMessageDirection;
  text: string;
}

/**
 * Logs a Telegram message as an Activity of type "telegram_message".
 *
 * Both the Telegram bot (inbound messages) and the automation engine (outbound messages)
 * use this helper to ensure consistent activity logging.
 *
 * The message text is truncated to 4096 characters if longer.
 */
export async function logTelegramActivity(
  params: LogTelegramActivityParams,
): Promise<void> {
  const { userId, contactId, direction, text } = params;

  const truncatedText =
    text.length > MAX_TELEGRAM_TEXT_LENGTH
      ? text.slice(0, MAX_TELEGRAM_TEXT_LENGTH)
      : text;

  await prisma.activity.create({
    data: {
      userId,
      type: "telegram_message",
      description:
        direction === "inbound"
          ? (contactId ? `Received Telegram message from contact` : `Received Telegram message from owner`)
          : (contactId ? `Sent Telegram message to contact` : `Sent Telegram message to owner`),
      metadata: {
        direction,
        text: truncatedText,
      },
      contactId,
      isSystem: true,
    },
  });
}
