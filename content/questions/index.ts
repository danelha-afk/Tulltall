/**
 * Seed-spørsmålsbanken. Hver fil er en liste med spørsmål som valideres mot
 * src/lib/game/schema.ts. Nye filer må registreres her.
 */
import fun from "./fun.json";
import society from "./society.json";
import current from "./current.json";

export const seedQuestions: unknown[] = [...fun, ...society, ...current];
