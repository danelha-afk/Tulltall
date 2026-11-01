"use client";
import { Reorder, motion, useDragControls, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { formatValue, t } from "@/lib/i18n";
import type { FormatProps } from "./types";

type Item = { id: string; label: string; sublabel?: string };

/**
 * «Stabelen»: papirstrimler som dras i rekkefølge (eller flyttes med knapper for tastatur og
 * skjermleser). Ved avsløring glir strimlene til riktig plass og viser tallene.
 */
export function Rank({ q, onSubmit, busy, reveal }: FormatProps<"rank">) {
  const p = q.payload;
  const reduced = useReducedMotion();
  const [order, setOrder] = useState<Item[]>(p.items);
  const [announce, setAnnounce] = useState("");
  const full = reveal && reveal.data.payload.format === "rank" ? reveal.data.payload : null;
  const truth = (reveal?.detail.truth as string[] | undefined) ?? null;
  const mine = reveal && reveal.answer.format === "rank" ? reveal.answer.order : order.map((o) => o.id);
  const values = new Map(full?.items.map((i) => [i.id, i.value]) ?? []);

  useEffect(() => {
    if (!truth) return;
    const byId = new Map(p.items.map((i) => [i.id, i]));
    const tmo = setTimeout(() => setOrder(truth.map((id) => byId.get(id)!).filter(Boolean)), reduced ? 0 : 450);
    return () => clearTimeout(tmo);
  }, [truth, p.items, reduced]);

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[idx], next[j]] = [next[j], next[idx]];
    setOrder(next);
    setAnnounce(`${next[j].label}: plass ${j + 1} av ${next.length}`);
  };
  const locked = busy || Boolean(reveal);

  return (
    <div>
      <p className="font-bold text-blekk-2 mb-2" aria-hidden>
        ▲ {p.order === "desc" ? t("game.rankTop") : t("game.rankTopAsc")}
      </p>
      <Reorder.Group axis="y" values={order} onReorder={locked ? () => undefined : setOrder} className="flex flex-col gap-2.5" as="ol">
        {order.map((item, idx) => (
          <RankRow
            key={item.id}
            item={item}
            idx={idx}
            total={order.length}
            locked={locked}
            onMove={move}
            value={values.get(item.id)}
            unit={p.unit}
            delta={truth ? mine.indexOf(item.id) - truth.indexOf(item.id) : null}
            reduced={Boolean(reduced)}
          />
        ))}
      </Reorder.Group>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {!reveal ? (
        <div className="mt-6 flex justify-center">
          <button type="button" className="btn btn-primary min-w-56 text-xl !min-h-14" disabled={locked} onClick={() => onSubmit({ format: "rank", order: order.map((o) => o.id) })}>
            {t("game.lockIn")}
          </button>
        </div>
      ) : (
        <p className="text-center mt-5 font-black font-wide uppercase text-lg">
          {t("game.rankResult", { n: (reveal.detail.positionsCorrect as number) ?? 0, total: p.items.length })}
        </p>
      )}
    </div>
  );
}

function RankRow({
  item,
  idx,
  total,
  locked,
  onMove,
  value,
  unit,
  delta,
  reduced,
}: {
  item: Item;
  idx: number;
  total: number;
  locked: boolean;
  onMove: (i: number, d: -1 | 1) => void;
  value?: number;
  unit: { prefix: string; suffix: string; decimals: number };
  delta: number | null;
  reduced: boolean;
}) {
  const controls = useDragControls();
  const tilt = [-0.8, 0.6, -0.4, 0.9, -0.6, 0.3][idx % 6];
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      as="li"
      className="relative"
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
    >
      <motion.div
        style={{ rotate: tilt }}
        className={`flex items-center gap-3 rounded-xl border-[2.5px] border-blekk bg-papir pl-2 pr-2 py-2 shadow-[3px_3px_0_var(--color-blekk)] ${
          delta === 0 ? "bg-syre" : ""
        }`}
      >
        <span className="font-black font-condensed text-3xl w-8 text-center tabular text-kobolt" aria-hidden>
          {idx + 1}
        </span>
        <button
          type="button"
          aria-label={`Dra ${item.label}`}
          disabled={locked}
          onPointerDown={(e) => !locked && controls.start(e)}
          className={`touch-none grid place-items-center w-9 h-11 rounded-lg ${locked ? "opacity-0" : "cursor-grab active:cursor-grabbing hover:bg-papir-2"}`}
          tabIndex={-1}
        >
          <svg width="14" height="20" viewBox="0 0 14 20" aria-hidden>
            {[3, 10, 17].map((y) => (
              <g key={y}>
                <circle cx="4" cy={y} r="2" fill="currentColor" />
                <circle cx="10" cy={y} r="2" fill="currentColor" />
              </g>
            ))}
          </svg>
        </button>
        <span className="flex-1 min-w-0">
          <span className="block font-black font-semi-condensed uppercase text-[1.15rem] leading-tight truncate">{item.label}</span>
          {value !== undefined ? (
            <span className="block font-mono text-sm tabular">{formatValue(value, unit)}</span>
          ) : item.sublabel ? (
            <span className="block kicker text-blekk-2">{item.sublabel}</span>
          ) : null}
        </span>
        {delta !== null ? (
          <span className={`kicker px-2 py-1 rounded-full border-2 border-blekk ${delta === 0 ? "bg-kobolt text-papir" : "bg-papir"}`}>
            {delta === 0 ? "✓" : delta > 0 ? `↑${delta}` : `↓${-delta}`}
          </span>
        ) : (
          <span className="flex flex-col gap-1">
            <button
              type="button"
              className="w-11 h-9 rounded-lg border-2 border-blekk bg-papir disabled:opacity-25 font-black text-lg leading-none"
              aria-label={t("game.moveUp", { label: item.label })}
              disabled={locked || idx === 0}
              onClick={() => onMove(idx, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="w-11 h-9 rounded-lg border-2 border-blekk bg-papir disabled:opacity-25 font-black text-lg leading-none"
              aria-label={t("game.moveDown", { label: item.label })}
              disabled={locked || idx === total - 1}
              onClick={() => onMove(idx, 1)}
            >
              ↓
            </button>
          </span>
        )}
      </motion.div>
    </Reorder.Item>
  );
}
