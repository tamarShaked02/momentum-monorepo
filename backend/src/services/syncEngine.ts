import { google, calendar_v3 } from "googleapis";
import prisma from "../config/db.js";
import { getValidToken } from "./tokenManager.js";

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: SyncError[];
}

export interface SyncError {
  eventId?: string;
  message: string;
}

interface GoogleEvent {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  updated?: string | null;
  status?: string | null;
}

/**
 * Executes an async operation with exponential backoff retry for 429/5xx responses.
 * Base delay: 1s, max retries: 5.
 */
export async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 10,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const status = error?.code || error?.response?.status;

      const isRetryable = status === 429 || (status >= 500 && status < 600);
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a Google Calendar API client authenticated for the given user.
 */
async function getCalendarClient(
  userId: string,
): Promise<calendar_v3.Calendar> {
  const accessToken = await getValidToken(userId);
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * Gets or creates a secondary Google Calendar named after the user's business.
 * Stores the calendarId on the token record for reuse.
 */
async function getBusinessCalendarId(
  userId: string,
  calendar: calendar_v3.Calendar,
): Promise<string> {
  // Check if we already have a stored calendarId
  const tokenRecord = await prisma.googleCalendarToken.findUnique({
    where: { userId },
  });

  if (tokenRecord?.calendarId) {
    // Verify it still exists
    try {
      await withExponentialBackoff(() =>
        calendar.calendars.get({ calendarId: tokenRecord.calendarId! }),
      );
      return tokenRecord.calendarId;
    } catch {
      // Calendar was deleted, create a new one
    }
  }

  // Get the user's business name
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { businessName: true },
  });

  const calendarName = user?.businessName || "Momentum Appointments";

  // Check if a calendar with this name already exists
  const calendarList = await withExponentialBackoff(() =>
    calendar.calendarList.list(),
  );

  const existing = calendarList.data.items?.find(
    (cal) => cal.summary === calendarName && cal.accessRole === "owner",
  );

  if (existing?.id) {
    await prisma.googleCalendarToken.update({
      where: { userId },
      data: { calendarId: existing.id },
    });
    return existing.id;
  }

  // Create a new secondary calendar
  const newCalendar = await withExponentialBackoff(() =>
    calendar.calendars.insert({
      requestBody: {
        summary: calendarName,
        description: "Appointments synced from Momentum",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }),
  );

  const newCalendarId = newCalendar.data.id!;

  await prisma.googleCalendarToken.update({
    where: { userId },
    data: { calendarId: newCalendarId },
  });

  return newCalendarId;
}

/**
 * Maps a local appointment to a Google Calendar event resource.
 */
export function mapAppointmentToGoogleEvent(appointment: {
  title: string;
  startTime: Date;
  endTime: Date;
  notes?: string | null;
}): calendar_v3.Schema$Event {
  return {
    summary: appointment.title,
    description: appointment.notes || undefined,
    start: {
      dateTime: appointment.startTime.toISOString(),
    },
    end: {
      dateTime: appointment.endTime.toISOString(),
    },
  };
}

/**
 * Pushes a local appointment change to Google Calendar.
 * Handles create, update, and delete actions.
 */
export async function pushToGoogle(
  userId: string,
  appointment: {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    notes?: string | null;
    googleEventId?: string | null;
  },
  action: "create" | "update" | "delete",
): Promise<string | null> {
  const calendar = await getCalendarClient(userId);
  const calendarId = await getBusinessCalendarId(userId, calendar);

  if (action === "create") {
    const eventResource = mapAppointmentToGoogleEvent(appointment);
    const response = await withExponentialBackoff(() =>
      calendar.events.insert({
        calendarId,
        requestBody: eventResource,
      }),
    );

    const googleEventId = response.data.id || null;

    // Store the googleEventId on the local appointment
    if (googleEventId) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { googleEventId },
      });
    }

    return googleEventId;
  }

  if (action === "update") {
    if (!appointment.googleEventId) {
      console.warn(
        `Cannot update Google event: no googleEventId for appointment ${appointment.id}`,
      );
      return null;
    }

    const eventResource = mapAppointmentToGoogleEvent(appointment);
    await withExponentialBackoff(() =>
      calendar.events.update({
        calendarId,
        eventId: appointment.googleEventId!,
        requestBody: eventResource,
      }),
    );

    return appointment.googleEventId;
  }

  if (action === "delete") {
    if (!appointment.googleEventId) {
      console.warn(
        `Cannot delete Google event: no googleEventId for appointment ${appointment.id}`,
      );
      return null;
    }

    await withExponentialBackoff(() =>
      calendar.events.delete({
        calendarId,
        eventId: appointment.googleEventId!,
      }),
    );

    return appointment.googleEventId;
  }

  return null;
}

