import { google } from "googleapis";
import prisma from "../config/db.js";
import { env } from "../config/env.js";

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
}

function createOAuth2Client() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

/**
 * Retrieves a valid access token for the given user.
 * If the stored token is expired, it auto-refreshes using the refresh token.
 */
export async function getValidToken(userId: string): Promise<string> {
  const tokenRecord = await prisma.googleCalendarToken.findUnique({
    where: { userId },
  });

  if (!tokenRecord) {
    throw new Error("No Google Calendar token found for user");
  }

  // Check if token is still valid (with 5-minute buffer)
  const bufferMs = 5 * 60 * 1000;
  const isExpired = tokenRecord.expiresAt.getTime() - bufferMs < Date.now();

  if (!isExpired) {
    return tokenRecord.accessToken;
  }

  // Token is expired, refresh it
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: tokenRecord.refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Failed to refresh access token");
  }

  const newExpiresAt = credentials.expiry_date
    ? new Date(credentials.expiry_date)
    : new Date(Date.now() + 3600 * 1000);

  // Update the stored token
  await prisma.googleCalendarToken.update({
    where: { userId },
    data: {
      accessToken: credentials.access_token,
      expiresAt: newExpiresAt,
      // Update refresh token if a new one was issued
      ...(credentials.refresh_token && {
        refreshToken: credentials.refresh_token,
      }),
    },
  });

  return credentials.access_token;
}

/**
 * Stores (upserts) OAuth tokens for a user after a successful OAuth flow.
 */
export async function storeTokens(
  userId: string,
  tokens: OAuthTokens,
): Promise<void> {
  await prisma.googleCalendarToken.upsert({
    where: { userId },
    update: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      email: tokens.email,
    },
    create: {
      userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      email: tokens.email,
    },
  });
}

/**
 * Revokes the user's Google OAuth tokens and removes the local record.
 */
export async function revokeTokens(userId: string): Promise<void> {
  const tokenRecord = await prisma.googleCalendarToken.findUnique({
    where: { userId },
  });

  if (!tokenRecord) {
    return;
  }

  // Attempt to revoke the token with Google
  try {
    const oauth2Client = createOAuth2Client();
    await oauth2Client.revokeToken(tokenRecord.accessToken);
  } catch (error) {
    // Log but don't throw — we still want to delete locally even if revoke fails
    console.warn("Failed to revoke token with Google:", error);
  }

  // Delete local record
  await prisma.googleCalendarToken.delete({
    where: { userId },
  });
}

export { createOAuth2Client };
