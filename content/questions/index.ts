/**
 * Seed-spørsmålsbanken. Hver fil er en liste med spørsmål som valideres mot
 * src/lib/game/schema.ts. Nye filer må registreres her.
 */
import fun from "./fun.json";
import society from "./society.json";
import current from "./current.json";
import enkle from "./enkle.json";

export const seedQuestions: unknown[] = [...fun, ...society, ...current, ...enkle];

/**
 * Spørsmål som alltid starter i godkjenningskøen, uansett risiko – fordi tallene er kontrollert mot
 * søkeresultater og ikke mot kildenes egne tabeller (se `verification` på hvert spørsmål).
 */
export const seedReviewOnlyIds: ReadonlySet<string> = new Set(enkle.map((q) => q.id));
