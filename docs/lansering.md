# Lanseringsstrategi

## Tre trafikkmekanismer – med teknisk støtte

### 1. Venner utfordrer venner (sosial spredning)

- **Teknisk:**
  - Resultatbilletten har treffmønster uten fasit og en utfordringsboks rett under.
  - `/u/<kode>` har eget delingsbilde («Kari fikk 7/10 – klarer du mer?»), resultatliste for utfordringen og sammenligning hull for hull etter at mottakeren har spilt.
  - Deling skjer via mobilens delemeny, med kopiering som reserve.
- **Måling:** utfordringer laget → åpnet (serverlogget, roboter filtrert) → runder spilt via utfordring → nye spillere fra deling.
- **Grep:** Nevn «din venn har fått 7/10» i delingsteksten, ikke en generisk oppfordring. Ingen tvang og ingen falske resultater.

### 2. Kommunene kriger (lokal rivalisering)

- **Teknisk:**
  - Kommunevalg og en ukestabell som er rettferdig for små og store (se poengmodellen).
  - Kommunesider (`/kommune/<navn>`) og duellsider (`/nabokrigen/bergen-mot-stavanger`) med delingsknapp.
  - Kjente rivalpar foreslås automatisk, og datamotoren lager rivalspørsmål fra SSB-data.
- **Grep:**
  - Send ukestabellen til lokalaviser hver mandag («Lillehammer slo Hamar i kunnskapskampen»).
  - Inviter ordførere og lokale profiler til å utfordre nabokommunen.
  - Gi skoler og bedrifter en grunn til å «heie».

### 3. Overraskende enkelthistorier

- **Teknisk:**
  - Hvert spørsmål har en egen side (`/s/<id>`) som kan spilles alene, med delingsbilde som viser påstanden, ikke svaret.
  - Enkeltspørsmål kan deles rett fra avsløringen.
  - `/kilder` gir journalister full kildeliste.
- **Grep:**
  - Ukentlig «Ukens tall» i sosiale medier (f.eks. «Akershus har flere innbyggere enn Oslo – tull eller tall?»).
  - Pressemeldinger når SSB publiserer nye tall som gir gode spørsmål.

## Faser

1. **Lukket beta (2–4 uker):** 50–200 testere. Mål fullføringsgrad, frafall per spørsmål og om de deler. A/B-test 7 mot 10 spørsmål.
2. **Bygg banken:** Minst 120 godkjente spørsmål. Gå gjennom hele startbanken redaksjonelt, og la ukejobben gå i minst tre uker.
3. **Myk lansering:** Nabokrigen i 3–4 rivalpar, med lokalaviser og noen få profiler.
4. **Bred lansering:** Når gjenbesøk neste dag og nye spillere fra deling er stabile.

## Teknisk SEO

- Riktige metadata, `sitemap.xml`, `robots.txt`, kanoniske URL-er og delingsbilder.
- Sitemap inneholder kommunesidene.
- **Bevisst valg:** vi masseproduserer ikke KI-artikler for søkemotorer. Produktet selv er innholdet.

## Inntekter på sikt (utover AdSense)

- **Sponsede ukeskonkurranser** med tydelig merking.
- **Bedriftsquizer** til julebord og interne konkurranser. Datamodellen har allerede `games.kind = 'custom'`.
- **Kommune-/skolepakker:** «Kjenn din kommune»-runder for lokale arrangementer.
- **Reklamefritt premiumalternativ:** først hvis etterspørselen dokumenteres.
