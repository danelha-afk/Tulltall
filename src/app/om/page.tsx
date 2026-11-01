import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/config/brand";
import { getDb } from "@/lib/db/client";
import { getSettings } from "@/lib/db/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Om TULL ELLER TALL?",
  description: "Hvordan spørsmålene lages, hvor tallene kommer fra og hvordan Nabokrigen regnes ut.",
};

export default async function About() {
  const settings = await getSettings(await getDb());
  const mix = settings.contentMix;
  const pct = (n: number) => Math.round(n * 100);
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="kicker">Om</p>
      <h1 className="font-black font-wide uppercase text-[clamp(2.4rem,10vw,4.2rem)] leading-[0.88] mt-2">
        Lek først.
        <br />
        <span className="text-kobolt misprint">Lærdom etterpå.</span>
      </h1>
      <div className="prose-tt mt-8">
        <p>
          {brand.name} er et spill om hvor godt vi egentlig kjenner landet vi bor i. Hver dag får alle de samme ti spørsmålene: morsomme fakta,
          overraskende tall og noen spørsmål som tester magefølelsen mot det statistikken faktisk viser.
        </p>
        <p>
          Vi forteller deg ikke hva du skal mene. Vi viser hva tallene sier, hva de <em>ikke</em> sier, og hvor de kommer fra – og så får du gjøre
          deg opp en mening selv.
        </p>

        <h2>Slik blir et spørsmål til</h2>
        <ol>
          <li>
            <strong>Data:</strong> En datamotor henter statistikk automatisk fra Statistisk sentralbyrås åpne API (PxWebApi v2) og lagrer hver versjon,
            slik at vi kan spore revisjoner.
          </li>
          <li>
            <strong>Beregning:</strong> Alle tall – andeler, endringer, rangeringer og per innbygger-tall – beregnes av kode, aldri av en språkmodell.
          </li>
          <li>
            <strong>Formulering:</strong> Redaksjonen skriver spørsmålene og forklaringene, med hjelp av digitale verktøy. Tall, kilder og
            konklusjoner kommer alltid fra primærdataene.
          </li>
          <li>
            <strong>Faktakontroll:</strong> Hvert forslag sjekkes automatisk: at fasit kan beregnes fra primærdata, at alle tall i teksten finnes i
            datagrunnlaget, at perioden stemmer, at alternativene er entydige, og at teksten ikke antyder årsakssammenhenger dataene ikke kan vise.
          </li>
          <li>
            <strong>Menneskelig godkjenning:</strong> Spørsmål om kriminalitet, migrasjon, etnisitet, religion, helse, diskriminering eller
            årsakssammenhenger publiseres aldri uten at en redaktør har godkjent dem.
          </li>
        </ol>

        <h2>Innholdsmiksen</h2>
        <p>
          En typisk runde består i dag av omtrent {pct(mix.fun)} % morsomme fakta, {pct(mix.misconception)} % spørsmål som utfordrer vanlige
          antakelser og {pct(mix.current)} % aktuelle samfunnsspørsmål. Vi justerer miksen etter hva som gjør spillet både morsomt og lærerikt.
        </p>
        <p>
          Vi kaller ikke noe en «myte» uten at vi har belegg for at mange faktisk tror det. Uten slikt belegg er det bare et spørsmål – og
          kanskje en overraskelse.
        </p>

        <h2>Poeng</h2>
        <p>
          Hvert spørsmål gir 0–100 poeng. På tallspørsmål får du poeng etter hvor nær du kommer – du trenger ikke treffe eksakt. Et «treff» (et stanset
          hull på billetten) er 70 poeng eller mer. Det er ingen klokke: tenk så lenge du vil.
        </p>

        <h2 id="nabokrigen">Nabokrigen – slik regnes poengene</h2>
        <p>Store kommuner skal ikke vinne bare fordi de er store, og én heldig spiller skal ikke kunne vinne alene. Derfor:</p>
        <ul>
          <li>
            <strong>Kunnskap (75 %):</strong> Snittpoengsummen for kommunens tellende runder sammenlignet med landssnittet. Når det er få runder,
            legger vi til 20 «gjennomsnittsrunder» før vi regner snitt, så tilfeldigheter ikke avgjør.
          </li>
          <li>
            <strong>Engasjement (25 %):</strong> Aktive spillere per 1000 innbyggere på en logaritmisk skala, med full uttelling ved 5 per 1000.
            Små kommuner kan dermed hevde seg mot store – men høy deltakelse alene kan ikke veie opp for svake svar.
          </li>
          <li>
            <strong>Minstekrav:</strong> En kommune må ha minst {settings.nabokrigMinPlayers} ulike spillere i uken for å komme på tabellen.
          </li>
          <li>
            <strong>Rettferdig telling:</strong> Bare første fullførte daglige runde per spiller og dag teller, og det er en grense for hvor mange
            tellende runder som kan komme fra samme nettverk samme dag.
          </li>
        </ul>
        <p>
          Konkurransen handler om kunnskap. Den kårer aldri kommunen med høyest inntekt, lavest kriminalitet eller best levekår til «best». Du velger
          selv hvilken kommune du spiller for – du trenger ikke bo der.
        </p>

        <h2>Penger og uavhengighet</h2>
        <p>
          Spillet er gratis. På sikt kan det finansieres av annonser og sponsede konkurranser. Annonser er alltid tydelig merket, står aldri inne i
          spørsmål eller svaralternativer, og betalt innhold blir aldri presentert som uavhengige statistikkfunn.
        </p>

        <h2>Feil og rettelser</h2>
        <p>
          Finner du en feil? Skriv til <a href={`mailto:${brand.contactEmail}`}>{brand.contactEmail}</a>. Spørsmål med feil trekkes ut av spillet,
          rettes og merkes. Hele den redaksjonelle historikken for hvert spørsmål lagres.
        </p>
        <p>
          <Link href="/kilder">Se alle kildene vi har brukt →</Link>
        </p>
        <p className="text-sm text-blekk-3 mt-10">
          Forslag til spørsmål og formuleringer lages delvis med KI-verktøy. Alt kontrolleres mot primærkilder og godkjennes av en redaktør før
          publisering.
        </p>
      </div>
    </div>
  );
}
