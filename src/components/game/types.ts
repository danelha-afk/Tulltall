import type { PublicPayload, PublicQuestion, RevealData } from "@/lib/game/public";
import type { Answer } from "@/lib/game/scoring";

export interface RevealState {
  data: RevealData;
  detail: Record<string, unknown>;
  points: number;
  hit: boolean;
  retracted: boolean;
  answer: Answer;
}

export type PayloadOf<F extends PublicPayload["format"]> = Extract<PublicPayload, { format: F }>;

export interface FormatProps<F extends PublicPayload["format"]> {
  q: PublicQuestion & { payload: PayloadOf<F> };
  onSubmit: (a: Answer) => void;
  busy: boolean;
  reveal: RevealState | null;
}
