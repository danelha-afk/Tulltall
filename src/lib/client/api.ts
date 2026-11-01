"use client";
import type { PublicQuestion, RevealData } from "../game/public";
import type { FinishResult, ChallengeView } from "../play/service";

export interface StartResponse {
  sessionId: string;
  token: string;
  playerId: string;
  game: { id: string; kind: string; date: string | null; roundNumber: number | null };
  questions: PublicQuestion[];
  answers: { questionId: string; points: number; hit: boolean }[];
  finished: boolean;
  kommuneNr: string | null;
  variants: Record<string, string>;
}

export interface AnswerResponse {
  index: number;
  points: number;
  hit: boolean;
  retracted: boolean;
  detail: Record<string, unknown>;
  reveal: RevealData;
  done: boolean;
}

export type SummaryResponse = FinishResult & { reveals: (RevealData & { prompt: string })[] };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function post<T>(url: string, body: unknown, method = "POST"): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "offline", "Ingen nettforbindelse");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? "error", data?.error?.message ?? "Noe gikk galt");
  return data as T;
}

export const api = {
  start: (b: { playerId?: string | null; gameId?: string; challengeCode?: string; kommuneNr?: string | null; ref?: string | null; nickname?: string | null }) =>
    post<StartResponse>("/api/sessions", b),
  answer: (sessionId: string, b: { token: string; questionId: string; index: number; answer: unknown }) =>
    post<AnswerResponse>(`/api/sessions/${sessionId}/answer`, b),
  finish: (sessionId: string, token: string) => post<FinishResult>(`/api/sessions/${sessionId}/finish`, { token }),
  summary: (sessionId: string, token: string) => post<SummaryResponse>(`/api/sessions/${sessionId}/summary`, { token }),
  challenge: (b: { sessionId: string; token: string; nickname?: string | null }) => post<{ code: string; url: string }>("/api/challenges", b),
  getChallenge: async (code: string, session?: string | null): Promise<ChallengeView> => {
    const res = await fetch(`/api/challenges/${code}${session ? `?session=${session}` : ""}`);
    if (!res.ok) throw new ApiError(res.status, "not_found", "Fant ikke utfordringen");
    return res.json();
  },
  player: (b: { playerId?: string | null; kommuneNr?: string | null; relation?: "bor" | "heier" | null; nickname?: string | null }) =>
    post<{ playerId: string }>("/api/player", b),
  deletePlayer: (playerId: string) => post<{ ok: boolean }>("/api/player", { playerId }, "DELETE"),
  subscribePush: (subscription: PushSubscriptionJSON, playerId: string | null) => post<{ ok: boolean }>("/api/push", { subscription, playerId }),
};
