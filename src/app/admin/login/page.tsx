import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Administrasjon", robots: { index: false, follow: false } };

export default function AdminLogin() {
  return (
    <div className="mx-auto max-w-sm px-4 py-20">
      <h1 className="font-black font-wide uppercase text-3xl">Redaksjonen</h1>
      <p className="mt-2 text-blekk-2">Logg inn for å godkjenne spørsmål, planlegge runder og se statistikk.</p>
      <LoginForm />
    </div>
  );
}
