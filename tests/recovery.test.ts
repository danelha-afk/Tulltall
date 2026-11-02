import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type Db } from "@/lib/db/client";
import { createRecoveryCode, formatCode, normalizeCode, restoreByCode } from "@/lib/profile/recovery";
import { getProfile, updateProfile } from "@/lib/profile/service";
import { ensurePlayer } from "@/lib/play/service";

let db: Db;
beforeAll(async () => {
  db = await createTestDb({ seed: false });
});
afterAll(async () => db.close());

describe("gjenopprettingskode", () => {
  it("formaterer og normaliserer koden", () => {
    expect(normalizeCode("K7M2-xq9P 4vbd")).toBe("k7m2xq9p4vbd");
    expect(formatCode("k7m2xq9p4vbd")).toBe("k7m2-xq9p-4vbd");
  });

  it("gir samme profil tilbake på en ny enhet, også når navnet er tatt av den gamle", async () => {
    const old = await ensurePlayer(db, null);
    expect(await updateProfile(db, old, { customName: "Tulltroll" })).toEqual({ ok: true });
    const code = await createRecoveryCode(db, old);
    expect(code).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);

    // «Ny enhet»: en ny spiller prøver samme navn og får «taken».
    const fresh = await ensurePlayer(db, null);
    expect(await updateProfile(db, fresh, { customName: "Tulltroll" })).toEqual({ ok: false, error: "taken" });

    // Koden (uansett store/små bokstaver og tegnsetting) gir den gamle profilen.
    expect(await restoreByCode(db, code.toUpperCase().replace(/-/g, " "))).toBe(old);
    expect((await getProfile(db, old))!.handle).toBe("Tulltroll");
  });

  it("avviser feil kode, og ny kode gjør den gamle ugyldig", async () => {
    const p = await ensurePlayer(db, null);
    const first = await createRecoveryCode(db, p);
    expect(await restoreByCode(db, "aaaa-aaaa-aaaa")).toBeNull();
    expect(await restoreByCode(db, "for-kort")).toBeNull();
    const second = await createRecoveryCode(db, p);
    expect(second).not.toBe(first);
    expect(await restoreByCode(db, first)).toBeNull();
    expect(await restoreByCode(db, second)).toBe(p);
  });
});
