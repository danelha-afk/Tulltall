# Datamotoren: fra SSB-tabell til spillspørsmål

## SSB PxWebApi v2

Klienten (`src/lib/data/ssb/client.ts`) er skrevet mot den offisielle OpenAPI-spesifikasjonen for PxWebApi 2 (`/config`, `/tables`, `/tables/{id}`, `/tables/{id}/metadata`, `/tables/{id}/data`) og SSBs brukerveiledning.

- **Dynamiske grenser:** `/config` gir `maxDataCells`, `maxCallsPerTimeWindow` og `timeWindow`. Faller tilbake til dokumenterte 800 000 celler og 30 kall per 60 sekunder.
- **Glidende vindu** for kall, med to kall i sikkerhetsmargin.
- **Retry:** `Retry-After` respekteres ved 429. Ved 5xx og nettverksfeil brukes eksponentiell backoff, maks 4 forsøk og tidsavbrudd per kall.
- **Oppdeling:** uttrekk over 90 % av cellegrensen deles automatisk på den største dimensjonen.
- **Hurtigbuffer:** samme URL hentes aldri to ganger i samme kjøring.
- **Format:** JSON-stat 2.0 (`jsonstat.ts`). Skjermede og manglende verdier (`:`, `..`, `.`) bevares med statussymbol.

## Unngå unødvendige uttrekk

1. `GET /tables?pastDays=8` viser hvilke tabeller som er oppdatert siden forrige uke. Interessante tabeller utenfor katalogen lagres som *kandidater* til vurdering i admin.
2. For hver tabell i katalogen sammenlignes `updated` med forrige kjøring. Uendret tabell hentes ikke.
3. Er tabellen endret, beregnes en innholdshash. Er dataene like, lages ingen ny versjon.
4. Ny versjon lagres som **delta** (bare nye og endrede celler), og reviderte verdier skrives til `observation_revisions`.
5. `structure_hash` (dimensjoner og koder utenom tid) oppdager endret tabellstruktur og gir varsel i rapporten.

## Katalog og utvalgsregler

`src/lib/data/catalog.ts` beskriver hvilke tabeller som følges og hvilke mål som beregnes. Utvalget uttrykkes som regler som løses opp mot metadata:

| Regel | Betydning |
|---|---|
| `kommuner` | Gjeldende kommunenummer |
| `last n` | De siste n periodene |
| `total` | Totalkoden ut fra etikett eller kode |
| `label` / `pattern` | Etikett eller kode som matcher et mønster |

Forsvunne koder eller dimensjoner gir en tydelig feil i stedet for stille, gale tall.

> **Viktig:** Utviklingsmiljøet hadde ikke nettilgang til `data.ssb.no`, så katalogoppføringene er merket `verified: false`. De er skrevet etter dokumentasjonen, men ikke prøvekjørt mot API-et. Første kjøring av `weekly-content.yml` viser om utvalgsreglene treffer. Feil vises i rapporten og under *Admin → Data og automatisering*.

## Analyse (deterministisk)

`analysis.ts` beregner mål (summer, andeler med teller/nevner, per innbygger) og lager funn:

| Funn | Hva det er |
|---|---|
| `extremes` | Høyest/lavest blant kommuner, med z-score og snitt. Små kommuner under minstegrensen holdes utenfor. |
| `rivalry` | Kjente rivalpar med minst 8 % forskjell, slik at fasit er entydig. |
| `rank` | Fire store byer, med minst 2 % avstand mellom verdiene. |
| `change` | Største prosentvise endring over perioden. |
| `trend` / `stable` | Nasjonale tidsserier: dramatisk endring eller påfallende stabilitet. |

Hvert funn bærer med seg eksakt uttrekks-URL, tidspunktet SSB oppdaterte tabellen og vakter (skjermede verdier, ekskluderte små enheter).

## Fra funn til spørsmål

1. **Maler** (`templates.ts`) lager et komplett, gyldig utkast med tall bare fra funnet.
2. **Claude** (`claude.ts`) forbedrer tekstfelt via strukturert JSON-utdata (zod-skjema) og gir interne anslag i ni dimensjoner pluss forslag til risiko og manuell gjennomgang. Modell: `claude-opus-5-5` (styres av `CLAUDE_MODEL`). Server-side fallback ved avvisning fra sikkerhetsklassifisering er slått på. Kostnaden logges per kall, og kjøringen stopper ved budsjettgrensen.
3. **Faktakontroll** (`qa/validate.ts`) i streng modus: tall i teksten må finnes i funnet, risiko kan bare økes, og årsaksspråk, moralisering og «myter» flagges eller avvises. Duplikater avvises også.
4. **Status:** feil gir `draft`. Høy risiko, flagg eller KI-ønske om gjennomgang gir `review_required`. Bare forhåndsgodkjente lavrisikomaler kan auto-godkjennes, og bare hvis du har slått det på.
5. **Syntetiske data** (fra `fixtures.ts`) merkes og kan aldri komme forbi `validated`.

## Etterkontroll

Spørsmål med `binding` (tabell og utvalg) kontrolleres på nytt når tabellen oppdateres (`revalidate.ts`). Ved avvik over toleransen går spørsmålet til `review_required` og fjernes fra kommende, ulåste runder.

## Demonstrasjon

```bash
npm run pipeline:demo
```

Kjører hele løpet på syntetiske data med samme struktur som SSB-tabell 07459 og skriver ut rapporten og eksempelspørsmål. Med `--claude` (og `ANTHROPIC_API_KEY`) brukes ekte Claude-formulering. Mot ekte data: `npm run pipeline:weekly`.
