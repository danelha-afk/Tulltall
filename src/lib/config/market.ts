/**
 * Markedskonfigurasjon. Holder språk, tidssone, geografi og datakilder atskilt fra UI,
 * slik at en internasjonal versjon kan legges til som et nytt marked senere.
 */
export type MarketId = "no";

export interface MarketConfig {
  id: MarketId;
  locale: "nb";
  timeZone: string;
  country: string;
  /** Geografisk inndeling brukt i Nabokrigen. */
  geography: { unit: "kommune"; classificationNote: string };
  /** Primære automatiserte datakilder. */
  dataSources: string[];
}

export const markets: Record<MarketId, MarketConfig> = {
  no: {
    id: "no",
    locale: "nb",
    timeZone: "Europe/Oslo",
    country: "NO",
    geography: {
      unit: "kommune",
      classificationNote: "Kommuneinndeling gjeldende fra 1. januar 2024 (357 kommuner, SSB Klass 131).",
    },
    dataSources: ["ssb"],
  },
};

export const market = markets.no;
