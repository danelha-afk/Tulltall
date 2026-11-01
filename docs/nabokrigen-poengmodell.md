# Nabokrigens poengmodell

Kommunene konkurrerer i **kunnskap**, ikke i inntekt, eiendomspriser eller levekår. Du velger selv kommunen du spiller for, og vi lagrer om du bor der eller bare heier, men ikke hvor du bor.

## Krav til modellen

1. Den største kommunen skal ikke vinne bare fordi den er størst (rå summer).
2. Én heldig spiller i en liten kommune skal ikke kunne vinne alene (rene snitt).
3. Små kommuner skal kunne slå store.
4. Høy deltakelse alene skal ikke veie opp for svake svar.
5. Skalaen skal være stabil fra uke til uke.

## Modellen (`src/lib/nabokrig/model.ts`)

**Ukepoeng (0–100) = 75 % kunnskap + 25 % engasjement**

- **Kunnskap:** Bayesiansk krympet snitt av kommunens tellende runder: (sum + C × landssnitt) / (antall + C), med C = 20. Snittet uttrykkes relativt til landssnittet: ±100 poeng tilsvarer 0–1 (0,5 = landssnittet).
- **Engasjement:** log(1 + spillere per 1000 innbyggere) / log(1 + 5), maks 1. Full uttelling ved 5 spillere per 1000 innbyggere.
- **Minsteterskel:** minst 5 ulike spillere i uken for å rangeres (kan endres i admin).
- **Telling:** Bare første fullførte *dagens runde* per spiller og dag teller, og bare på selve dagen. Maks 12 tellende runder per nettverk (daglig IP-hash), kommune og dag.

## Simulering (`npm run nabokrig:simulate`)

Tenkte kommuner, tre runder per spiller, normalfordelt ferdighet (σ = 140 poeng):

| Kommune | Innb. | Spillere | Snitt | Justert snitt | Spillere/1000 | Kunnskap | Engasjement | Poeng | Plass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| STOR-FLINK | 300000 | 300 | 678 | 676 | 1 | 0.785 | 0.387 | 68.5 | 1 |
| LITEN-FLINK | 5000 | 8 | 678 | 651 | 1.6 | 0.659 | 0.533 | 62.8 | 2 |
| LITEN-IVRIG | 5000 | 60 | 598 | 600 | 12 | 0.401 | 1.000 | 55.1 | 3 |
| MELLOMSTOR | 100000 | 260 | 612 | 612 | 2.6 | 0.462 | 0.715 | 52.5 | 4 |
| STOR | 700000 | 900 | 603 | 603 | 1.29 | 0.419 | 0.461 | 42.9 | 5 |
| ÉN-HELDIG | 800 | 1 | 793 | 642 | 1.25 | 0.613 | 0.453 | 57.3 | – |

**Lesing:**

- Den flinkeste kommunen vinner, selv om den bare har 1 spiller per 1000 innbyggere.
- En liten, flink kommune slår store kommuner.
- Den største kommunen med flest spillere havner sist fordi den svarer dårligere.
- Én svært heldig spiller rangeres ikke (minsteterskel), og snittet krympes kraftig mot landssnittet (793 → 642).

## Historikk

Første versjon (70/30 og engasjement normalisert mot beste kommune) lot en ivrig, men svak liten kommune vinne. Simuleringen avdekket dette, og modellen ble justert til den nåværende versjonen. Testene i `tests/nabokrig.test.ts` låser kravene over.
