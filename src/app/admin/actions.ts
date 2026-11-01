"use server";
/**
 * Server actions for administrasjonen. Hver handling sjekker innlogging først.
 * Next.js beskytter server actions mot CSRF (Origin-kontroll).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDb } from "@/lib/db/client";
import { endAdminSession, passwordMatches, requireAdmin, startAdminSession } from "@/lib/admin/auth";
import { getQuestionRow, saveQuestion, setQuestionStatus, TransitionError } from "@/lib/db/questions";
import { regenerateDailyGame, scheduleUpcoming } from "@/lib/db/games";
import { saveSettings, SettingsSchema, ExperimentSchema } from "@/lib/db/settings";
import { validateQuestion } from "@/lib/qa/validate";
import { parseQuestion, type QuestionStatus } from "@/lib/game/schema";
import { localDate } from "@/lib/game/dates";
import { pullFromUpcoming } from "@/lib/data/revalidate";
import { rateLimit, LIMITS } from "@/lib/security/ratelimit";
import { ipHash } from "@/lib/security/crypto";
import { serverEnv } from "@/lib/config/env";
import { z } from "zod";

export type ActionState = { ok: boolean; message: string; errors?: string[] } | null;

export async function login(_prev: ActionState, form: FormData): Promise<ActionState> {
  const db = await getDb();
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "0").split(",")[0].trim();
  const rl = await rateLimit(db, `admin-login:${ipHash(ip, serverEnv.sessionSecret, localDate())}`, LIMITS.adminLogin.limit, LIMITS.adminLogin.window);
  if (!rl.ok) return { ok: false, message: "For mange forsøk. Vent noen minutter." };
  if (!passwordMatches(String(form.get("password") ?? ""))) return { ok: false, message: "Feil passord (eller ADMIN_PASSWORD er ikke satt)." };
  await startAdminSession();
  redirect("/admin");
}

export async function logout() {
  await endAdminSession();
  redirect("/admin/login");
}

export async function changeStatus(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const to = String(form.get("to")) as QuestionStatus;
  const note = String(form.get("note") ?? "").slice(0, 500) || undefined;
  const db = await getDb();
  try {
    await setQuestionStatus(db, id, to, "admin", note);
    if (to === "archived" || to === "review_required") await pullFromUpcoming(db, id);
  } catch (err) {
    if (err instanceof TransitionError) redirect(`/admin/sporsmal/${id}?feil=${encodeURIComponent(err.message)}`);
    throw err;
  }
  revalidatePath("/admin", "layout");
  const back = String(form.get("back") ?? "");
  if (back.startsWith("/admin")) redirect(back);
}

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export async function saveQuestionForm(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const db = await getDb();
  const id = String(form.get("id"));
  const row = await getQuestionRow(db, id);
  if (!row) return { ok: false, message: "Fant ikke spørsmålet." };
  let payload: unknown;
  let sources: unknown;
  try {
    payload = JSON.parse(String(form.get("payload")));
    sources = JSON.parse(String(form.get("sources")));
  } catch {
    return { ok: false, message: "Svardata eller kilder er ikke gyldig JSON." };
  }
  const deepDive = String(form.get("deepDive") ?? "").trim();
  const candidate = {
    ...row.content,
    prompt: String(form.get("prompt") ?? "").trim(),
    kicker: String(form.get("kicker") ?? "").trim() || undefined,
    category: String(form.get("category")),
    topic: String(form.get("topic") ?? "").trim(),
    difficulty: Number(form.get("difficulty")),
    risk: String(form.get("risk")),
    tone: String(form.get("tone")),
    shareText: String(form.get("shareText") ?? "").trim() || undefined,
    referencePeriod: String(form.get("referencePeriod") ?? "").trim(),
    calculation: String(form.get("calculation") ?? "").trim() || undefined,
    lastVerified: String(form.get("lastVerified") ?? ""),
    verification: { method: String(form.get("verificationMethod")), note: String(form.get("verificationNote") ?? "").trim() || undefined },
    reveal: {
      headline: String(form.get("headline") ?? "").trim(),
      explanation: String(form.get("explanation") ?? "").trim(),
      deepDive: deepDive || undefined,
      caveats: lines(form.get("caveats")),
    },
    payload,
    sources,
  };
  const parsed = parseQuestion(candidate);
  if (!parsed.ok) return { ok: false, message: "Spørsmålet er ikke gyldig.", errors: parsed.errors };
  const existing = (await db.query<{ id: string; prompt: string }>(`SELECT id, content->>'prompt' AS prompt FROM questions WHERE id <> $1`, [id])).map((r) => r);
  const qa = validateQuestion(parsed.value, { existing, today: localDate() });
  // Endringer i godkjent/publisert innhold krever ny godkjenning.
  const nextStatus: QuestionStatus = !qa.ok ? (row.status === "draft" ? "draft" : "review_required") : row.status === "published" || row.status === "approved" ? "review_required" : row.status;
  try {
    await saveQuestion(db, parsed.value, {
      status: nextStatus,
      actor: "admin",
      note: String(form.get("note") ?? "").slice(0, 500) || "Redigert i administrasjonen",
      qa: { ok: qa.ok, errors: qa.errors, warnings: qa.warnings, flags: qa.flags, checkedAt: new Date().toISOString() },
    });
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
  revalidatePath(`/admin/sporsmal/${id}`);
  return {
    ok: qa.ok,
    message: qa.ok
      ? nextStatus === "review_required" && row.status !== "review_required"
        ? "Lagret. Endret innhold må godkjennes på nytt før det brukes."
        : "Lagret og kontrollert."
      : "Lagret, men faktakontrollen fant feil som må rettes før godkjenning.",
    errors: [...qa.errors, ...qa.flags.map((f) => `Flagg: ${f}`), ...qa.warnings.map((w) => `Merknad: ${w}`)],
  };
}

export async function scheduleAction() {
  await requireAdmin();
  await scheduleUpcoming(await getDb(), localDate(), 14);
  revalidatePath("/admin/runder");
}

export async function regenerateAction(form: FormData) {
  await requireAdmin();
  const date = String(form.get("date"));
  try {
    await regenerateDailyGame(await getDb(), date);
  } catch (err) {
    redirect(`/admin/runder?feil=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/admin/runder");
}

export async function saveSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const num = (k: string) => Number(String(form.get(k) ?? "").replace(",", "."));
  let experiments: unknown;
  try {
    experiments = z.array(ExperimentSchema).parse(JSON.parse(String(form.get("experiments") ?? "[]")));
  } catch {
    return { ok: false, message: "A/B-testene er ikke gyldig JSON (se eksempelet)." };
  }
  const mix = { fun: num("mixFun") / 100, misconception: num("mixMisconception") / 100, current: num("mixCurrent") / 100 };
  const sum = mix.fun + mix.misconception + mix.current;
  if (Math.abs(sum - 1) > 0.011) return { ok: false, message: `Innholdsmiksen må summere til 100 % (nå ${Math.round(sum * 100)} %).` };
  const patch = {
    contentMix: mix,
    roundSize: num("roundSize"),
    cooldownDays: num("cooldownDays"),
    maxPerTopic: num("maxPerTopic"),
    maxPerFormat: num("maxPerFormat"),
    staleDays: num("staleDays"),
    autoPublishLowRisk: form.get("autoPublishLowRisk") === "on",
    adsEnabled: form.get("adsEnabled") === "on",
    aiMonthlyBudgetUsd: num("aiMonthlyBudgetUsd"),
    aiRunBudgetUsd: num("aiRunBudgetUsd"),
    aiMaxCandidatesPerRun: num("aiMaxCandidatesPerRun"),
    nabokrigMinPlayers: num("nabokrigMinPlayers"),
    experiments,
  };
  const parsed = SettingsSchema.partial().safeParse(patch);
  if (!parsed.success) return { ok: false, message: "Ugyldige verdier.", errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  await saveSettings(await getDb(), parsed.data);
  revalidatePath("/admin/innstillinger");
  return { ok: true, message: "Innstillingene er lagret. Nye runder bruker dem fra neste planlegging." };
}

export async function saveRevenueAction(form: FormData) {
  await requireAdmin();
  const month = String(form.get("month"));
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  const n = (k: string) => Math.max(0, Number(String(form.get(k) ?? "0").replace(",", ".")) || 0);
  await (await getDb()).query(
    `INSERT INTO revenue_entries (month, ad_revenue_nok, other_revenue_nok, hosting_cost_nok, note, updated_at) VALUES ($1,$2,$3,$4,$5, now())
     ON CONFLICT (month) DO UPDATE SET ad_revenue_nok = EXCLUDED.ad_revenue_nok, other_revenue_nok = EXCLUDED.other_revenue_nok,
       hosting_cost_nok = EXCLUDED.hosting_cost_nok, note = EXCLUDED.note, updated_at = now()`,
    [month, n("ad"), n("other"), n("hosting"), String(form.get("note") ?? "").slice(0, 300)],
  );
  revalidatePath("/admin/analyse");
}
