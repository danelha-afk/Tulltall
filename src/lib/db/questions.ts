/**
 * Spørsmålsbanken: lagring, statusoverganger og redaksjonell historikk.
 */
import type { Db } from "./client";
import { parseQuestion, type QuestionContent, type QuestionStatus, type Scores } from "../game/schema";
import type { PoolQuestion } from "../game/rotation";

export interface QuestionRow {
  id: string;
  status: QuestionStatus;
  format: string;
  category: QuestionContent["category"];
  topic: string;
  risk: QuestionContent["risk"];
  difficulty: number;
  data_quality: number;
  content: QuestionContent;
  scores: Partial<Scores> & { priority?: number };
  qa: { ok?: boolean; errors?: string[]; warnings?: string[]; checkedAt?: string; flags?: string[] };
  finding_id: string | null;
  origin: "manual" | "seed" | "pipeline";
  version: number;
  exposure_count: number;
  last_used_on: string | null;
  last_verified_at: string | null;
  archived_reason: string | null;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
}

/** Tillatte statusoverganger. Høyrisiko kan aldri gå direkte fra validated til approved uten menneske. */
export const TRANSITIONS: Record<QuestionStatus, QuestionStatus[]> = {
  draft: ["validated", "review_required", "archived"],
  validated: ["review_required", "approved", "archived", "draft"],
  review_required: ["approved", "archived", "draft"],
  approved: ["published", "review_required", "archived"],
  published: ["archived", "review_required"],
  archived: ["review_required", "draft"],
};

export class TransitionError extends Error {}

