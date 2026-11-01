import "server-only";

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Server-side konfigurasjon. Hemmeligheter leses kun her og eksponeres aldri til klienten. */
export const serverEnv = {
  get sessionSecret(): string {
    const s = process.env.SESSION_SECRET;
    if (s && s.length >= 24) return s;
    if (process.env.NODE_ENV === "production" && !process.env.ALLOW_INSECURE_DEV_SECRET) {
      throw new Error("SESSION_SECRET mangler eller er for kort (minst 24 tegn).");
    }
    return "dev-only-secret-not-for-production-use";
  },
  get adminPassword(): string | undefined {
    return process.env.ADMIN_PASSWORD || undefined;
  },
  get cronSecret(): string | undefined {
    return process.env.CRON_SECRET || undefined;
  },
  get minAnswerMs(): number {
    return num("MIN_ANSWER_MS", 350);
  },
  get comparisonMinPlayers(): number {
    return num("COMPARISON_MIN_PLAYERS", 30);
  },
};
