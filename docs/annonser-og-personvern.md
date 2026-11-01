# Annonser, samtykke og personvern

> Dette er en teknisk beskrivelse, ikke juridisk rådgivning. Personvernerklæringen (`/personvern`) bør gjennomgås av en jurist før lansering.

## Dataminimering

- Ingen konto, e-post eller navn. Spilleren identifiseres med en tilfeldig UUID lagret lokalt.
- Kallenavn i utfordringer og kommunevalg er frivillig og kan slettes fra «Mine runder».
- IP-adresser lagres ikke. Misbruksvern bruker en saltet hash som byttes hver dag.
- Vi samler aldri inn politiske holdninger, etnisitet, helse eller andre særlige kategorier.
- Hendelser eldre enn 13 måneder slettes av den ukentlige jobben.

## Samtykke (eget banner)

- **Nødvendig (uten samtykke):** spiller-ID, historikk og pågående økt. Dette trengs for tjenesten brukeren ber om.
- **Statistikk (samtykke):** Uten samtykke sendes hendelser uten ID, altså rene tellinger. Med samtykke knyttes hendelsene til spiller-ID-en, slik at vi kan måle gjenbesøk.
- Banneret har like store valg (Ja/Nei/Velg selv) og ingen forhåndsavkryssing. Det vises først etter fullført runde, så det aldri står i veien for spillet, og kan åpnes igjen fra bunnteksten.

## Google AdSense

Annonser er **av som standard**. For å slå dem på:

1. Godkjenn nettstedet i AdSense og opprett to annonseenheter: resultatsiden og øvrige sider.
2. Sett `NEXT_PUBLIC_ADS_ENABLED=true`, `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-…` og `NEXT_PUBLIC_ADSENSE_SLOT_RESULT` / `NEXT_PUBLIC_ADSENSE_SLOT_PAGE`.
3. Slå på «Annonser aktivert» i *Admin → Innstillinger*. Begge bryterne må være på.
4. **Aktiver Googles sertifiserte samtykkeløsning** (AdSense → *Privacy & messaging* → European regulations / TCF v2.2). For brukere i EØS krever Google en sertifisert CMP. Vårt eget banner styrer bare vår egen statistikk og kan ikke erstatte den.
5. Uten annonsesamtykke i vårt banner settes `requestNonPersonalizedAds = 1`.

**Plassering:**

- Annonser vises bare etter fullført runde (resultatsiden) og på informasjonssider, aldri inne i et spørsmål eller ved svaralternativene.
- De er alltid merket «Annonse» og skilt med stiplet ramme.
- Sponsede konkurranser og betalt innhold skal merkes tydelig og aldri presenteres som uavhengige statistikkfunn.

## Inntektsmåling

AdSense-inntekter registreres manuelt per måned i *Admin → Analyse*. Panelet regner ut RPM (inntekt per 1000 sidevisninger) og viser inntekt mot drifts- og KI-kostnad. Integrasjon mot AdSense Management API kan legges til senere.
