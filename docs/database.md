# Datamodell

Migrasjoner ligger i `src/lib/db/migrations.ts` og kjøres med `npm run db:migrate`. De er append-only: legg alltid til en ny migrasjon i stedet for å endre en som er kjørt.

## Innhold og redaksjon

| Tabell | Innhold |
|---|---|
| `questions` | Ett spørsmål. `content` (jsonb) er hele spørsmålet, validert av zod-skjemaet i `src/lib/game/schema.ts`. Kolonnene `status`, `category`, `risk` og `format` dupliseres for spørringer. I tillegg: `scores` (interne anslag og prioritet), `qa` (siste faktakontroll), `exposure_count`, `last_used_on` og `finding_id` (sporbarhet til datafunn). |
| `question_revisions` | Full redaksjonell historikk med øyeblikksbilde, handling, fra/til-status, aktør og notat. Brukes til retting og tilbaketrekking. |
| `findings` | Statistiske funn fra datamotoren med alle beregnede tall, heuristikker og proveniens. |

**Statuser:** `draft` → `validated` → `review_required` → `approved` → `published` → `archived`. Tillatte overganger står i `TRANSITIONS` (`src/lib/db/questions.ts`). Et spørsmål med feil i faktakontrollen kan ikke godkjennes.

## Data og proveniens

| Tabell | Innhold |
|---|---|
| `sources` | Datakilder (SSB m.fl.). |
| `datasets` | Én overvåket tabell eller ett utvalg: `source_updated_at` fra SSB, `structure_hash` for å oppdage endret struktur, og status (`active`/`candidate`/`error`/`discontinued`). |
| `dataset_versions` | Ett uttrekk: eksakt URL, innholdshash, antall celler, skjermede og manglende verdier, dimensjoner, enheter og merknader. `synthetic` markerer testdata. |
| `observations` | Celleverdier lagret som delta. Første versjon har alle celler, senere versjoner bare nye og endrede celler. Nøkkelen (`cell_key`) koder dimensjonene. |
| `observation_revisions` | Gammel og ny verdi når SSB reviderer et tall. |

## Spill

| Tabell | Innhold |
|---|---|
| `games` | Daglige runder (`d-YYYY-MM-DD`), enkeltspørsmål (`q-<id>`) og fremtidige egendefinerte runder (`custom`). Lagrer spørsmålsrekkefølge, frø, status, diagnostikk fra rotasjonen og låsetidspunkt. |
| `players` | Tilfeldig UUID med valgfri kommune (`bor`/`heier`) og kallenavn. Ingen e-post eller navn. |
| `sessions` | Én spillers runde: frosne spørsmål-ID-er, svar (jsonb), poeng, treff, om runden teller i Nabokrigen, daglig IP-hash, henvisning (`ref`) og A/B-varianter. |
| `challenges` | Utfordringslenker (kort kode) knyttet til runde og skaperens økt. |
| `kommuner` | 357 kommuner (inndeling fra 2024) med fylke, alternative navn, folketall per 1.1.2024 og areal. Folketallet oppdateres av datamotoren. |

## Drift og analyse

| Tabell | Innhold |
|---|---|
| `events` | Anonyme hendelser. `player_id` lagres bare ved samtykke. Slettes etter 13 måneder (ukentlig jobb). |
| `push_subscriptions` | Abonnement for nettleservarsler. |
| `rate_limits` | Tellere per nøkkel og tidsvindu. |
| `pipeline_runs` | Hver automatisk kjøring med statistikk, rapport (markdown) og feil. |
| `ai_usage` | Hvert Claude-kall: modell, tokens, kostnad og om det lyktes. |
| `settings` | Driftsinnstillinger (innholdsmiks, budsjetter, A/B-tester). |
| `revenue_entries` | Månedlige inntekter og kostnader for RPM og lønnsomhet. |

## Spillerprofiler og topplister (migrasjon 0002)

`players` har fått kolonnene `handle` (spillernavn), `handle_custom` (valgt selv), `show_on_lists` (frivillig, av som standard) og `hidden_by_admin`.
Alle får et tilfeldig navn (`Adjektiv Dyr NN`) første gang de spiller. Egne navn er unike uavhengig av store/små bokstaver (delvis unik indeks) og går gjennom
filteret i `src/lib/profile/names.ts`. Topp 10 (`src/lib/toplist/queries.ts`) viser bare spillere med `show_on_lists AND NOT hidden_by_admin`.
Ukelisten er summen av dagspoeng mandag–søndag. Rangering for «din plassering» regnes blant alle som har fullført, ikke bare de som er synlige.

