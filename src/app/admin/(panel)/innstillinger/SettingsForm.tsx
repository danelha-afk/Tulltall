"use client";
import { useActionState } from "react";
import { saveSettingsAction, type ActionState } from "../../actions";
import type { Settings } from "@/lib/db/settings";

const field = "h-11 rounded-xl border-2 border-blekk px-3 bg-papir w-full";

export function SettingsForm({ settings: s }: { settings: Settings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettingsAction, null);
  const num = (name: string, label: string, value: number, hint?: string, step = 1) => (
    <label className="grid gap-1">
      <span className="font-bold">{label}</span>
      <input name={name} type="number" step={step} defaultValue={value} className={field} />
      {hint ? <span className="text-xs text-blekk-2">{hint}</span> : null}
    </label>
  );
  return (
    <form action={action} className="mt-6 grid gap-6">
      <fieldset className="grid gap-4 rounded-2xl border-[2.5px] border-blekk bg-papir p-4 sm:grid-cols-3">
        <legend className="kicker px-2">Innholdsmiks (prosent, summerer til 100)</legend>
        {num("mixFun", "Moro", Math.round(s.contentMix.fun * 100))}
        {num("mixMisconception", "Sjekk magefølelsen", Math.round(s.contentMix.misconception * 100))}
        {num("mixCurrent", "Aktuelt", Math.round(s.contentMix.current * 100))}
      </fieldset>
      <fieldset className="grid gap-4 rounded-2xl border-[2.5px] border-blekk bg-papir p-4 sm:grid-cols-3">
        <legend className="kicker px-2">Daglige runder</legend>
        {num("roundSize", "Spørsmål per runde", s.roundSize)}
        {num("cooldownDays", "Karantene (dager før gjenbruk)", s.cooldownDays)}
        {num("maxPerTopic", "Maks per emne", s.maxPerTopic)}
        {num("maxPerFormat", "Maks per format", s.maxPerFormat)}
        {num("staleDays", "Spørsmål utløper etter (dager uten kontroll)", s.staleDays)}
        {num("nabokrigMinPlayers", "Nabokrigen: minste antall spillere", s.nabokrigMinPlayers)}
      </fieldset>
      <fieldset className="grid gap-4 rounded-2xl border-[2.5px] border-blekk bg-papir p-4 sm:grid-cols-3">
        <legend className="kicker px-2">Automatisering og KI</legend>
        {num("aiMonthlyBudgetUsd", "KI-budsjett per måned (USD)", s.aiMonthlyBudgetUsd, undefined, 0.5)}
        {num("aiRunBudgetUsd", "KI-budsjett per kjøring (USD)", s.aiRunBudgetUsd, undefined, 0.5)}
        {num("aiMaxCandidatesPerRun", "Maks kandidater per kjøring", s.aiMaxCandidatesPerRun)}
        <label className="flex items-start gap-3 sm:col-span-3">
          <input type="checkbox" name="autoPublishLowRisk" defaultChecked={s.autoPublishLowRisk} className="w-5 h-5 mt-1 accent-kobolt" />
          <span>
            <strong>Automatisk godkjenning av lavrisiko-spørsmål</strong>
            <span className="block text-sm text-blekk-2">Bare for forhåndsgodkjente maler som består all faktakontroll. Høyrisiko og flaggede spørsmål går alltid til deg. Anbefales først etter en testperiode.</span>
          </span>
        </label>
      </fieldset>
      <fieldset className="grid gap-4 rounded-2xl border-[2.5px] border-blekk bg-papir p-4">
        <legend className="kicker px-2">Annonser og A/B-tester</legend>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="adsEnabled" defaultChecked={s.adsEnabled} className="w-5 h-5 mt-1 accent-kobolt" />
          <span>
            <strong>Annonser aktivert (redaksjonelt valg)</strong>
            <span className="block text-sm text-blekk-2">Krever også at NEXT_PUBLIC_ADSENSE_CLIENT og NEXT_PUBLIC_ADS_ENABLED er satt, og at Googles samtykkeløsning er aktivert. Se docs/annonser.md.</span>
          </span>
        </label>
        <label className="grid gap-1">
          <span className="font-bold">A/B-tester (JSON)</span>
          <textarea name="experiments" rows={8} defaultValue={JSON.stringify(s.experiments, null, 2)} className="rounded-xl border-2 border-blekk p-3 bg-papir font-mono text-xs" />
          <span className="text-xs text-blekk-2">Hver test: key, description, variants, weights (summerer til 1) og active.</span>
        </label>
      </fieldset>
      <button className="btn btn-primary w-fit" disabled={pending}>Lagre innstillinger</button>
      {state ? (
        <div className={`rounded-xl border-2 border-blekk p-3 ${state.ok ? "bg-syre" : "bg-rosa"}`}>
          <p className="font-bold">{state.message}</p>
          {state.errors?.length ? <ul className="text-sm">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
        </div>
      ) : null}
    </form>
  );
}
