import { ImapFlow } from "imapflow";
import { encryptData } from "../../../utils/cryptography.js";
import { handleOptions, jsonResponse } from "../../../utils/authHelper.js";
import { validateImapHost } from "../../../utils/networkGuard.js";
import {
  getClientIp,
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
} from "../../../utils/rateLimiter.js";

export async function OPTIONS() {
  return handleOptions();
}

export async function POST({ request }) {
  try {
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
    if (!rateCheck.allowed) {
      return jsonResponse(
        {
          error: `Zu viele Fehlversuche. Bitte warten Sie ${rateCheck.resetInSeconds} Sekunden vor dem nächsten Versuch.`,
        },
        429
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400);
    }

    const { email, password, host, port, secure } = body || {};

    if (!email || !password || !host) {
      return jsonResponse(
        { error: "Missing required fields: email, password, host." },
        400
      );
    }

    const hostCheck = validateImapHost(host, port || 993);
    if (!hostCheck.valid) {
      return jsonResponse({ error: hostCheck.error }, 400);
    }

    const imapPort = hostCheck.port;
    const isSecure = secure !== undefined ? Boolean(secure) : imapPort === 993;

    const testClient = new ImapFlow({
      host: hostCheck.host,
      port: imapPort,
      secure: isSecure,
      auth: {
        user: email,
        pass: password,
      },
      logger: false,
    });

    try {
      await testClient.connect();
      await testClient.logout();
      clearRateLimit(clientIp);
    } catch (authError) {
      recordFailedAttempt(clientIp);
      console.error("API Login verification failed:", authError);
      return jsonResponse(
        {
          error:
            "IMAP authentication failed. Please verify your email, password, and host.",
        },
        401
      );
    }

    const now = Date.now();
    const tokenExp = now + 14 * 24 * 60 * 60 * 1000; // 14 days

    const formatData = [
      { user: email },
      { pass: password },
      { host: hostCheck.host },
      { port: imapPort },
      { exp: tokenExp },
      { iat: now },
    ];

    const token = encryptData(formatData);

    return jsonResponse({
      success: true,
      token,
      expiresAt: new Date(tokenExp).toISOString(),
      user: {
        email,
        host: hostCheck.host,
      },
    });
  } catch (error) {
    console.error("Unexpected error in /api/auth/login:", error);
    return jsonResponse(
      { error: error?.message || "Internal server error." },
      500
    );
  }
}
