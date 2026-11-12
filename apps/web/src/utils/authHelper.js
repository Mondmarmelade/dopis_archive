import fs from "node:fs";
import path from "node:path";
import { decryptData } from "./cryptography.js";

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  };
}

export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

let cachedResetEpoch = null;
let lastEpochCheckTime = 0;

export function getResetEpoch() {
  const now = Date.now();
  if (now - lastEpochCheckTime < 1000 && cachedResetEpoch !== null) {
    return cachedResetEpoch;
  }
  lastEpochCheckTime = now;
  try {
    const epochFilePath = path.resolve(process.cwd(), ".install_reset");
    const altEpochFilePath = path.resolve(process.cwd(), "apps/web/.install_reset");
    const targetPath = fs.existsSync(epochFilePath)
      ? epochFilePath
      : fs.existsSync(altEpochFilePath)
      ? altEpochFilePath
      : null;
    if (targetPath) {
      const content = fs.readFileSync(targetPath, "utf-8").trim();
      const parsed = Number(content);
      if (!isNaN(parsed) && parsed > 0) {
        cachedResetEpoch = parsed;
        return cachedResetEpoch;
      }
    }
  } catch (err) {}
  return cachedResetEpoch || 0;
}

export function setResetEpoch(epoch = Date.now()) {
  try {
    const epochFilePath = path.resolve(process.cwd(), ".install_reset");
    fs.writeFileSync(epochFilePath, String(epoch), "utf-8");
    cachedResetEpoch = epoch;
  } catch (err) {}
}

export function isTokenValid(decrypted) {
  if (!decrypted || !Array.isArray(decrypted) || decrypted.length < 4) {
    return false;
  }
  // Validate token expiration if exp timestamp is present
  const expEntry = decrypted.find(
    (item) => item && typeof item.exp === "number"
  );
  if (expEntry && Date.now() > expEntry.exp) {
    console.warn(
      "Session token expired at:",
      new Date(expEntry.exp).toISOString()
    );
    return false;
  }

  // Validate token against reset epoch (simulated fresh install)
  const resetEpoch = getResetEpoch();
  if (resetEpoch > 0) {
    const iatEntry = decrypted.find(
      (item) => item && typeof item.iat === "number"
    );
    if (!iatEntry || iatEntry.iat < resetEpoch) {
      return false;
    }
  }

  return true;
}

export function getCredentials(request, cookies) {
  // 1. Check Authorization: Bearer <token>
  try {
    const authHeader =
      request?.headers?.get("authorization") ||
      request?.headers?.get("Authorization");

    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const decrypted = decryptData(token);
        if (isTokenValid(decrypted)) {
          return decrypted;
        }
      }
    }
  } catch (err) {
    console.warn("Bearer token decryption failed:", err?.message || err);
  }

  // 2. Check auth cookie
  try {
    const authCookie = cookies?.get ? cookies.get("auth") : null;
    if (authCookie?.value) {
      const decrypted = decryptData(authCookie.value);
      if (isTokenValid(decrypted)) {
        return decrypted;
      }
    }
  } catch (err) {
    console.warn("Auth cookie decryption failed:", err?.message || err);
  }

  return null;
}
