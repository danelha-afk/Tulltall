# Redaksjon, KI og faktakontroll

## Prinsipper

- Vi viser hva tallene sier, og hva de **ikke** sier. Vi forteller ikke brukeren hva hen skal mene.
- Vi skiller alltid mellom anmeldt, etterforsket, siktet, siktede personer, domfelt, selvrapportert og utsatthet.
- Samvariasjon er ikke årsak. Gruppestatistikk sier ingenting om enkeltpersoner, og ingen grupper fremstilles som ensartede.
- Vi kaller ikke noe en «myte» uten belegg for at mange tror det.
- Ingen moralisering. Tekstene skriver «Dette overrasket mange» og «Det kommer an på hva vi måler», aldri «du tok feil».
- Alvorlige temaer får nøktern tone og dempet animasjon (`tone: "serious"`).

## Risikonivåer

| Nivå | Eksempler | Regel |
|---|---|---|
| Lav | Enkle, direkte kontrollerbare tall (navn, geografi, dyr) | Kan auto-godkjennes fra godkjente maler *hvis du slår det på*. Standard er av. |
| Middels | Beregninger, trender og «sjekk magefølelsen» | Godkjennes i køen |
| Høy | Kriminalitet, migrasjon, etnisitet, religion, helse, diskriminering, død, årsakssammenhenger | **Alltid manuell godkjenning.** Krever «Hva sier tallene egentlig?» og ikke-leken tone |

Risikoen beregnes også automatisk fra tekst og emne (`computeRisk`), og kan aldri settes lavere enn beregnet.

## Faktakontrollen (`src/lib/qa/validate.ts`)

| Kontroll | Hva den gjør |
|---|---|
| Skjema og semantikk | Fasit innenfor skalaen, entydig vinner (ikke uavgjort, minst 1 % margin), unike etiketter, stigende perioder, nøyaktig ett riktig kartalternativ, korrigering på tull-påstander. |
| Nevner | Prosentandeler må ligge mellom 0 og 100. |
| Aktualitet | Ikke kontrollert på 548 dager gir avvisning. Kontrolldato i fremtiden gir også avvisning. |
| Kilder | Gyldig https-URL og SSB-tabell-ID med fem sifre. Kilder utenfor listen over primærkilder gir merknad. |
| Tall i teksten | Må kunne spores til dataene. Er streng (avvisning) for KI-tekst. |
| Overdrivelse | Årsaksord flagges. Moraliserende formuleringer og «myte» uten belegg avvises. |
| Forståelighet | Lange setninger og lange spørsmål gir merknad. |
| Duplikater | Trigram-likhet på 0,72 eller mer mot banken avvises. |

Ingen KI-vurdering kan overstyre en feil herfra.

## Startbanken (seed)

106 spørsmål i `content/questions/*.json`: 71 fra første runde, 15 enkle «tull eller tall»-påstander i `enkle.json` og 20 fra samfunnsbaselinen (Forsvaret, okt. 2026) i `baseline.json`.

- **56** er godkjent (lav og middels risiko).
- **50** ligger i godkjenningskøen og venter på din vurdering: 15 høyrisiko-spørsmål fra første runde og alle i `enkle.json` og `baseline.json`.

**Ærlig om kontrollnivået:** Utviklingsmiljøet hadde ikke tilgang til ssb.no. Tallene ble derfor kontrollert mot kildenes publiserte tekst slik den gjengis i søkeresultater, ikke direkte mot statistikkbanken. Dette står åpent i spillet under «Hvor kommer tallet fra?» (*«Kontrollert mot kildens publiserte tekst – venter på automatisk tabellkontroll»*).

**Før offentlig lansering bør en redaktør gå gjennom hele banken.** Disse har lavere kildegrunnlag og bør sjekkes først:

- `fodte-samboere-2025` – sekundærkilde
- `grandiosa-per-ar` – produsentens tall
- `kontanter-trend` – årstallet er tolket
- `innvandring-krim-justering` – 4,5 % er fra avisomtale
- `drapssaker-kripos` og `ungdom-siktet-vold-2019-2024` – sekundærgjengivelser av Kripos/SSB

## Skriv enkelt (også om sensitive temaer)

Spillerne er fra 9 til 90 år. Derfor:

- **Én kort påstand, maks 12 ord**, uten faguttrykk og uten innskutte bisetninger. Eksempel: «Kriminaliteten i Norge har aldri vært lavere enn nå.» (tull eller tall).
- Tallene hører hjemme i svaret og i «Hva sier tallene egentlig?», ikke i påstanden.
- Forklaringen er maks to–tre korte setninger. Forbehold og nyanser står under «Hva sier tallene egentlig?».
- Faktakontrollen advarer om påstander over 14 ord, og KI-redaktøren har fått samme regler (`SYSTEM_PROMPT`).
- Sensitive temaer (kriminalitet, innvandring, helse, død) har alltid manuell godkjenning. Spørsmålene i `enkle.json` og `baseline.json` starter i køen uansett risiko, fordi tallene er kontrollert mot søkeresultater og ikke mot kildenes egne tabeller (`verification.method = secondary-snippet`).
- Nye spørsmål i `content/questions/` legges inn i den kjørende databasen ved neste oppstart. Spørsmål som allerede finnes (også avviste og arkiverte) røres aldri.

## Statuser og historikk

`draft` → `validated` → `review_required` → `approved` → `published` → `archived`

- Endringer i godkjent innhold sender spørsmålet tilbake til godkjenning.
- Hver endring lagres i `question_revisions` med øyeblikksbilde og notat.
- **Tilbaketrekking:** arkiver med årsak. Spørsmålet fjernes fra fremtidige runder, vises ikke for nye spillere i låste runder, og listes som «Trukket tilbake» på `/kilder`.

## KI-merking

Ikke påkrevd så lenge en redaktør godkjenner før publisering (KI-forordningen art. 50 nr. 4). Én diskret setning står nederst på `/om`. Slås automatisk godkjenning på, bør merkingen vurderes på nytt.

## Ukentlig redaksjonelt arbeid (anslag)

| Oppgave | Tid |
|---|---|
| Gå gjennom køen (20–30 kandidater) | 1–2 t |
| Kontroller høyrisiko mot primærkilde | 30–60 min |
| Se rapporten og eventuelle feil | 10 min |
