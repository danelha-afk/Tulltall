/**
 * Temaer som får en øvre grense i daglige runder.
 *
 * Redaksjonell regel: bare ÉN av dagens spørsmål handler om likestilling/mangfold (kjønn, etnisitet,
 * innvandring, diskriminering, funksjonsnedsettelse, skeive m.m.). Resten skal være andre ting som
 * folk kanskje eller kanskje ikke vet. Spørsmål merkes med taggen `likestilling-mangfold`, og i tillegg
 * fanger emnene og nøkkelordene under de eldre spørsmålene.
 */
export const EQUALITY_TAG = "likestilling-mangfold";

const EQUALITY_TOPICS = new Set(["likestilling", "mangfold", "diskriminering", "innvandring"]);
const EQUALITY_TAGS = new Set([EQUALITY_TAG, "likestilling", "mangfold", "diskriminering", "innvandring", "kjønn", "funksjonsnedsettelse", "lhbt", "etnisitet"]);

export function isEqualityTheme(q: { topic: string; tags?: readonly string[] }): boolean {
  return EQUALITY_TOPICS.has(q.topic.toLowerCase()) || (q.tags ?? []).some((t) => EQUALITY_TAGS.has(t.toLowerCase()));
}
