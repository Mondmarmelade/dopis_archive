import { ImapFlow } from "imapflow";

// Global in-memory pool of active ImapFlow clients keyed by user:host:port
// In Node.js server environments (dev and long-running production), this persists across requests.
const clientPool = new Map();

// Idle timeout to disconnect unused clients after 5 minutes
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export async function getImapClient(credentials) {
  if (!credentials || credentials.length < 4) {
    throw new Error("Invalid credentials passed to getImapClient");
  }

  const user = credentials[0].user;
  const pass = credentials[1].pass;
  const host = credentials[2].host;
  const port = Number(credentials[3].port) || 993;
  const poolKey = `${user}@${host}:${port}`;

  let entry = clientPool.get(poolKey);

  // Check if existing connection is still healthy and authenticated
  if (entry && entry.client && entry.client.authenticated && entry.client.usable) {
    entry.lastUsed = Date.now();
    return entry.client;
  }

  // If old client exists but is dead or disconnected, clean it up
  if (entry?.client) {
    try {
      await entry.client.logout();
    } catch {}
    clientPool.delete(poolKey);
  }

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false,
    clientInfo: {
      name: "Dopis Mail",
      version: "1.0.0",
    },
    // Keep socket healthy
    verifyOnly: false,
  });

  // Handle unexpected socket closes or errors
  client.on("close", () => {
    clientPool.delete(poolKey);
  });
  client.on("error", (err) => {
    console.warn("IMAP connection error in pool for", poolKey, err.message);
    clientPool.delete(poolKey);
  });

  await client.connect();

  const poolEntry = {
    client,
    lastUsed: Date.now(),
    poolKey,
  };

  clientPool.set(poolKey, poolEntry);

  return client;
}

export function evictClient(credentials) {
  if (!credentials || credentials.length < 4) return;
  const user = credentials[0].user;
  const host = credentials[2].host;
  const port = Number(credentials[3].port) || 993;
  const poolKey = `${user}@${host}:${port}`;
  const entry = clientPool.get(poolKey);
  if (entry?.client) {
    try {
      entry.client.logout();
    } catch {}
  }
  clientPool.delete(poolKey);
}

// Periodic cleanup of connections idle for more than 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of clientPool.entries()) {
      if (now - entry.lastUsed > IDLE_TIMEOUT_MS) {
        try {
          entry.client.logout();
        } catch {}
        clientPool.delete(key);
      }
    }
  }, 60 * 1000).unref?.();
}
