import { createHmac } from "crypto";
import { env } from "../config/env.js";

export interface ConfirmationTokenPayload {
  action: string;
  parameters: Record<string, any>;
  userId: string;
  iat: number; // issued-at unix timestamp (seconds)
  exp: number; // expires-at unix timestamp (seconds)
}

const TOKEN_TTL_SECONDS = 300; // 5 minutes

function getSecret(): string {
  return env.JWT_SECRET || "momentum-confirmation-secret";
}

/**
 * Encodes a payload as base64url.
 */
function encodePayload(payload: ConfirmationTokenPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/**
 * Creates an HMAC-SHA256 signature for the given data.
 */
function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

/**
 * Creates a short-lived HMAC-signed confirmation token.
 * Format: <base64url-payload>.<base64url-signature>
 */
export function createConfirmationToken(
  action: string,
  parameters: Record<string, any>,
  userId: string,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: ConfirmationTokenPayload = {
    action,
    parameters,
    userId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };

  const encodedPayload = encodePayload(payload);
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Validates and decodes a confirmation token.
 * Returns the payload if valid, or null if invalid/expired/tampered.
 */
export function validateConfirmationToken(
  token: string,
  userId: string,
): ConfirmationTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;

  // Verify signature
  const expectedSig = sign(encodedPayload);
  if (signature !== expectedSig) {
    return null; // tampered
  }

  let payload: ConfirmationTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8"),
    ) as ConfirmationTokenPayload;
  } catch {
    return null; // malformed
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (now > payload.exp) {
    return null; // expired
  }

  // Check userId matches
  if (payload.userId !== userId) {
    return null; // wrong user
  }

  return payload;
}
