/**
 * Napi, folyamaton belüli eredmény-cache (pl. „Mi a dolgom ma?” profilonként).
 *
 * - Kulcs: `<azonosító>:<budapesti nap>` → éjfélkor magától lejár.
 * - Párhuzamos kérések (több fül, React StrictMode) EGY AI-hívást osztanak meg.
 * - Újraindításkor (deploy) kiürül — legfeljebb egy újabb hívás profilonként.
 */

function budapestDay(now: Date): string {
  // sv-SE formátum = YYYY-MM-DD
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Budapest" }).format(now);
}

export function createDailyCache<T>(maxEntries = 5000) {
  const results = new Map<string, T>();
  const inflight = new Map<string, Promise<T>>();

  const keyOf = (id: string, now: Date) => `${id}:${budapestDay(now)}`;

  function prune(today: string) {
    if (results.size <= maxEntries) return;
    for (const k of Array.from(results.keys())) {
      if (!k.endsWith(`:${today}`)) results.delete(k);
    }
  }

  return {
    /** A mai cache-elt eredmény, ha van. */
    peek(id: string, now = new Date()): T | undefined {
      return results.get(keyOf(id, now));
    },

    /**
     * A mai eredmény; ha nincs (vagy `force`), a `create` lefut és az eredmény
     * a mai napra eltárolódik. Hibánál nem tárol semmit.
     * Visszaadja azt is, hogy ténylegesen futott-e új generálás (`fresh`).
     */
    async getOrCreate(id: string, create: () => Promise<T>, opts: { force?: boolean; now?: Date } = {}): Promise<{ value: T; fresh: boolean }> {
      const now = opts.now ?? new Date();
      const key = keyOf(id, now);
      if (!opts.force) {
        const hit = results.get(key);
        if (hit !== undefined) return { value: hit, fresh: false };
        const pending = inflight.get(key);
        if (pending) return { value: await pending, fresh: false };
      }
      const p = create();
      inflight.set(key, p);
      try {
        const value = await p;
        results.set(key, value);
        prune(budapestDay(now));
        return { value, fresh: true };
      } finally {
        if (inflight.get(key) === p) inflight.delete(key);
      }
    },

    clear() {
      results.clear();
      inflight.clear();
    },
  };
}
