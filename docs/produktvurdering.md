# Produktvurdering – kort og kritisk

## Det som er sterkt i idéen

- **Én tydelig sløyfe:** gjett → avsløring → «det hadde jeg ikke trodd» → del. Avsløringen er produktets kjerne, ikke spørsmålet.
- **Navnet gjør jobben:** *TULL* og *TALL* skiller seg med én bokstav. Det gir både logo (bokstaven som vipper), knappene i spillet (stempelet TULL/TALL) og tonen.
- **Lokal rivalisering har ekte delingsmotiv.** Bergen–Stavanger og Asker–Bærum trenger ingen forklaring.
- **Kilder på alt** er et reelt fortrinn mot vanlige quizsider, og gjør det mulig å ta opp vanskelige temaer uten å bli en politisk aktør.

## Premisser jeg har utfordret

| Premiss | Utfordring | Hva jeg gjorde |
|---|---|---|
| 10 spørsmål hver dag | Wordle-lignende vaner bygges på 2–3 minutter. Ti spørsmål med avsløring tar 4–7 minutter, og frafallet øker utover i runden. | Rundestørrelsen kan endres i admin, og A/B-oppsettet kan teste 7 mot 10. Frafall per spørsmål måles. |
| «Automatisk oppdagelse av overraskende fakta» | Kode kan finne ekstremverdier, rivaler og store endringer. Om noe er *overraskende* for folk, vet vi ikke før vi måler det. | Funn får deterministiske heuristikker. Claude gir interne anslag (1–5) som kalles *anslag*, ikke spådommer. Etter lansering kalibreres prioriteten mot faktisk frafall og deling (`recalibratePriorities`). |
| 30 % «feiloppfatninger» | De fleste slike temaer er høyrisiko og krever manuell godkjenning. Mye av dette innholdet kan derfor ikke automatiseres. | Høyrisiko går alltid til kø. Automatiseringen prioriterer lavrisiko-hverdagsstatistikk. Miksen kan endres i admin. |
| «Vanlige myter» | Vi vet sjelden hva folk faktisk tror. Å kalle noe en myte uten belegg er selv en feilinformasjon. | Faktakontrollen avviser ordet «myte» uten dokumentert oppfatning. Formuleringen er «mulig misforståelse». |
| «Hva tror folk tror?» | Dette krever representative undersøkelser. Research fant ingen norske Ipsos-tall som kan verifiseres. | Formatet er bygget (undersøkelsesvariant av «Gjett tallet»), men det finnes ikke seed-innhold. Brukes først når det finnes gode kilder. |
| «Du slo X % av spillerne» | Dette er misvisende med få spillere. | Vises først ved minst 30 fullførte runder samme dag (konfigurerbart). Før det står det ærlig at grunnlaget er for lite. |
| Viral vekst via kontroversielle spørsmål | Polarisering gir klikk, men også skjermdumper ut av kontekst og redaksjonell risiko. | Delingskort viser aldri svar. Alvorlige temaer har nøktern tone uten stempel-animasjon. Delingsoppfordringene peker mot hverdagsøkonomi og lokal rivalisering. |
| AdSense som hovedinntekt | I EØS krever AdSense en Google-sertifisert samtykkeløsning (TCF). Et eget banner er ikke nok. Annonseinntekt per bruker på et spill med 5 minutters økter er lav. | Egen samtykkeløsning for statistikk. Annonser er av som standard, og dokumentasjonen beskriver Googles CMP. Sponsede konkurranser er ofte bedre økonomi (se lansering.md). |
| Én hovedkilde (SSB) | SSBs API er godt, men mange gode «hverdagsfakta» kommer fra andre etater. | Startbanken bruker flere primærkilder (NVE, Nav, FHI, Kartverket, Statens vegvesen m.fl.). Bare SSB er automatisert, slik du ba om. |

## Største risikoer

1. **Faktafeil i et faktaprodukt** er dødelig for troverdigheten. Derfor er feilretting, tilbaketrekking og historikk bygget inn fra dag én, og ingen KI-vurdering kan overstyre den deterministiske kontrollen.
2. **Redaksjonell kapasitet:** Uten noen som går gjennom køen hver uke stopper strømmen av samfunnsspørsmål. Målet på 120 godkjente spørsmål før lansering er realistisk med ca. 2–3 timer redaksjonelt arbeid i uken.
3. **Vekst:** Delingsmekanismene er på plass, men om de virker vet vi først med ekte brukere. Analysepanelet måler faktiske besøk fra delte lenker, ikke bare klikk på del-knappen.
