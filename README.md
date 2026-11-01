# TULL ELLER TALL?

**Du tror du vet. Men gjør du det?**

Et norsk, sosialt kunnskapsspill: ti påstander og tall om Norge hver dag. Spilleren gjetter, får fasiten servert som en liten forestilling og kan utfordre en venn. Bak spillet ligger en datamotor som henter statistikk fra SSB, finner overraskende funn og lager spørsmålsforslag. En KI-redaksjon (Claude) formulerer forslagene, og deterministisk faktakontroll og menneskelig godkjenning stopper alt som ikke holder.

Bygget som en Progressive Web App med Next.js 16, TypeScript, Tailwind CSS 4, Motion og PostgreSQL (Supabase i produksjon, PGlite lokalt).

> **Status:** Spillbar MVP med komplett spill, vennedueller, Nabokrigen, datamotor, KI-redaksjon, administrasjon, analyse og PWA. **Ikke produksjonsklar ennå.** Se [docs/status.md](docs/status.md) for nøyaktig hva som er testet og hva som gjenstår.

## Se og klikk deg gjennom

**A) På din egen maskin (5 minutter, ingen kontoer):** Installer [Node.js](https://nodejs.org) (versjon 20 eller nyere). Kjør så i Terminal:

```bash
git clone https://github.com/danelha-afk/Tulltall.git
cd Tulltall
git checkout claude/tulltall-mvp
npm install
npm run build && SESSION_SECRET=lokal-test-lokal-test-lokal-test ADMIN_PASSWORD=velg-et-passord npm start
```

Åpne http://localhost:3000, eller http://<maskinens-IP>:3000 fra mobilen på samme nett. Administrasjonen ligger på `/admin`.

**B) På nett med egen lenke (ca. 15 minutter, gratisnivåer):**

