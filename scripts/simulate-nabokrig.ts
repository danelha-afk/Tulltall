/**
 * Simulerer Nabokrigens poengmodell med tenkte kommuner og skriver resultatet som en markdown-tabell.
 * Brukes til å dokumentere at store kommuner ikke vinner automatisk (docs/nabokrigen-poengmodell.md).
 */
import { computeWeek, DEFAULT_PARAMS } from "../src/lib/nabokrig/model";
import { seededRandom } from "../src/lib/game/prng";

const rand = seededRandom("nabokrig-sim");
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
const play = (skill: number) => Math.max(0, Math.min(1000, Math.round(skill + gauss() * 140)));

const scenarios = [
  { nr: "STOR", population: 700_000, players: 900, skill: 600 },
  { nr: "MELLOMSTOR", population: 100_000, players: 260, skill: 610 },
  { nr: "LITEN-IVRIG", population: 5_000, players: 60, skill: 600 },
  { nr: "LITEN-FLINK", population: 5_000, players: 8, skill: 700 },
  { nr: "ÉN-HELDIG", population: 800, players: 1, skill: 950 },
  { nr: "STOR-FLINK", population: 300_000, players: 300, skill: 680 },
];

const inputs = scenarios.map((s) => ({
  nr: s.nr,
  population: s.population,
  players: s.players,
  scores: Array.from({ length: s.players * 3 }, () => play(s.skill)),
}));
const res = computeWeek(inputs, DEFAULT_PARAMS);
console.log("| Kommune | Innb. | Spillere | Snitt | Justert snitt | Spillere/1000 | Kunnskap | Engasjement | Poeng | Plass |");
console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const r of res) {
  const s = scenarios.find((x) => x.nr === r.nr)!;
  console.log(
    `| ${r.nr} | ${s.population} | ${r.players} | ${r.rawMean} | ${r.shrunkMean} | ${r.playersPerThousand} | ${r.skill.toFixed(3)} | ${r.engagement.toFixed(3)} | ${r.points} | ${r.rank ?? "–"} |`,
  );
}