export function canTransition(from: QuestionStatus, to: QuestionStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export async function getQuestionRow(db: Db, id: string): Promise<QuestionRow | undefined> {
  return db.one<QuestionRow>(`SELECT * FROM questions WHERE id = $1`, [id]);
}

export async function getQuestionRows(db: Db, ids: string[]): Promise<QuestionRow[]> {
  if (ids.length === 0) return [];
  const rows = await db.query<QuestionRow>(`SELECT * FROM questions WHERE id = ANY($1::text[])`, [ids]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is QuestionRow => Boolean(r));
}

export interface SaveOptions {
  status: QuestionStatus;
  actor: string;
  origin?: QuestionRow["origin"];
  note?: string;
  scores?: QuestionRow["scores"];
  qa?: QuestionRow["qa"];
  findingId?: string | null;
}

/** Oppretter eller oppdaterer et spørsmål. Innholdet valideres alltid mot skjemaet først. */
export async function saveQuestion(db: Db, input: unknown, opts: SaveOptions): Promise<QuestionRow> {
  const parsed = parseQuestion(input);
  if (!parsed.ok) throw new Error(`Ugyldig spørsmål: ${parsed.errors.join("; ")}`);
  const q = parsed.value;
  return db.tx(async (tx) => {
    const existing = await tx.one<QuestionRow>(`SELECT * FROM questions WHERE id = $1 FOR UPDATE`, [q.id]);
    if (existing && !canTransition(existing.status, opts.status)) {
      throw new TransitionError(`Kan ikke gå fra ${existing.status} til ${opts.status}`);
    }
    const version = existing ? existing.version + 1 : 1;
    const row = await tx.one<QuestionRow>(
      `INSERT INTO questions (id, locale, status, format, category, topic, risk, difficulty, data_quality, content, scores, qa,
                              finding_id, origin, version, last_verified_at, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16, CASE WHEN $3 = 'published' THEN now() END)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status, format = EXCLUDED.format, category = EXCLUDED.category, topic = EXCLUDED.topic,
         risk = EXCLUDED.risk, difficulty = EXCLUDED.difficulty, data_quality = EXCLUDED.data_quality,
         content = EXCLUDED.content, scores = COALESCE($11::jsonb, questions.scores), qa = EXCLUDED.qa,
         finding_id = COALESCE(EXCLUDED.finding_id, questions.finding_id), version = EXCLUDED.version,
         last_verified_at = EXCLUDED.last_verified_at, updated_at = now(),
         published_at = CASE WHEN EXCLUDED.status = 'published' AND questions.published_at IS NULL THEN now() ELSE questions.published_at END,
         archived_reason = CASE WHEN EXCLUDED.status = 'archived' THEN questions.archived_reason ELSE NULL END
       RETURNING *`,
      [
        q.id,
        q.locale,
        opts.status,
        q.payload.format,
        q.category,
        q.topic,
        q.risk,
        q.difficulty,
        q.dataQuality,
        JSON.stringify(q),
        JSON.stringify(opts.scores ?? existing?.scores ?? {}),
        JSON.stringify(opts.qa ?? existing?.qa ?? {}),
        opts.findingId ?? existing?.finding_id ?? null,
        opts.origin ?? existing?.origin ?? "manual",
        version,
        q.lastVerified,
      ],
    );
    await tx.query(
      `INSERT INTO question_revisions (question_id, version, action, from_status, to_status, actor, note, snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [q.id, version, existing ? "edited" : "created", existing?.status ?? null, opts.status, opts.actor, opts.note ?? null, JSON.stringify(q)],
    );
    return row!;
  });
}

export async function setQuestionStatus(
  db: Db,
  id: string,
  to: QuestionStatus,
  actor: string,
  note?: string,
): Promise<QuestionRow> {
  return db.tx(async (tx) => {
    const row = await tx.one<QuestionRow>(`SELECT * FROM questions WHERE id = $1 FOR UPDATE`, [id]);
    if (!row) throw new Error(`Fant ikke spørsmål ${id}`);
    if (!canTransition(row.status, to)) throw new TransitionError(`Kan ikke gå fra ${row.status} til ${to}`);
    if (to === "approved" && row.qa && row.qa.ok === false) {
      throw new TransitionError("Spørsmålet har feil i faktakontrollen og kan ikke godkjennes før de er rettet");
    }
    const updated = await tx.one<QuestionRow>(
      `UPDATE questions SET status = $2, updated_at = now(),
         published_at = CASE WHEN $2 = 'published' AND published_at IS NULL THEN now() ELSE published_at END,
         archived_reason = CASE WHEN $2 = 'archived' THEN $3 ELSE NULL END
       WHERE id = $1 RETURNING *`,
      [id, to, note ?? null],
    );
    const action = to === "archived" ? "archived" : to === "approved" ? "approved" : to === "published" ? "published" : "status";
    await tx.query(
      `INSERT INTO question_revisions (question_id, version, action, from_status, to_status, actor, note, snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [id, row.version, action, row.status, to, actor, note ?? null, JSON.stringify(row.content)],
    );
    return updated!;
  });
}

export async function listQuestions(
  db: Db,
  filter: { status?: QuestionStatus | QuestionStatus[]; category?: string; search?: string; limit?: number } = {},
): Promise<QuestionRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    params.push(Array.isArray(filter.status) ? filter.status : [filter.status]);
    where.push(`status = ANY($${params.length}::text[])`);
  }
  if (filter.category) {
    params.push(filter.category);
    where.push(`category = $${params.length}`);
  }
  if (filter.search) {
    params.push(`%${filter.search.toLowerCase()}%`);
    where.push(`(lower(content->>'prompt') LIKE $${params.length} OR id LIKE $${params.length})`);
  }
  params.push(filter.limit ?? 500);
  return db.query<QuestionRow>(
    `SELECT * FROM questions ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY updated_at DESC LIMIT $${params.length}`,
    params,
  );
}

export async function questionRevisions(db: Db, id: string) {
  return db.query<{ id: number; version: number; action: string; from_status: string | null; to_status: string | null; actor: string; note: string | null; created_at: Date }>(
    `SELECT id, version, action, from_status, to_status, actor, note, created_at FROM question_revisions
     WHERE question_id = $1 ORDER BY created_at DESC, id DESC`,
    [id],
  );
}

/** Spørsmål som kan brukes i daglige runder. */
export async function rotationPool(db: Db): Promise<PoolQuestion[]> {
  const rows = await db.query<QuestionRow>(`SELECT * FROM questions WHERE status IN ('approved','published')`);
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    topic: r.topic,
    format: r.content.payload.format,
    difficulty: r.difficulty,
    risk: r.risk,
    tone: r.content.tone,
    dataQuality: r.data_quality,
    exposureCount: r.exposure_count,
    lastUsedOn: r.last_used_on,
    seasonMonths: r.content.seasonMonths ?? [],
    lastVerified: r.content.lastVerified,
    priority: typeof r.scores?.priority === "number" ? r.scores.priority : undefined,
  }));
}
