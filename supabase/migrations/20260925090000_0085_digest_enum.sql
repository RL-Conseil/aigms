-- =============================================================================
-- AIGMS — 0085 — Cadence du courriel de synthèse (type)
-- =============================================================================
-- Un type ne s'emploie pas dans la transaction qui le crée : il vit dans son
-- propre fichier, avant 0086 qui s'en sert.
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'app' and t.typname = 'digest_frequency') then
    create type app.digest_frequency as enum ('none', 'daily', 'weekly');
  end if;
end $$;
