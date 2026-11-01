import Link from "next/link";
import { Stamp } from "@/components/ui/Stamp";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <span className="text-6xl inline-block">
        <Stamp color="korall" rotate={-8}>Tull</Stamp>
      </span>
      <h1 className="font-black font-wide uppercase text-3xl mt-8">Denne siden finnes ikke</h1>
      <p className="serif-soft text-lg mt-3">Lenken kan være feil, eller innholdet er trukket tilbake.</p>
      <Link href="/" className="btn btn-primary mt-8">
        Til dagens runde →
      </Link>
    </div>
  );
}
