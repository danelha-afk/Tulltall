# CLAUDE.md – arbeidsnotater for KI-assistenter i dette repoet

- Språk: all brukervendt tekst er norsk bokmål og ligger i `src/lib/i18n/messages/nb.ts` – aldri hardkod tekst i komponenter.
- Next.js 16 (App Router). Les `node_modules/next/dist/docs/` før du bruker API-er du er usikker på (params er Promises, `proxy.ts` erstatter middleware).
- Database: PostgreSQL. Lokalt og i tester PGlite (`createTestDb()`). Migrasjoner er append-only i `src/lib/db/migrations.ts`.
- Spørsmål valideres alltid med `parseQuestion` + `validateQuestion`. Ingen KI-vurdering kan overstyre faktakontrollen. Høyrisiko krever manuell godkjenning.
- Ikke la en språkmodell beregne tall: all statistikk beregnes i `src/lib/data/analysis.ts`.
- Syntetiske testdata (`src/lib/data/fixtures.ts`) skal aldri kunne publiseres.
- Før commit: `npm run typecheck && npm test && npm run content:validate`. Ved UI-endringer også `npm run build && npm run test:e2e`.
- Design: «Riso-arkade» (se `docs/designkonsept.md`). Bruk tokens i `src/app/globals.css`; korall som tekst på lys bakgrunn = `text-korall-dyp`.
- Temabalanse: høyst ÉT av dagens spørsmål handler om likestilling/mangfold (tag `likestilling-mangfold`, se `src/lib/game/themes.ts`). Resten skal være varierte «vet du det?»-temaer. Merk nytt innhold riktig, og lag mest innhold utenfor dette temaet.

