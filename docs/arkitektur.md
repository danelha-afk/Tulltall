# Arkitektur

```
            ┌──────────────────────── Nettleser (PWA) ────────────────────────┐
            │  Spill (6 formater) · Resultatbillett · Utfordring · Nabokrigen │
            │  localStorage: spiller-ID, historikk, kommune, samtykke         │
            │  Service worker: app-skall, offline, push                       │
            └──────────────┬──────────────────────────────────────────────────┘
                           │ JSON (ingen fasit før svaret er levert)
┌──────────────────────────▼────────────────── Next.js 16 (Vercel) ─────────────────┐
│ API: /api/sessions · /answer · /finish · /challenges · /player · /events · /push  │
│ Sider (server components): forside, spill, /u/[kode], /s/[id], Nabokrigen, admin  │
│ Delingsbilder: opengraph-image (next/og)                                          │
│ Cron: /api/cron/daily (publiser runde, planlegg uke, send varsler)                │
└───────────┬───────────────────────────────────────────────────────────────────────┘
            │ SQL
┌───────────▼──────────── PostgreSQL (Supabase) / PGlite lokalt ────────────────────┐
│ spørsmål + historikk · runder · økter · utfordringer · kommuner · hendelser       │
│ datasett + versjoner + observasjoner + revisjoner · funn · KI-forbruk · kjøringer │
└───────────▲───────────────────────────────────────────────────────────────────────┘
            │
┌───────────┴──────── GitHub Actions: ukentlig innholdsjobb ────────────────────────┐
│ SSB PxWebApi v2 → innhenting (delta-versjoner) → analyse (funn) → maler           │
│ → Claude API (formulering) → deterministisk faktakontroll → kø/godkjenning        │
│ → etterkontroll av bundne spørsmål → planlegging → rapport → varsel ved feil      │
└───────────────────────────────────────────────────────────────────────────────────┘
```

## Moduler

| # | Modul | Kode |
|---|---|---|
| 1 | Frontend og spillgrensesnitt | `src/app`, `src/components` |
| 2 | Spillmotor og poengberegning | `src/lib/game/{schema,scoring,rotation,public}.ts` |
| 3 | Vennedueller | `src/lib/play/service.ts` (`createChallenge`, `getChallengeView`), `/u/[code]` |
| 4 | Nabokrigen | `src/lib/nabokrig/{model,queries}.ts`, `/nabokrigen`, `/kommune/[slug]` |
| 5 | Datainnhenting | `src/lib/data/ssb/*`, `src/lib/data/{selection,ingest,catalog}.ts` |
| 6 | Statistisk analyse | `src/lib/data/analysis.ts` |
| 7 | KI-basert innholdsproduksjon | `src/lib/editorial/{templates,claude,pipeline}.ts` |
| 8 | Faktavalidering | `src/lib/qa/validate.ts`, `src/lib/data/revalidate.ts` |
| 9 | Publiseringssystem | `src/lib/db/{questions,games}.ts` (statusmaskin, låste runder) |
| 10 | Administrasjon | `src/app/admin/*` |
| 11 | Analyse | `src/lib/analytics/*`, `/api/events` |
| 12 | Annonser | `src/components/site/{AdScript,AdSlot}.tsx` |

## Viktige designvalg

- **Serveren er autoritativ.** Klienten får spørsmål uten fasit (`toPublic`). Hvert svar sendes til serveren, som beregner poeng og returnerer avsløringen. Økten er signert (HMAC), svar må komme i rekkefølge, ett svar per spørsmål, og med minste tid mellom svarene.
- **Låste runder.** En daglig runde lagres og låses når dagen starter. Alle spillere, og alle som får en utfordringslenke, får dermed nøyaktig samme spørsmål i samme rekkefølge. Et spørsmål som trekkes tilbake, filtreres bort for nye økter.
- **Én SQL-dialekt overalt.** Lokalt og i tester kjører ekte PostgreSQL via PGlite (WebAssembly). Derfor testes migrasjoner og spørringer mot samme motor som i produksjon.
- **Ingen KI som kalkulator.** Alle tall beregnes av `analysis.ts`. Claude får bare skrive tekst, og `validateQuestion(..., { strictNumbers: true })` avviser tall i teksten som ikke finnes i funnet.
- **Konfigurerbart uten kodeendring:** merkevare og domene (miljøvariabler), innholdsmiks, rundestørrelse, karantene, KI-budsjett, automatisk godkjenning og A/B-tester (admin → Innstillinger).
- **Internasjonalisering:** alle UI-tekster ligger i `src/lib/i18n/messages/nb.ts`, og markedet (språk, tidssone, geografi, datakilder) i `src/lib/config/market.ts`. En engelsk versjon er en ny katalog og et nytt marked, ikke en omskriving.
- **Klar for native app:** All logikk ligger bak JSON-API-er, så en iOS/Android-app kan bruke de samme endepunktene.

## Sikkerhet

| Område | Tiltak |
|---|---|
| Hemmeligheter | Bare på serveren (`src/lib/config/env.ts` importerer `server-only`). |
| Ratebegrensning | Postgres-basert, per daglig roterende IP-hash, på alle offentlige skrivende endepunkter. |
| Opphavskontroll | Endepunkter som endrer data krever samme opphav (Origin). |
| Inndata | Alle data valideres med zod, og forespørselsstørrelsen er begrenset. |
| Kallenavn | Renses til bokstaver, tall og enkle tegn (maks 24). |
| Administrasjon | Passord via miljøvariabel med konstanttids-sammenligning. httpOnly + SameSite=Strict-informasjonskapsel med 12 t levetid. Innloggingsforsøk er ratebegrenset. |
| Server actions | Next.js' innebygde CSRF-vern. |
| Sikkerhetshoder | HSTS, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options. |
| Cron | Krever `Authorization: Bearer CRON_SECRET`. |
| Juks i Nabokrigen | Første fullførte runde per spiller og dag teller. Maks 12 tellende runder per nettverk, kommune og dag. Krymping av snitt ved få runder. |
