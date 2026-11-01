"use client";
/**
 * Lokal lagring av progresjon. Alt pakkes i try/catch: privat modus og blokkert lagring
 * skal aldri stoppe spillet.
 */

export interface HistoryEntry {
  gameId: string;
  date: string | null;
  kind: string;
  score: number;
  maxScore: number;
  hits: number;
  total: number;
  titleKey: string;
  pattern: boolean[];
  at: string;
}

export interface KommuneChoice {
  nr: string;
  name: string;
  slug: string;
  relation: "bor" | "heier";
}

export interface Consent {
  v: 1;
  analytics: boolean;
  ads: boolean;
  at: string;
}

const K = {
  player: "tt.player",
  history: "tt.history",
  kommune: "tt.kommune",
  consent: "tt.consent",
  session: (gameId: string) => `tt.session.${gameId}`,
  nickname: "tt.nickname",
  ref: "tt.ref",
};

function read<T>(key: string, fallback: T, storage: "local" | "session" = "local"): T {
  try {
    const s = storage === "local" ? window.localStorage : window.sessionStorage;
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown, storage: "local" | "session" = "local"): void {
  try {
    const s = storage === "local" ? window.localStorage : window.sessionStorage;
    if (value === null || value === undefined) s.removeItem(key);
    else s.setItem(key, JSON.stringify(value));
  } catch {
    /* lagring utilgjengelig – spillet fungerer likevel */
  }
}

export const store = {
  getPlayerId: () => read<string | null>(K.player, null),
  setPlayerId: (id: string) => write(K.player, id),
  getHistory: () => read<HistoryEntry[]>(K.history, []),
  addHistory(entry: HistoryEntry) {
    const list = read<HistoryEntry[]>(K.history, []).filter((h) => h.gameId !== entry.gameId);
    list.unshift(entry);
    write(K.history, list.slice(0, 400));
  },
  clearHistory() {
    write(K.history, null);
  },
  getKommune: () => read<KommuneChoice | null>(K.kommune, null),
  setKommune: (k: KommuneChoice | null) => write(K.kommune, k),
  getConsent: () => read<Consent | null>(K.consent, null),
  setConsent: (c: Consent) => write(K.consent, c),
  getSession: (gameId: string) => read<{ sessionId: string; token: string } | null>(K.session(gameId), null),
  setSession: (gameId: string, s: { sessionId: string; token: string }) => write(K.session(gameId), s),
  getNickname: () => read<string>(K.nickname, ""),
  setNickname: (n: string) => write(K.nickname, n),
  getRef: () => read<string | null>(K.ref, null, "session"),
  setRef: (r: string) => write(K.ref, r, "session"),
};

/** Antall dager på rad med fullført daglig runde (inkludert i dag eller i går). */
export function computeStreak(history: HistoryEntry[], today: string): number {
  const days = new Set(history.filter((h) => h.kind === "daily" && h.date).map((h) => h.date!));
  const step = (d: string, n: number) => {
    const x = new Date(`${d}T12:00:00Z`);
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  };
  let cursor = days.has(today) ? today : step(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = step(cursor, -1);
  }
  return streak;
}

export function personalBest(history: HistoryEntry[], excludeGameId?: string): number | null {
  const scores = history.filter((h) => h.kind === "daily" && h.gameId !== excludeGameId).map((h) => h.score);
  return scores.length ? Math.max(...scores) : null;
}