/**
 * Pulls changes from Google Calendar using incremental sync (syncToken).
 * Upserts local appointments with source="google_calendar".
 */
export async function pullFromGoogle(userId: string): Promise<SyncResult> {
  const calendar = await getCalendarClient(userId);
  const result: SyncResult = { created: 0, updated: 0, deleted: 0, errors: [] };

  // Get the stored syncToken
  const tokenRecord = await prisma.googleCalendarToken.findUnique({
    where: { userId },
  });

  if (!tokenRecord) {
    throw new Error("No Google Calendar token found for user");
  }

  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  let allEvents: GoogleEvent[] = [];

  try {
    // Fetch events using syncToken for incremental sync, or full sync if no token
    do {
      const listParams: calendar_v3.Params$Resource$Events$List = {
        calendarId: "primary",
        singleEvents: true,
        showDeleted: true,
      };

      if (tokenRecord.syncToken && !pageToken) {
        listParams.syncToken = tokenRecord.syncToken;
      } else if (pageToken) {
        listParams.pageToken = pageToken;
      } else {
        // Full sync: limit to recent events
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        listParams.timeMin = threeMonthsAgo.toISOString();
      }

      const response = await withExponentialBackoff(() =>
        calendar.events.list(listParams),
      );

      const events = response.data.items || [];
      allEvents = allEvents.concat(events as GoogleEvent[]);
      pageToken = response.data.nextPageToken || undefined;
      nextSyncToken = response.data.nextSyncToken || undefined;
    } while (pageToken);
  } catch (error: any) {
    // If syncToken is invalid (410 Gone), do a full sync
    if (error?.code === 410) {
      // Clear the sync token and retry with a full sync
      await prisma.googleCalendarToken.update({
        where: { userId },
        data: { syncToken: null },
      });
      return pullFromGoogle(userId);
    }
    throw error;
  }

  // Process each event
  for (const event of allEvents) {
    try {
      if (!event.id) continue;

      const isCancelled = event.status === "cancelled";

      // Find existing local appointment by googleEventId
      const existingAppointment = await prisma.appointment.findFirst({
        where: { userId, googleEventId: event.id },
      });

      if (isCancelled) {
        // Delete the local appointment if it exists
        if (existingAppointment) {
          await prisma.appointment.delete({
            where: { id: existingAppointment.id },
          });
          result.deleted++;
        }
        continue;
      }

      // Extract event times
      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;

      if (!startTime || !endTime) {
        result.errors.push({
          eventId: event.id,
          message: "Event missing start or end time",
        });
        continue;
      }

      const eventData = {
        title: event.summary || "Untitled Event",
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        notes: event.description || null,
        source: "google_calendar",
        googleEventId: event.id,
      };

      if (existingAppointment) {
        // Check for conflict resolution
        const remoteUpdated = event.updated
          ? new Date(event.updated)
          : new Date();
        const conflictWinner = resolveConflict(existingAppointment, {
          updated: remoteUpdated,
        });

        if (conflictWinner === "remote") {
          await prisma.appointment.update({
            where: { id: existingAppointment.id },
            data: {
              title: eventData.title,
              startTime: eventData.startTime,
              endTime: eventData.endTime,
              notes: eventData.notes,
            },
          });
          result.updated++;
        }
      } else {
        // Create new local appointment from Google event
        await prisma.appointment.create({
          data: {
            userId,
            ...eventData,
            status: "scheduled",
          },
        });
        result.created++;
      }
    } catch (error: any) {
      result.errors.push({
        eventId: event.id || undefined,
        message: error?.message || "Unknown error processing event",
      });
    }
  }

  // Update the sync token and last sync time
  if (nextSyncToken) {
    await prisma.googleCalendarToken.update({
      where: { userId },
      data: {
        syncToken: nextSyncToken,
        lastSyncAt: new Date(),
      },
    });
  }

  return result;
}

/**
 * Resolves a sync conflict between a local appointment and a remote event.
 * Uses last-write-wins: the version with the more recent updatedAt timestamp wins.
 */
export function resolveConflict(
  local: { updatedAt: Date },
  remote: { updated: Date },
): "local" | "remote" {
  const localTime = local.updatedAt.getTime();
  const remoteTime = remote.updated.getTime();

  // Last-write-wins; ties go to remote (Google is source of truth for ties)
  if (localTime > remoteTime) {
    return "local";
  }
  return "remote";
}
