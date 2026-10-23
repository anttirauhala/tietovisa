import "server-only";

/**
 * Yksinkertainen liukuva ikkuna -nopeusrajoitin.
 *
 * Rajoitus on prosessikohtainen (muistissa). Se riittää yhden instanssin
 * pikkujoulu-MVP:hen ja estää ilmeisimmän väärinkäytön. Moni-instanssisessa
 * tuotannossa tilalle vaihdetaan jaettu tallennus (esim. Redis).
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function sweep(now: number): void {
  if (buckets.size < MAX_BUCKETS) {
    return;
  }
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Palvelinympäristössä luotettavin saatavilla oleva asiakastunniste.
 * Osoite on käyttäjän hallittavissa, joten rajoitin on vain hidaste.
 */
export function getClientKey(request: Request, scope: string): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "tuntematon";
  return `${scope}:${ip}`;
}