1. Lag en konto på [vercel.com](https://vercel.com) med GitHub-brukeren din, og velg **Add New → Project → Import** `danelha-afk/Tulltall` (grenen `claude/tulltall-mvp`).
2. Under **Environment Variables** legger du inn:
   - `SESSION_SECRET` – en lang, tilfeldig tekst (minst 24 tegn)
   - `ADMIN_PASSWORD` – minst 10 tegn
   - `AUTO_MIGRATE` = `true`
3. Etter første deploy: åpne prosjektet → **Storage → Create/Connect Database → Supabase** (gratis). Vercel legger da inn `POSTGRES_URL` automatisk. Har du allerede en Supabase-database, kan du i stedet sette `DATABASE_URL` til «Transaction pooler»-adressen.
4. Velg **Redeploy**. Ved første besøk lager appen tabellene og legger inn startbanken. Lenken (`…vercel.app`) kan åpnes og deles fra mobilen.

> Vercel trenger en ekte database. Den innebygde testdatabasen (PGlite) virker bare på én maskin.

## Kom i gang lokalt (utvikling)

Krever Node.js 20.9+ (testet med 22). Ingen database å installere: uten `DATABASE_URL` brukes PGlite (Postgres i WebAssembly) i `.data/pglite`. Databasen migreres og seedes automatisk.

```bash
npm install
cp .env.example .env.local      # fyll inn SESSION_SECRET og ADMIN_PASSWORD
npm run dev                     # http://localhost:3000
```

- Spillet: `/` og `/spill`
- Administrasjon: `/admin` (passord fra `ADMIN_PASSWORD`, minst 10 tegn)
- Demo av datamotoren uten nett: `npm run pipeline:demo` (bruker **syntetiske** testdata som aldri kan publiseres)

## Skript

| Kommando | Hva den gjør |
|---|---|
| `npm run dev` / `build` / `start` | Utvikling, produksjonsbygg, produksjonsserver |
| `npm test` | Enhets- og integrasjonstester (Vitest, ekte Postgres-SQL via PGlite) |
| `npm run test:e2e` | Ende-til-ende i mobil-Chromium (Playwright + axe-tilgjengelighetssjekk). Kjør `npm run build` først |
| `npm run typecheck` | TypeScript-kontroll |
| `npm run content:validate` | Faktakontroll av hele seed-banken |
| `npm run db:migrate` / `db:seed` | Migrer og seed databasen i `DATABASE_URL` |
| `npm run pipeline:weekly [-- --force]` | Ukentlig innholdsjobb mot ekte SSB-data |
| `npm run pipeline:demo [-- --claude]` | Hele løpet tabell → spørsmål med syntetiske data |
| `npm run games:schedule [dager]` | Planlegg daglige runder |
| `npm run nabokrig:simulate` | Simuler Nabokrigens poengmodell |
| `npm run icons` / `npm run vapid` | Generer PWA-ikoner / VAPID-nøkler for push |

## Publisering (Vercel + Supabase + GitHub Actions)

1. **Database:** Opprett et Supabase-prosjekt. Kopier connection string for *Transaction pooler* (port 6543) til `DATABASE_URL`. Kjør `DATABASE_URL=… npm run db:migrate && npm run db:seed` én gang.
2. **Vercel:** Importer repoet. Sett miljøvariablene fra `.env.example`, minst `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `CRON_SECRET` og `NEXT_PUBLIC_SITE_URL`. `vercel.json` setter opp daglig cron mot `/api/cron/daily`, som publiserer dagens runde, planlegger neste uke og sender varsler.
   *Merk: Vercels gratisnivå (Hobby) er ikke for kommersiell bruk. Bruk Pro når annonser slås på.*
3. **GitHub Actions:** Legg inn hemmelighetene `DATABASE_URL`, `ANTHROPIC_API_KEY` og eventuelt `ALERT_WEBHOOK_URL` under *Settings → Secrets and variables → Actions*.
   - `weekly-content.yml` kjører datamotoren hver mandag (og manuelt med «Run workflow»).
   - `daily.yml` er et alternativ til Vercel Cron og krever `SITE_URL` (variabel) og `CRON_SECRET`.
   - `ci.yml` kjører typekontroll, innholdsvalidering, tester, bygg og ende-til-ende-tester på hver push.
4. **Domene:** Navn og domene styres av `NEXT_PUBLIC_SITE_NAME` og `NEXT_PUBLIC_SITE_URL`. *tulltall.no er ikke bekreftet ledig.*
5. **Push-varsler (valgfritt):** `npm run vapid` → legg nøklene i miljøvariablene.
6. **Annonser (valgfritt):** Se [docs/annonser-og-personvern.md](docs/annonser-og-personvern.md). Annonser er av som standard.

## Dokumentasjon

- [Produktvurdering og utfordrede premisser](docs/produktvurdering.md)
- [Designkonsepter, valg og designsystem](docs/designkonsept.md)
- [Arkitektur](docs/arkitektur.md) · [Database](docs/database.md)
- [Datamotoren (SSB) og automatisk oppdagelse](docs/datamotor.md)
- [Redaksjon, KI og faktakontroll](docs/redaksjon.md)
- [Nabokrigens poengmodell](docs/nabokrigen-poengmodell.md)
- [Annonser, samtykke og personvern](docs/annonser-og-personvern.md)
- [Forventede driftskostnader](docs/kostnader.md)
- [Lanseringsstrategi](docs/lansering.md)
- [Status: ferdig, testet og gjenstående](docs/status.md)

## Mappestruktur

```
content/            Seed-spørsmål (JSON) og kommuneliste
src/app/            Sider, API-ruter, administrasjon, manifest, delingsbilder
src/components/     Designsystem (ui/), spillformater (game/), nettsted (site/), Nabokrigen
src/lib/game/       Skjema, poeng, rotasjon, offentlig/skjult visning
src/lib/play/       Spilltjenesten (økter, svar, utfordringer, juksevern)
src/lib/data/       SSB-klient, JSON-stat, utvalg, innhenting, analyse, etterkontroll
src/lib/editorial/  Maler, Claude-redaksjon, produksjonslinje
src/lib/qa/         Deterministisk faktakontroll
src/lib/pipeline/   Ukentlig jobb og rapport
src/lib/db/         Migrasjoner, databaseklient, repositorier, seed
src/lib/i18n/       Språkkataloger (alle UI-tekster)
tests/ e2e/         Vitest- og Playwright-tester
```
