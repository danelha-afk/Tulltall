# Designkonsepter

Tre tydelig forskjellige retninger ble vurdert før implementering.

## A · Riso-arkade (valgt)

*Risograf-trykk møter arkadehallen.* Kremhvitt papir med korn, blekk som overtrykker (blått × korall), rasterpunkter og feilregistrering. Spillets objekter er fysiske: **stempler**, **billetter med perforering**, **målebånd** og **hullkort**.

- **Styrker:** Umiddelbart gjenkjennelig og varmt. Det tåler alvorlige temaer når animasjonen dempes, og lekenheten ligger i objektene, ikke i dekor. Alt kan tegnes i CSS/SVG uten tunge bilder.
- **Svakheter:** Kornet og overtrykket kan bli kitsch hvis det overdrives. Korall og syregult krever omtanke for kontrast.

## B · Avgangstavla

*Splitflapp-tavler, svarte flater og gule tegn som vipper.* Hvert tall «ruller inn» som på en flystasjon, og billetten blir et boardingkort.

- **Styrker:** Fantastisk for store, bevegelige tall.
- **Svakheter:** Kald og mekanisk, og nært en kjent visuell referanse. Mørke flater med mye flipping er tungt på eldre telefoner og vanskelig for tilgjengelighet. Den passer dårlig til nøkterne temaer.

## C · Kjøkkenbordsavisa

*Avispapir, store serif-titler og datavisualisering som bryter spaltene.*

- **Styrker:** Troverdig og lesbar, og passer godt til «Hva sier tallene egentlig?».
- **Svakheter:** Føles som undervisning eller avis, og mangler spilleglede. Den ligner mye på eksisterende redaksjonell dataformidling.

## Valg

**A, med lån fra B og C.** B gir de rullende tallene (odometer med «pustende» bredde via variabel `font-stretch`), og C gir serif-forklaringene. Resultatet er et spill som ser ut som et trykksak-objekt, ikke en app-mal.

## Designsystem

| Token | Verdi | Bruk |
|---|---|---|
| `papir` | `#f4ede0` | Bakgrunn (med svakt korn) |
| `blekk` | `#17140f` | Tekst, kanter, «trykkskygger» |
| `kobolt` | `#2b3bff` | Primærhandling, fasit, «TALL» |
| `korall` | `#ff5a36` | Gjetning, «TULL», utfordringer (flate) |
| `korall-dyp` | `#b8350f` | Korall som *tekst* på papir (kontrast 5:1) |
| `syre` | `#e2f53b` | Treff, framheving, CTA på blått |
| `rosa`, `mynte` | `#ffb4cf`, `#5be3b0` | Sekundære tilstander |

**Typografi:**

| Skrift | Bruk |
|---|---|
| **Archivo** (variabel bredde 62–125 %, vekt 100–900) | Displaytekst, tall og UI. Bredden brukes aktivt: utvidet i logo og titler, kondensert i tall som ruller. |
| **Fraunces** (SOFT/WONK-akser) | Påstander og forklaringer. Det gir en redaksjonell, menneskelig stemme. |
| **Martian Mono** | Kilder, etiketter og «billettskrift». |

Alle skriftene er lisensiert under SIL Open Font License og lastes lokalt (ingen eksterne kall).

**Visuelle signaturer:**

- Logoen er levende: bokstaven mellom T og LL vipper mellom U og A.
- Harde «trykkskygger» (`4px 4px 0 blekk`) i stedet for myke skygger.
- Feilregistrert tekst (`misprint`).
- Rasterpunkter (`halftone`).
- Billettmaske med halvsirkel-hakk og perforering.
- Stempelfilter (SVG-turbulens) for blekktekstur.

## Egendesignede spillinteraksjoner

| Format | Interaksjon | Avsløring |
|---|---|---|
| Tull eller tall? | **Stempelet:** stemple påstanden, eller dra dokumentet mot venstre/høyre | Fasitstempelet slår ned over dokumentet. Ved alvorlige temaer tones det inn i stedet. |
| Gjett tallet | **Målebåndet** med **fire svaralternativer**: trykk på et tall, båndet glir dit, trykk Svar. Båndet kan fortsatt dras. Spørsmål, alternativer og Svar skal alltid stå på én skjerm (testes i `e2e/fit.spec.ts`) | Båndet zoomer ut til både gjetning og fasit synes, og tallet ruller fra gjetningen til fasit. |
| Hvem er størst? | **Duellen:** trykk på et tårn | Tårnene vokser til sine faktiske verdier, og vinneren får stempel. |
| Ranger riktig | **Stabelen:** papirstrimler med dra-håndtak og opp/ned-knapper | Strimlene glir til riktig plass med ✓ eller ↑n/↓n. |
| Tidsmaskinen | Dra endepunktet på kurven | Den ekte kurven tegner seg gjennom årene du ikke så. |
| Hva ser du? | **Flisekart** over 15 fylker uten tegnforklaring | Flisene snur og viser tallene. |

Resultatet er en **arkadebillett med stansede hull** (treffmønster uten svar), poeng som ruller, tittel og utfordringsboks. Startknappen er en billett man «river av».

## Kritisk vurdering av det ferdige produktet (spesifikasjonens punkt 30)

| Spørsmål | Vurdering |
|---|---|
| Ser det KI-generert ut? | Nei. Ingen gradienter, glass eller kortgrid-maler, og identiteten bærer gjennom alle flater, også ikonet og delingsbildene. |
| Er interaksjonene originale? | Ja, alle seks har eget fysisk objekt og egen avsløring. Svakest er «Hvem er størst?», som er nærmest en klassisk quiz, men tårnveksten gjør avsløringen til poenget. |
| Morsomt uten statistikkinteresse? | Moro-andelen (60 %) og tonen («Tullball-mester (med all respekt)») hjelper. Det må testes med ekte brukere. |
| Forstått uten instruksjoner? | Hvert format har én linje hjelpetekst og én tydelig handling. Ende-til-ende-testene spiller hele runden uten oppsett. |
| Overrasker det? | Eksempler fra banken: Akershus har flere innbyggere enn Oslo, Innlandet er større enn Finnmark, hjorten er felt dobbelt så ofte som elgen, og under én av tre biler på veien er elbil. |
| Verdt å dele? | Billetten viser treffmønsteret uten fasit. Utfordringslenken har eget delingsbilde, og enkeltspørsmål kan deles. |
| Grunn til å komme tilbake? | Ny runde hver dag med nedtelling, «dager på rad», personlig rekord, ukentlig Nabokrig og valgfritt daglig varsel. |
| Moraliserende? | Faktakontrollen avviser moraliserende formuleringer. Tekstene skriver «det stemmer ikke», ikke «du tok feil». |
| Humor og alvor i balanse? | Tonen styres per spørsmål (`playful`/`neutral`/`serious`). Alvorlige temaer får dempet animasjon, ingen stempel-slam og ingen «TREFF»-stempel. |

**Forbedringer som ble gjort etter visuell gjennomgang:**

- For trang ordavstand i kondensert tekst.
- Lange navn som brakk midt i ord i tårnene.
- Overlappende merkelapper.
- Målebåndet zoomer nå ut ved avsløring.
- Svakere stempeltekstur.
- «Ny rekord» vises ikke lenger på første runde.
- Tre kontrastfeil fra axe, som nå er rettet.
- Kartet er gjort mer kompakt.
