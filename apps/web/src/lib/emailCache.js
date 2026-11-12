// Client-side memory cache & deduplicated prefetcher for full email contents
const emailCache = new Map();
const inFlightRequests = new Map();

function getCacheKey(seq, folder = "inbox") {
  return `${seq}_${folder}`;
}

export function getCachedEmail(seq, folder = "inbox") {
  if (!seq) return null;
  return emailCache.get(getCacheKey(seq, folder)) || null;
}

export function setCachedEmail(seq, folder = "inbox", data) {
  if (!seq || !data) return;
  emailCache.set(getCacheKey(seq, folder), data);
}

export async function fetchEmailDetail(seq, folder = "inbox") {
  if (!seq || isNaN(Number(seq))) return null;
  const key = getCacheKey(seq, folder);

  // 1. If already in memory cache, return instantly
  if (emailCache.has(key)) {
    return emailCache.get(key);
  }

  // 2. If a request for this email is already running, join it
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  // 3. Initiate fetch
  const fetchPromise = (async () => {
    try {
      const res = await fetch(`/api/email?seq=${encodeURIComponent(seq)}&folder=${encodeURIComponent(folder)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch email (Status: ${res.status})`);
      }
      const data = await res.json();
      emailCache.set(key, data);
      return data;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, fetchPromise);
  return fetchPromise;
}

// Low-overhead background prefetcher (e.g. on mouse hover or list arrival)
export function prefetchEmail(seq, folder = "inbox") {
  if (!seq || isNaN(Number(seq))) return;
  const key = getCacheKey(seq, folder);
  if (emailCache.has(key) || inFlightRequests.has(key)) {
    return;
  }

  // Use requestIdleCallback or setTimeout to not block main thread
  if (typeof window !== "undefined") {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => {
        fetchEmailDetail(seq, folder).catch(() => {});
      });
    } else {
      setTimeout(() => {
        fetchEmailDetail(seq, folder).catch(() => {});
      }, 50);
    }
  }
}
