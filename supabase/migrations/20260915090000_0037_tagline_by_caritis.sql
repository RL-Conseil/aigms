-- =============================================================================
-- AIGMS — 0037 — La mention de l'éditeur devient « by Caritis »
-- =============================================================================
-- Plus courte, elle tient à côté du nom sans l'écraser. La migration 0036
-- n'est pas réécrite : elle peut déjà avoir été appliquée ailleurs, et une
-- migration appliquée ne se modifie pas.
--
-- Seuls les tenants qui portent encore la mention par défaut sont touchés :
-- un tenant qui a posé sa propre mention, ou l'a vidée, ne la retrouve pas.
-- =============================================================================

alter table public.tenant
  alter column brand_tagline set default 'by Caritis';

update public.tenant
   set brand_tagline = 'by Caritis'
 where brand_tagline = 'Designed by Caritis';
