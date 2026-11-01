import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/config/brand";

export const metadata: Metadata = { title: "Personvern" };

export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="kicker">Personvern</p>
      <h1 className="font-black font-wide uppercase text-[clamp(2.2rem,9vw,3.6rem)] leading-[0.9] mt-2">Så lite som mulig</h1>
      <div className="prose-tt mt-8">
        <p>
          Du kan spille uten konto, uten e-post og uten navn. Vi samler bare inn det som trengs for at spillet skal fungere, og det du selv velger
          å dele.
        </p>
        <h2>Det som lagres på enheten din</h2>
        <ul>
          <li>En tilfeldig spiller-ID, slik at du kan fortsette en påbegynt runde og ikke får spille samme runde to ganger.</li>
          <li>Historikken din (poeng og treffmønster), personlig rekord og antall dager på rad – bare på denne enheten.</li>
          <li>Kommunen du eventuelt har valgt i Nabokrigen, kallenavnet ditt i utfordringer, og samtykkevalgene dine.</li>
        </ul>
        <p>Dette er nødvendig for tjenesten du ber om, og brukes ikke til sporing på tvers av nettsteder.</p>

        <h2>Det som lagres på serveren</h2>
        <ul>
          <li>Spillrundene dine (svar og poeng) knyttet til den tilfeldige spiller-ID-en – for poengberegning, utfordringer og Nabokrigen.</li>
          <li>
            En saltet og avkortet nettverkshash som byttes hver dag, slik at vi kan begrense juks og misbruk. Vi lagrer ikke IP-adressen din.
          </li>
          <li>Kommunevalg og om du bor der eller heier – frivillig. Vi spør aldri om politisk syn, etnisitet, helse eller andre sensitive opplysninger.</li>
          <li>Varselabonnement hvis du har bedt om varsler.</li>
        </ul>

        <h2>Statistikk</h2>
        <p>
          Vi teller anonymt hendelser som «runde startet» og «runde fullført» uten noen ID. Bare hvis du sier ja til statistikk, kobles hendelsene til
          den tilfeldige spiller-ID-en, slik at vi kan måle om folk kommer tilbake. Du kan endre valget når som helst under «Personverninnstillinger»
          nederst på siden.
        </p>

        <h2>Annonser</h2>
        <p>
          Når annonser er slått på, leveres de av Google AdSense. Personlig tilpassede annonser vises bare med ditt samtykke via en sertifisert
          samtykkeløsning; ellers vises ikke-personlige annonser. Annonser er alltid tydelig merket og skilt fra spillet.
        </p>

        <h2>Dine rettigheter</h2>
        <p>
          Du kan slette historikken og fjerne kommune- og kallenavnkoblingene dine under <Link href="/historikk">Mine runder</Link>. For innsyn eller
          sletting ut over dette, skriv til <a href={`mailto:${brand.contactEmail}`}>{brand.contactEmail}</a> og oppgi spiller-ID-en din (vises på
          Mine runder ved behov). Du kan også klage til Datatilsynet.
        </p>

        <h2>Lagringstid</h2>
        <p>
          Rådata om hendelser slettes eller anonymiseres etter 13 måneder. Spillrunder beholdes så lenge de inngår i resultatlister og utfordringer,
          men kan slettes på forespørsel.
        </p>
      </div>
    </div>
  );
}
