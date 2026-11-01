import type { ReactNode } from "react";

export function Card({ title, children, tone = "papir" }: { title?: string; children: ReactNode; tone?: "papir" | "syre" | "rosa" }) {
  const bg = tone === "syre" ? "bg-syre" : tone === "rosa" ? "bg-rosa" : "bg-papir";
  return (
    <section className={`rounded-2xl border-[2.5px] border-blekk ${bg} p-4 shadow-[4px_4px_0_var(--color-blekk)]`}>
      {title ? <h2 className="kicker mb-3">{title}</h2> : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div>
      <dt className="kicker text-blekk-3">{label}</dt>
      <dd className="font-black text-3xl tabular leading-tight">{value}</dd>
      {hint ? <p className="text-xs text-blekk-2">{hint}</p> : null}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Utkast",
  validated: "Kontrollert",
  review_required: "Til godkjenning",
  approved: "Godkjent",
  published: "Publisert",
  archived: "Arkivert/trukket",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-papir-3",
  validated: "bg-[#c9cbff]",
  review_required: "bg-rosa",
  approved: "bg-syre",
  published: "bg-mynte",
  archived: "bg-papir-2 line-through",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`kicker rounded-full border-2 border-blekk px-2 py-0.5 ${STATUS_COLOR[status] ?? ""}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function RiskBadge({ risk }: { risk: string }) {
  const map: Record<string, string> = { low: "Lav risiko", medium: "Middels risiko", high: "Høy risiko" };
  return <span className={`kicker rounded-full border-2 border-blekk px-2 py-0.5 ${risk === "high" ? "bg-korall" : risk === "medium" ? "bg-papir-2" : "bg-papir"}`}>{map[risk] ?? risk}</span>;
}

export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;
