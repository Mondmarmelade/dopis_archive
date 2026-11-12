/**
 * Network guard utility to prevent Server-Side Request Forgery (SSRF),
 * internal network port scanning, and cloud metadata access.
 */

const PRIVATE_IP_PATTERNS = [
  /^127\./,                         // Loopback
  /^10\./,                          // RFC1918 Class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // RFC1918 Class B
  /^192\.168\./,                    // RFC1918 Class C
  /^169\.254\./,                    // Link-local / Cloud Metadata (AWS, GCP, Azure)
  /^0\./,                           // Zero address
  /^::1$/,                           // IPv6 loopback
  /^fc00:/i,                         // IPv6 unique local
  /^fe80:/i,                         // IPv6 link-local
];

export function isPrivateOrReservedHost(hostname) {
  if (!hostname || typeof hostname !== "string") return true;
  const cleanHost = hostname.trim().toLowerCase();

  if (
    cleanHost === "localhost" ||
    cleanHost.endsWith(".localhost") ||
    cleanHost === "0.0.0.0" ||
    cleanHost === "::1" ||
    cleanHost === "[::1]"
  ) {
    return true;
  }

  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(cleanHost));
}

export function validateImapHost(host, port, options = {}) {
  const allowLocalhost = options.allowLocalhost ?? (process.env.NODE_ENV !== "production");
  if (!host || typeof host !== "string") {
    return { valid: false, error: "Host must be a non-empty string." };
  }

  const cleanHost = host.trim().toLowerCase();

  // Validate port
  const numPort = Number(port);
  if (!Number.isInteger(numPort) || numPort < 1 || numPort > 65535) {
    return { valid: false, error: "Invalid port number. Must be between 1 and 65535." };
  }

  const isPrivate = isPrivateOrReservedHost(cleanHost);
  if (isPrivate) {
    if (allowLocalhost && (cleanHost === "localhost" || cleanHost === "127.0.0.1")) {
      return { valid: true, host: cleanHost, port: numPort };
    }
    return {
      valid: false,
      error: "Connecting to internal or private IP addresses / localhost is not permitted.",
    };
  }

  // Basic hostname / FQDN check
  const validHostnameRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  if (!validHostnameRegex.test(cleanHost) && !/^[0-9.]+$/.test(cleanHost)) {
    return { valid: false, error: "Invalid host format. Must be a valid domain or server name." };
  }

  return { valid: true, host: cleanHost, port: numPort };
}

export function validateAiUrl(urlStr, options = {}) {
  const allowLocalhost = options.allowLocalhost ?? (process.env.NODE_ENV !== "production");
  if (!urlStr || typeof urlStr !== "string") {
    return { valid: false, error: "URL must be a non-empty string." };
  }

  let parsed;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { valid: false, error: "Malformed URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Invalid protocol. Only HTTP and HTTPS are permitted." };
  }

  const host = parsed.hostname.toLowerCase();
  const isPrivate = isPrivateOrReservedHost(host);

  if (isPrivate) {
    if (allowLocalhost && (host === "localhost" || host === "127.0.0.1")) {
      return { valid: true, url: parsed.toString() };
    }
    return {
      valid: false,
      error: "AI endpoint cannot point to private IP addresses or cloud metadata services.",
    };
  }

  return { valid: true, url: parsed.toString() };
}
