import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { hasMissingSeedQuestions, seedQuestionBank } from "@/lib/db/seed";

describe("nye startspørsmål legges inn uten å røre redaktørens valg", () => {
  it("fyller bare det som mangler, og gjenoppliver ikke avviste spørsmål", async () => {
    const db = await createTestDb();
    expect(await hasMissingSeedQuestions(db)).toBe(false);

    // Et nytt startspørsmål i koden = en id som ikke finnes i databasen ennå.
    await db.query(`DELETE FROM questions WHERE id = 'kpi-2025'`);
    expect(await hasMissingSeedQuestions(db)).toBe(true);

    // Et spørsmål redaktøren har arkivert, skal bli liggende.
    await db.query(`UPDATE questions SET status = 'archived' WHERE id = 'folketall-2026'`);
    const res = await seedQuestionBank(db);
    expect(res.inserted).toBe(1);
    expect(await hasMissingSeedQuestions(db)).toBe(false);
    const archived = await db.one<{ status: string }>(`SELECT status FROM questions WHERE id = 'folketall-2026'`);
    expect(archived?.status).toBe("archived");
    await db.close();
  });
});
