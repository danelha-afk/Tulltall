/**
 * Databasemigrasjoner. SQL-en er skrevet for PostgreSQL (Supabase i produksjon) og kjøres
 * uendret mot PGlite (Postgres i WebAssembly) lokalt og i tester.
 *
 * Migrasjoner er append-only: endre aldri en migrasjon som er kjørt i produksjon – legg til en ny.
 */
export interface Migration {
  id: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: "0001_init",
    sql: /* sql */ `
-- ── Kilder og datasett ─────────────────────────────────────────────
CREATE TABLE sources (
  id            text PRIMARY KEY,               -- f.eks. 'ssb'
  name          text NOT NULL,
  url           text NOT NULL,
  license       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE datasets (
  id                 text PRIMARY KEY,           -- f.eks. 'ssb:07459'
  source_id          text NOT NULL REFERENCES sources(id),
  table_id           text NOT NULL,
  title              text NOT NULL,
  catalog_key        text,                       -- nøkkel i overvåkingskatalogen
  source_updated_at  timestamptz,                -- 'updated' fra SSB
  last_checked_at    timestamptz,
  last_fetched_at    timestamptz,
  structure_hash     text,                       -- hash av dimensjoner/koder for å oppdage strukturendringer
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active','discontinued','error','candidate')),
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, table_id, catalog_key)
);

CREATE TABLE dataset_versions (
  id                 bigserial PRIMARY KEY,
  dataset_id         text NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  fetched_at         timestamptz NOT NULL DEFAULT now(),
  source_updated_at  timestamptz,
  query_url          text NOT NULL,              -- eksakt uttrekk (etterprøvbarhet)
  content_hash       text NOT NULL,
  cell_count         integer NOT NULL,
  suppressed_count   integer NOT NULL DEFAULT 0,
  missing_count      integer NOT NULL DEFAULT 0,
  dimensions         jsonb NOT NULL,             -- dimensjoner, koder og etiketter
  units              jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes              jsonb NOT NULL DEFAULT '[]'::jsonb,
  synthetic          boolean NOT NULL DEFAULT false
);
CREATE INDEX dataset_versions_dataset_idx ON dataset_versions(dataset_id, fetched_at DESC);

CREATE TABLE observations (
  version_id   bigint NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  cell_key     text NOT NULL,                    -- 'ContentsCode=Personer1|Region=0301|Tid=2024' (dimensjonene ligger i nøkkelen)
  value        double precision,                 -- NULL = mangler/skjermet
  status       text,                             -- SSB-symbol: '..' ':' '.' osv.
  PRIMARY KEY (version_id, cell_key)
);
-- Versjoner lagres som delta: første versjon har alle celler, senere versjoner bare nye/endrede celler.
CREATE INDEX observations_key_idx ON observations(cell_key);

CREATE TABLE observation_revisions (
  id            bigserial PRIMARY KEY,
  dataset_id    text NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  cell_key      text NOT NULL,
  old_value     double precision,
  new_value     double precision,
  from_version  bigint NOT NULL,
  to_version    bigint NOT NULL,
  detected_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX observation_revisions_dataset_idx ON observation_revisions(dataset_id, detected_at DESC);

-- ── Funn fra statistikkmotoren ─────────────────────────────────────
CREATE TABLE findings (
  id              text PRIMARY KEY,              -- deterministisk hash av innhold
  dataset_id      text NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  version_id      bigint NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  kind            text NOT NULL,
  payload         jsonb NOT NULL,                -- alle beregnede tall
  heuristics      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new','drafted','discarded','used')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX findings_status_idx ON findings(status, created_at DESC);

-- ── Spørsmål og redaksjonell historikk ─────────────────────────────
CREATE TABLE questions (
  id               text PRIMARY KEY,
  locale           text NOT NULL DEFAULT 'nb',
  status           text NOT NULL CHECK (status IN ('draft','validated','review_required','approved','published','archived')),
  format           text NOT NULL,
  category         text NOT NULL CHECK (category IN ('fun','misconception','current')),
  topic            text NOT NULL,
  risk             text NOT NULL CHECK (risk IN ('low','medium','high')),
  difficulty       smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  data_quality     smallint NOT NULL DEFAULT 3 CHECK (data_quality BETWEEN 1 AND 5),
  content          jsonb NOT NULL,               -- hele spørsmålet (validert av zod-skjema)
  scores           jsonb NOT NULL DEFAULT '{}'::jsonb,  -- interne prioriteringsanslag
  qa               jsonb NOT NULL DEFAULT '{}'::jsonb,  -- resultat av siste faktakontroll
  finding_id       text REFERENCES findings(id) ON DELETE SET NULL,
  origin           text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','seed','pipeline')),
  version          integer NOT NULL DEFAULT 1,
  exposure_count   integer NOT NULL DEFAULT 0,
  last_used_on     text,                          -- 'YYYY-MM-DD'
  last_verified_at text,                          -- 'YYYY-MM-DD'
  archived_reason  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  published_at     timestamptz
);
CREATE INDEX questions_status_idx ON questions(status, category);

CREATE TABLE question_revisions (
  id           bigserial PRIMARY KEY,
  question_id  text NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  version      integer NOT NULL,
  action       text NOT NULL,                     -- created, edited, approved, rejected, published, archived, revalidated
  from_status  text,
  to_status    text,
  actor        text NOT NULL,                     -- 'admin', 'pipeline', 'seed'
  note         text,
  snapshot     jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX question_revisions_q_idx ON question_revisions(question_id, created_at DESC);

-- ── Spill ──────────────────────────────────────────────────────────
CREATE TABLE games (
  id            text PRIMARY KEY,                 -- 'd-2026-11-01', 'q-<spørsmål>', 'c-<id>'
  kind          text NOT NULL CHECK (kind IN ('daily','single','custom')),
  game_date     text,                             -- 'YYYY-MM-DD' for daglige runder
  question_ids  jsonb NOT NULL,                   -- rekkefølgen er en del av spillet
  seed          text NOT NULL,
  status        text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','published','retired')),
  generator     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  locked_at     timestamptz
);
CREATE UNIQUE INDEX games_daily_date_idx ON games(game_date) WHERE kind = 'daily';

CREATE TABLE players (
  id                  uuid PRIMARY KEY,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  kommune_nr          text,                        -- kommunen spilleren representerer i Nabokrigen
  kommune_relation    text CHECK (kommune_relation IN ('bor','heier')),
  nickname            text
);

CREATE TABLE kommuner (
  nr               text PRIMARY KEY,
  name             text NOT NULL,
  slug             text NOT NULL UNIQUE,
  fylke_nr         text NOT NULL,
  fylke_name       text NOT NULL,
  alt_names        jsonb NOT NULL DEFAULT '[]'::jsonb,
  population       integer,
  population_date  text,
  population_source text,
  area_km2         double precision,
  valid_from       text NOT NULL DEFAULT '2024-01-01'
);

CREATE TABLE challenges (
  code               text PRIMARY KEY,
  game_id            text NOT NULL REFERENCES games(id),
  creator_session_id uuid NOT NULL,
  creator_player_id  uuid NOT NULL,
  creator_nickname   text,
  kind               text NOT NULL DEFAULT 'friend' CHECK (kind IN ('friend','kommune')),
  kommune_nr         text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id                   uuid PRIMARY KEY,
  game_id              text NOT NULL REFERENCES games(id),
  player_id            uuid NOT NULL REFERENCES players(id),
  challenge_code       text REFERENCES challenges(code),
  kommune_nr           text REFERENCES kommuner(nr),
  question_ids         jsonb NOT NULL,             -- frosset liste ved start
  answers              jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_index           integer NOT NULL DEFAULT 0,
  last_served_at       timestamptz NOT NULL DEFAULT now(),
  started_at           timestamptz NOT NULL DEFAULT now(),
  finished_at          timestamptz,
  score                integer,
  hits                 integer,
  max_score            integer,
  counted_for_kommune  boolean NOT NULL DEFAULT false,
  ip_hash              text,
  ref                  text,
  variants             jsonb NOT NULL DEFAULT '{}'::jsonb,
  nickname             text
);
CREATE INDEX sessions_game_idx ON sessions(game_id, finished_at);
CREATE INDEX sessions_player_idx ON sessions(player_id, started_at DESC);
CREATE INDEX sessions_challenge_idx ON sessions(challenge_code);
CREATE INDEX sessions_kommune_idx ON sessions(kommune_nr, finished_at) WHERE counted_for_kommune;

-- ── Analyse, varsler og drift ──────────────────────────────────────
CREATE TABLE events (
  id          bigserial PRIMARY KEY,
  ts          timestamptz NOT NULL DEFAULT now(),
  name        text NOT NULL,
  player_id   uuid,                               -- kun ved samtykke til statistikk
  session_id  uuid,
  path        text,
  ref         text,
  props       jsonb NOT NULL DEFAULT '{}'::jsonb,
  variants    jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX events_name_ts_idx ON events(name, ts DESC);
CREATE INDEX events_ts_idx ON events(ts DESC);

CREATE TABLE push_subscriptions (
  endpoint    text PRIMARY KEY,
  player_id   uuid,
  keys        jsonb NOT NULL,
  topics      jsonb NOT NULL DEFAULT '["daily"]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz,
  failures    integer NOT NULL DEFAULT 0
);

CREATE TABLE rate_limits (
  key           text NOT NULL,
  window_start  bigint NOT NULL,
  count         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

CREATE TABLE pipeline_runs (
  id           bigserial PRIMARY KEY,
  kind         text NOT NULL,                     -- weekly, daily, ingest, editorial, demo
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  status       text NOT NULL DEFAULT 'running' CHECK (status IN ('running','ok','partial','failed')),
  stats        jsonb NOT NULL DEFAULT '{}'::jsonb,
  report       text,
  errors       jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE ai_usage (
  id             bigserial PRIMARY KEY,
  run_id         bigint REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  model          text NOT NULL,
  purpose        text NOT NULL,
  input_tokens   integer NOT NULL DEFAULT 0,
  output_tokens  integer NOT NULL DEFAULT 0,
  cost_usd       double precision NOT NULL DEFAULT 0,
  ok             boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE revenue_entries (
  month        text PRIMARY KEY,                  -- 'YYYY-MM'
  ad_revenue_nok double precision NOT NULL DEFAULT 0,
  other_revenue_nok double precision NOT NULL DEFAULT 0,
  hosting_cost_nok double precision NOT NULL DEFAULT 0,
  note         text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO sources (id, name, url, license) VALUES
  ('ssb', 'Statistisk sentralbyrå', 'https://www.ssb.no', 'CC BY 4.0'),
  ('manual', 'Manuelt kuratert', 'https://tulltall.no/kilder', NULL);
`,
  },
  {
    id: "0002_profiles",
    sql: /* sql */ `
-- Spillerprofil: generert eller selvvalgt (filtrert) spillernavn, og frivillig visning på topplister.
ALTER TABLE players ADD COLUMN handle text;
ALTER TABLE players ADD COLUMN handle_custom boolean NOT NULL DEFAULT false;
ALTER TABLE players ADD COLUMN show_on_lists boolean NOT NULL DEFAULT false;
ALTER TABLE players ADD COLUMN hidden_by_admin boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX players_custom_handle_idx ON players (lower(handle)) WHERE handle_custom;
CREATE INDEX players_public_idx ON players (show_on_lists) WHERE show_on_lists AND NOT hidden_by_admin;
`,
  },
  {
    id: "0003_lists_visible_by_default",
    sql: /* sql */ `
-- Topplistene skal vise de som har spilt: spillere vises som standard (med tilfeldig navn) og kan skjule seg selv.
ALTER TABLE players ALTER COLUMN show_on_lists SET DEFAULT true;
UPDATE players SET show_on_lists = true WHERE NOT handle_custom AND NOT show_on_lists;
`,
  },
];
