import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { env } from "../config/env.js";
import {
  createOAuth2Client,
  storeTokens,
  revokeTokens,
} from "../services/tokenManager.js";
import { pullFromGoogle, pushToGoogle } from "../services/syncEngine.js";
import prisma from "../config/db.js";

const router = Router();

/**
 * GET /api/google-calendar/auth-url
 * Generates and returns Google OAuth consent URL with calendar scope.
 * Encodes the user's JWT in the OAuth state parameter so the callback
 * can identify the user without requiring Bearer auth on the redirect.
 */
router.get(
  "/auth-url",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const oauth2Client = createOAuth2Client();

      // Encode a short-lived token in the state param for callback identification
      const stateToken = jwt.sign({ userId: req.userId }, env.JWT_SECRET, {
        expiresIn: "10m",
      });

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/calendar"],
        prompt: "consent",
        state: stateToken,
      });

      res.json({ url: authUrl });
    } catch (error) {
      console.error("Generate auth URL error:", error);
      res.status(500).json({ error: "Failed to generate auth URL." });
    }
  },
);

/**
 * GET /api/google-calendar/callback
 * OAuth callback — Google redirects the browser here after consent.
 * Extracts userId from the state parameter (no Bearer auth needed).
 * Exchanges the authorization code for tokens, stores them, then
 * redirects the user back to the frontend appointments page.
 */
router.get("/callback", async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Handle OAuth denial
    if (oauthError) {
      res.redirect("http://localhost:5173/appointments?google_error=denied");
      return;
    }

    if (!code || typeof code !== "string") {
      res.redirect("http://localhost:5173/appointments?google_error=no_code");
      return;
    }

    if (!state || typeof state !== "string") {
      res.redirect("http://localhost:5173/appointments?google_error=no_state");
      return;
    }

    // Verify state token to get userId
    let userId: string;
    try {
      const decoded = jwt.verify(state, env.JWT_SECRET) as { userId: string };
      userId = decoded.userId;
    } catch {
      res.redirect(
        "http://localhost:5173/appointments?google_error=invalid_state",
      );
      return;
    }

    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      res.redirect(
        "http://localhost:5173/appointments?google_error=token_failed",
      );
      return;
    }

    // Get the user's email from the token info
    oauth2Client.setCredentials(tokens);
    const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token);
    const email = tokenInfo.email || "";

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    await storeTokens(userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      email,
    });

    // Redirect back to frontend with success
    res.redirect("http://localhost:5173/appointments?google_connected=true");
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.redirect(
      "http://localhost:5173/appointments?google_error=server_error",
    );
  }
});

/**
 * GET /api/google-calendar/status
 * Returns connection status, linked email, last sync time, and any error.
 */
router.get(
  "/status",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const tokenRecord = await prisma.googleCalendarToken.findUnique({
        where: { userId: req.userId! },
      });

      if (!tokenRecord) {
        res.json({
          connected: false,
          email: null,
          lastSyncAt: null,
          error: null,
        });
        return;
      }

      // Check if token might need re-auth (expired and no refresh possible)
      const isExpired = tokenRecord.expiresAt.getTime() < Date.now();
      const error =
        isExpired && !tokenRecord.refreshToken
          ? "Token expired. Please reconnect your Google Calendar."
          : null;

      res.json({
        connected: true,
        email: tokenRecord.email,
        lastSyncAt: tokenRecord.lastSyncAt
          ? tokenRecord.lastSyncAt.toISOString()
          : null,
        error,
      });
    } catch (error) {
      console.error("Get status error:", error);
      res.status(500).json({ error: "Failed to fetch sync status." });
    }
  },
);

/**
 * POST /api/google-calendar/sync
 * Triggers manual sync: pulls from Google Calendar and pushes pending local changes.
 */
router.post(
  "/sync",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const tokenRecord = await prisma.googleCalendarToken.findUnique({
        where: { userId: req.userId! },
      });

      if (!tokenRecord) {
        res.status(400).json({ error: "Google Calendar is not connected." });
        return;
      }

      // Pull changes from Google
      const syncResult = await pullFromGoogle(req.userId!);

      // Push pending local changes (appointments with no googleEventId that aren't from Google)
      const pendingAppointments = await prisma.appointment.findMany({
        where: {
          userId: req.userId!,
          googleEventId: null,
          source: { not: "google_calendar" },
        },
      });

      let pushErrors: string[] = [];
      for (const appointment of pendingAppointments) {
        try {
          await pushToGoogle(req.userId!, appointment, "create");
        } catch (err: any) {
          pushErrors.push(
            `Failed to push appointment ${appointment.id}: ${err.message}`,
          );
        }
      }

      res.json({
        message: "Sync completed.",
        pull: syncResult,
        pushed: pendingAppointments.length - pushErrors.length,
        pushErrors,
      });
    } catch (error: any) {
      console.error("Sync error:", error);

      // If token refresh failed, indicate re-auth needed
      if (
        error.message?.includes("refresh") ||
        error.message?.includes("token")
      ) {
        res.status(401).json({
          error: "Authentication expired. Please reconnect Google Calendar.",
        });
        return;
      }

      res.status(500).json({ error: "Failed to sync with Google Calendar." });
    }
  },
);

/**
 * DELETE /api/google-calendar/disconnect
 * Revokes tokens and removes the Google Calendar link.
 */
router.delete(
  "/disconnect",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await revokeTokens(req.userId!);
      res.json({ message: "Google Calendar disconnected successfully." });
    } catch (error) {
      console.error("Disconnect error:", error);
      res.status(500).json({ error: "Failed to disconnect Google Calendar." });
    }
  },
);

export default router;
