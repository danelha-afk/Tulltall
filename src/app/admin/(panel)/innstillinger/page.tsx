import { getDb } from "@/lib/db/client";
import { getSettings } from "@/lib/db/settings";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const settings = await getSettings(await getDb());
  return (
    <div>
      <h1 className="font-black font-wide uppercase text-3xl">Innstillinger</h1>
      <p className="mt-2 max-w-2xl text-blekk-2">Endringer gjelder fra neste gang runder planlegges eller innholdsjobben kjører. Allerede låste runder endres ikke.</p>
      <SettingsForm settings={settings} />
    </div>
  );
}
