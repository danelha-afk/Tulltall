"use client";
import { useActionState } from "react";
import { login, type ActionState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(login, null);
  return (
    <form action={action} className="mt-8 grid gap-3">
      <label className="grid gap-1">
        <span className="kicker">Passord</span>
        <input name="password" type="password" required autoComplete="current-password" className="h-12 rounded-full border-[2.5px] border-blekk bg-papir px-4 font-bold" />
      </label>
      <button className="btn btn-primary" disabled={pending}>
        Logg inn
      </button>
      {state && !state.ok ? <p className="font-bold text-korall-dyp">{state.message}</p> : null}
    </form>
  );
}
