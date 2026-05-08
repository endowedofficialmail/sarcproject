type RateLimitEntry = {
  count: number;
  firstAttemptAt: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

declare global {
  // eslint-disable-next-line no-var
  var __sarcLoginRateLimitStore: Map<string, RateLimitEntry> | undefined;
}

function getStore() {
  if (!globalThis.__sarcLoginRateLimitStore) {
    globalThis.__sarcLoginRateLimitStore = new Map<string, RateLimitEntry>();
  }
  return globalThis.__sarcLoginRateLimitStore;
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || "unknown";
}

export function isRateLimited(ip: string) {
  const store = getStore();
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry) return false;

  if (now - entry.firstAttemptAt > WINDOW_MS) {
    store.delete(ip);
    return false;
  }

  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(ip: string) {
  const store = getStore();
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry) {
    store.set(ip, { count: 1, firstAttemptAt: now });
    return;
  }

  if (now - entry.firstAttemptAt > WINDOW_MS) {
    store.set(ip, { count: 1, firstAttemptAt: now });
    return;
  }

  entry.count += 1;
  store.set(ip, entry);
}

export function clearFailedAttempts(ip: string) {
  getStore().delete(ip);
}
