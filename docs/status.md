# Status – hva er ferdig, testet og gjenstående

*Sist oppdatert: 1. november 2026.*

## Konklusjon

**Spillbar MVP (fase 1) er ferdig og testet ende til ende.** Fase 2 (datamotor, KI-redaksjon, faktakontroll, kø, administrasjon og ukentlig automatisering) og fase 3 (Nabokrigen, analyse, annonser og rotasjon) er implementert og testet med syntetiske data og stubber.

**Produktet er ikke produksjonsklart** før punktene under «Må gjøres før lansering» er på plass.

## Verifisert i utviklingsmiljøet

| Kontroll | Resultat |
|---|---|
| `npm run typecheck` | Ingen feil |
| `npm test` (Vitest, ekte Postgres-SQL via PGlite) | 54/54 bestått, se tabellen under |
| `npm run test:e2e` (Playwright, Pixel 7-emulering, produksjonsbygg) | 8/8 bestått, ingen serverfeil i loggen. Dekker forsiden og axe-sjekk (WCAG 2.2 A/AA, ingen alvorlige funn), hel runde, utfordringslenke i ny nettleser med sammenligning, enkeltspørsmål, PWA-manifest og service worker, Nabokrigen med kommunevalg og telling, API-misbruk (falsk token, feil rekkefølge, cron uten nøkkel), admin-innlogging, godkjenning av høyrisiko-spørsmål og alle adminsider |
| `npm run content:validate` | 71 spørsmål, 0 feil (56 godkjent, 15 til manuell godkjenning) |
| `npm run build` | OK |
| Produksjonsdriveren (node-postgres over TCP) | Migrering, seed og planlegging kjørt med `pg`. Alle 8 ende-til-ende-testene er kjørt mot denne driveren (via PGlite-socket), også automatisk migrering ved oppstart. |
| `npm run pipeline:demo` | Hele løpet tabell → funn → utkast → faktakontroll → kø → planlagte runder → rapport (syntetiske data) |
| Visuell gjennomgang | Skjermbilder av alle seks formater, avsløringer, resultat, kart, Nabokrigen og forside. Funn er rettet (se designkonsept.md). |

Enhetstestene fordeler seg slik:

| Område | Tester |
|---|---|
| Spillflyt | 11 |
| Poeng | 7 |
| Rotasjon | 6 |
| Nabokrigen | 5 |
| SSB-klient og JSON-stat | 9 |
| Faktakontroll og seed-bank | 9 |
| Datamotor | 5 |
| Analysespørringer | 1 |

## Del B (ferdig): spillernavn, profil og Topp 10

- Alle får et tilfeldig navn med én gang. Eget navn kan velges under `/profil` (filter + unikt navn). Ingen konto eller e-post kreves.
- Topp 10 i dag og denne uken på forsiden. Man vises bare etter å ha trykket «Vis meg på listen».
- Admin: «Navn og lister» for å skjule spillere eller nullstille navn.
- E-postinnlogging (konto som følger deg mellom enheter) er ikke bygget ennå.

## Må gjøres før lansering (ikke ferdig)

1. **SSB live:** `data.ssb.no` var blokkert i utviklingsmiljøet. Klienten er skrevet mot den offisielle OpenAPI-spesifikasjonen og testet med JSON-stat-fiksturer, men **aldri kjørt mot ekte API**. Katalogoppføringene er merket `verified: false`. Kjør `weekly-content.yml` manuelt med «force», les rapporten og juster utvalgsreglene i `catalog.ts` hvis de ikke treffer.
2. **Claude API live:** Ingen API-nøkkel i utviklingsmiljøet. Koden er typekontrollert mot SDK-et (`@anthropic-ai/sdk` 1.3.0), og løpet er testet med stubber, også at oppdiktede tall stoppes. Første ekte kjøring: `npm run pipeline:demo -- --claude`.
3. **Redaksjonell gjennomgang av startbanken:** Tallene er kontrollert mot kildenes publiserte tekst via søk, ikke direkte mot tabellene (se redaksjon.md). De 15 høyrisiko-spørsmålene venter i køen.
4. **Flere spørsmål:** 56 godkjente mot målet på 120 før bred lansering.
5. **Juridisk gjennomgang** av personvernerklæringen og samtykkeløsningen, og oppsett av Googles CMP hvis annonser skal brukes.
6. **Infrastruktur:** Supabase, Vercel, hemmeligheter, domene, VAPID-nøkler og varslings-webhook.
7. **Testing på ekte enheter:** iPhone/Safari (særlig push, som krever at siden er lagt på hjemskjermen), eldre Android-telefoner og skjermleser (VoiceOver/TalkBack). Automatisk axe-sjekk er ikke nok.

## Bevisst utelatt eller delvis implementert

| Område | Status |
|---|---|
| «Hva tror folk tror?» | Formatet finnes (undersøkelsesvariant av «Gjett tallet»), men uten innhold: ingen verifiserbare norske undersøkelser ble funnet. |
| Aktuelle temaer fra nyhetskilder (pkt. 19) | Ikke bygget i v1, i tråd med spesifikasjonen. Utvidelsespunktet er katalogen og «kandidattabeller», som oppdages automatisk fra SSBs oppdateringsliste. |
| Personalisering etter interesser | Ikke bygget. Datamodellen (tema per spørsmål) og rotasjonen gjør det enkelt å legge til. |
| Kommunekart med ekte grenser | Ikke bygget. Kartformatet bruker et stilisert flisekart over fylker. Kommunegrenser fra Kartverket kan legges til ved behov (gir tyngre sider). |
| Sponsede konkurranser, bedriftsquizer og premium uten reklame | Ikke bygget. Modellen har `games.kind = 'custom'`. |
| AdSense Management API | Ikke integrert. Inntekter registreres manuelt i admin. |
| Engelsk versjon | Kun arkitektur (meldingskataloger og markedskonfigurasjon). Ingen engelsk tekst, slik spesifikasjonen sier. |
| ESLint | Ikke satt opp: npm feilet på en peer-avhengighet. Typekontroll og tester brukes i stedet. |
| Ytelsesmåling (Lighthouse) | Ikke kjørt. Sidene er lette (lokale skrifter, ingen bilder unntatt ikoner, delvis statisk), men det må måles. |
| Ratebegrensning | Postgres-basert. Ved stor trafikk bør den flyttes til Redis (Upstash). |

## Kjente begrensninger

- Folketall per kommune (1.1.2024) brukes som nevner i Nabokrigen. Det kommer fra en åpen, MIT-lisensiert npm-pakke (`@aprestmo/norway-geodata`) som bygger på SSB, og landssummen stemmer eksakt med SSB (5 550 203). Datamotoren skal oppdatere tallene fra tabell 07459.
- «Bedre enn X % av spillerne» vises først ved minst 30 fullførte runder samme dag.
- Nedtelling til neste runde og datoskifte følger norsk tid (Europe/Oslo).
