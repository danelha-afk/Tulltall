# Forventede løpende kostnader

*Anslag per november 2026. Prisene endres – sjekk leverandørene før du forplikter deg.*

| Post | Test/beta | Ved lansering | Kommentar |
|---|---|---|---|
| Vercel (hosting, cron, delingsbilder) | 0 (Hobby) | ca. 20 USD/mnd (Pro) | Hobby er ikke for kommersiell bruk. Pro trengs når annonser slås på. |
| Supabase (PostgreSQL) | 0 (Free) | ca. 25 USD/mnd (Pro) | Free-prosjekter pauses ved inaktivitet og har 500 MB. Pro gir 8 GB og daglig backup. |
| Claude API (KI-redaksjon) | 0–5 USD/mnd | ca. 5–25 USD/mnd | Anslag med `claude-opus-5-5` (4/20 USD per million tokens inn/ut): ca. 0,05–0,10 USD per kandidat. 40 kandidater i uken gir omtrent 8–16 USD/mnd. Taket settes i admin (standard 25 USD/mnd og 4 USD per kjøring). |
| GitHub Actions | 0 | 0 | Offentlig repo: gratis. Privat: 2000 gratis minutter/mnd, og ukejobben plus CI bruker langt mindre. |
| Domene (.no) | – | ca. 150–300 kr/år | tulltall.no er ikke bekreftet ledig. |
| SSB-data | 0 | 0 | Åpne data (CC BY 4.0). |
| Web Push | 0 | 0 | Nettleserens push-tjenester er gratis. |
| **Sum** | **≈ 0–50 kr/mnd** | **≈ 500–750 kr/mnd** | Pluss redaksjonell tid (2–3 t/uke). |

**Skalering:**

- Databasebelastningen domineres av økter og svar (én rad per runde). 100 000 runder i måneden er godt innenfor Supabase Pro.
- Ratebegrensning i Postgres holder lenge. Ved svært høy trafikk bør den flyttes til Redis (f.eks. Upstash).
- Delingsbilder genereres ved første forespørsel og caches av Vercels CDN.
